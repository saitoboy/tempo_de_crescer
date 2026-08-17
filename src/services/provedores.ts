import { aplicarProxy } from '../utils/proxy';
import { logInfo, logWarning } from '../utils/logger';

/**
 * Escreve devocional por API, com várias chaves em rodízio.
 *
 * O CLI do Claude consome a assinatura de quem roda, e a cota rende ~18
 * devocionais por janela de 5 horas — com 180 páginas para escrever, isso são
 * dez janelas. Groq e NVIDIA servem modelos abertos de graça, com limite por
 * chave. Como o limite é **por chave** e não por pessoa, várias chaves viram
 * várias cotas: quando uma esgota, a próxima assume.
 *
 * Os dois provedores falam o protocolo da OpenAI (`/chat/completions`), então
 * muda a URL base, a chave e o nome do modelo — não o código.
 *
 * O que **não** muda é a validação: o Zod continua sendo o porteiro. Modelo
 * fraco não suja o livro em silêncio, ele falha e a resenha volta para a fila.
 */

export type Provedor = {
  nome: string;
  baseUrl: string;
  modelo: string;
  /** Em rodízio: a primeira que não estiver esgotada é a que atende. */
  chaves: string[];
  /**
   * Quanto o modelo pode raciocinar antes de responder.
   *
   * **Não é ajuste fino, é o que faz o `gpt-oss-120b` responder.** No padrão,
   * ele gastou os 4.000 tokens de saída inteiros pensando — `finish_reason:
   * length`, 3.998 tokens de raciocínio e `content` vazio. Com `low`, foram 72
   * tokens de raciocínio e o JSON saiu inteiro.
   *
   * Escrever devocional a partir de uma resenha pronta não é problema de
   * raciocínio; é de redação. O modelo não precisa deliberar, precisa escrever.
   */
  raciocinio?: 'low' | 'medium' | 'high';
};

export type Resultado = {
  texto: string;
  entrada: number;
  saida: number;
  /** Qual provedor e qual chave atenderam — para o log dizer de onde veio. */
  origem: string;
};

/** O que o provedor devolve quando a chave acabou, e não quando o pedido é ruim. */
const ESGOTADA = [401, 402, 403, 429];

/**
 * O modo JSON estrito fica **desligado** por padrão.
 *
 * Parece o caminho óbvio — `response_format: json_object` obriga o modelo a
 * devolver JSON e dispensa adivinhação. Com prompt curto funciona. Com o nosso,
 * de ~12 mil caracteres, a Groq recusou com `400 Failed to validate JSON` e
 * `failed_generation` vazio, em toda tentativa, inclusive limitando
 * `max_tokens`. O `gpt-oss-120b` emite raciocínio antes da resposta, e o
 * validador da Groq é mais rígido que o nosso.
 *
 * Como o `extrairJson` já lida com cerca de código e prosa em volta, ligar
 * isto troca um problema que sabemos resolver por um 400 que não sabemos.
 * `GROQ_JSON_ESTRITO=true` liga, para quando um modelo precisar.
 */
const jsonEstrito = process.env.GROQ_JSON_ESTRITO === 'true';

/**
 * Quanto esperar quando **todas** as chaves esgotam.
 *
 * O limite da Groq é por minuto (TPM), não por dia: chave esgotada volta
 * sozinha. Num lote longo, parar seria desistir de algo que se resolve
 * esperando — mas esperar sem teto esconderia uma conta de fato bloqueada.
 */
const ESPERA_MS = 65_000;

/**
 * Baixa, para o texto não variar a cada tentativa mais do que o necessário.
 * Zero não serve: quando o Zod recusa por tamanho, a retentativa precisa
 * produzir algo **diferente**, e temperatura zero devolveria o mesmo texto.
 */
const TEMPERATURA = 0.6;

/**
 * Lê os provedores do ambiente.
 *
 * As chaves vêm separadas por vírgula, porque é a forma que sobrevive a um
 * painel de variáveis de ambiente sem inventar arquivo de configuração:
 *
 *     GROQ_API_KEYS=gsk_aaa,gsk_bbb,gsk_ccc
 *     NVIDIA_API_KEYS=nvapi-xxx
 */
export function provedoresDoAmbiente(): Provedor[] {
  const lista = (nome: string) =>
    (process.env[nome] ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

  const provedores: Provedor[] = [];

  const groq = lista('GROQ_API_KEYS');
  if (groq.length > 0) {
    provedores.push({
      nome: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      modelo: process.env.GROQ_MODELO || 'openai/gpt-oss-120b',
      chaves: groq,
      raciocinio: 'low',
    });
  }

  const nvidia = lista('NVIDIA_API_KEYS');
  if (nvidia.length > 0) {
    provedores.push({
      nome: 'nvidia',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      modelo: process.env.NVIDIA_MODELO || 'nvidia/nemotron-3-super-120b-a12b',
      chaves: nvidia,
    });
  }

  return provedores;
}

/** Mostra só o suficiente para identificar a chave no log, nunca o valor. */
function apelido(chave: string): string {
  return `${chave.slice(0, 7)}…${chave.slice(-4)}`;
}

async function pedirA(
  provedor: Provedor,
  chave: string,
  prompt: string,
  limiteMs: number,
): Promise<{ resposta: Response; corpo: string }> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), limiteMs);

  try {
    const resposta = await fetch(`${provedor.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${chave}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: provedor.modelo,
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURA,
        ...(provedor.raciocinio ? { reasoning_effort: provedor.raciocinio } : {}),
        ...(jsonEstrito ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controle.signal,
    });

    return { resposta, corpo: await resposta.text() };
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Percorre provedores e chaves até um atender.
 *
 * A ordem é a do ambiente: o primeiro provedor listado é o preferido, e dentro
 * dele as chaves são tentadas em sequência. Chave esgotada (401/402/403/429)
 * apenas cede a vez — não derruba nada, porque é o comportamento esperado, não
 * uma falha.
 *
 * Erro de pedido (400, JSON inválido, modelo inexistente) é diferente: nenhuma
 * outra chave resolveria, então sobe na hora em vez de queimar a lista inteira.
 */
export async function escrever(
  provedores: Provedor[],
  prompt: string,
  limiteMs = 120_000,
  /** Sobrepõe o modelo de todos os provedores. Serve à comparação de modelos. */
  modelo?: string,
): Promise<Resultado> {
  if (modelo) provedores = provedores.map((p) => ({ ...p, modelo }));

  // Uma passada; se todas as chaves esgotarem, espera a janela do minuto virar
  // e tenta de novo. Duas rodadas, não infinitas: conta bloqueada de verdade
  // precisa aparecer como erro, não virar espera eterna.
  try {
    return await umaPassada(provedores, prompt, limiteMs);
  } catch (e) {
    if (!(e instanceof TodasEsgotadas)) throw e;

    logInfo(`todas as chaves no limite, esperando ${ESPERA_MS / 1000}s`, 'devocional');
    await new Promise((r) => setTimeout(r, ESPERA_MS));
    return umaPassada(provedores, prompt, limiteMs);
  }
}

/** Só o esgotamento merece nova rodada; erro de pedido, não. */
class TodasEsgotadas extends Error {}

async function umaPassada(
  provedores: Provedor[],
  prompt: string,
  limiteMs: number,
): Promise<Resultado> {

  if (provedores.length === 0) {
    throw new Error('Nenhum provedor configurado — defina GROQ_API_KEYS ou NVIDIA_API_KEYS');
  }

  aplicarProxy();

  const esgotadas: string[] = [];

  for (const provedor of provedores) {
    for (const chave of provedor.chaves) {
      const origem = `${provedor.nome}/${provedor.modelo} (${apelido(chave)})`;

      let resposta: Response;
      let corpo: string;
      try {
        ({ resposta, corpo } = await pedirA(provedor, chave, prompt, limiteMs));
      } catch (e) {
        // Rede, tempo esgotado: pode ser desta chave ou do provedor inteiro.
        // Cede a vez em vez de derrubar o lote.
        logWarning(`${origem} não respondeu: ${(e as Error).message}`, 'devocional');
        esgotadas.push(origem);
        continue;
      }

      if (ESGOTADA.includes(resposta.status)) {
        esgotadas.push(`${origem} → ${resposta.status}`);
        continue;
      }

      if (!resposta.ok) {
        throw new Error(`${origem} devolveu ${resposta.status}: ${corpo.slice(0, 300)}`);
      }

      const json = JSON.parse(corpo) as {
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          completion_tokens_details?: { reasoning_tokens?: number };
        };
      };

      const escolha = json.choices?.[0];
      const texto = escolha?.message?.content;

      if (!texto) {
        // O caso comum não é "o modelo não respondeu", é "o modelo gastou a
        // saída inteira raciocinando". Dizer isso poupa a investigação que
        // custou meia hora aqui.
        const raciocinio = json.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
        const diagnostico =
          escolha?.finish_reason === 'length' && raciocinio > 0
            ? `gastou ${raciocinio} tokens raciocinando e não sobrou saída para a resposta — ` +
              `use reasoning_effort mais baixo`
            : corpo.slice(0, 200);

        throw new Error(`${origem} devolveu resposta sem conteúdo: ${diagnostico}`);
      }

      if (esgotadas.length > 0) {
        logInfo(`${esgotadas.length} chave(s) fora, atendido por ${origem}`, 'devocional');
      }

      return {
        texto,
        entrada: json.usage?.prompt_tokens ?? 0,
        saida: json.usage?.completion_tokens ?? 0,
        origem,
      };
    }
  }

  throw new Error(
    `Todas as ${esgotadas.length} chaves estão esgotadas ou fora:\n  ${esgotadas.join('\n  ')}`,
  );
}
