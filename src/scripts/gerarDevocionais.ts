import '../utils/timezone';
import 'dotenv/config';
import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import connection from '../connection';
import { comoPedido, filaDeGeracao, filaDoTema } from '../services/devocional';
import { MESES } from '../services/curadoriaDoLivro';
import {
  acharPregador,
  escreverUm,
  motorDeApi,
  type Gasto,
  type Motor,
} from '../services/escrita';
import { logError, logInfo, logSuccess, logWarning } from '../utils/logger';
import { urlDoProxy } from '../utils/proxy';
import { eCotaDiaria, provedores as provedoresDisponiveis } from '../services/provedores';

/**
 * Escreve os devocionais.
 *
 *     npm run devocionais                    # 5, das mais recentes
 *     npm run devocionais -- 20              # 20, das mais recentes
 *     npm run devocionais -- 20 2027-6       # 20 para o mês de Escatologia
 *     npm run devocionais -- 20 2027-6 --listar   # só a lista, sem gastar cota
 *     npm run devocionais -- 20 --todos      # abre para todos os pregadores
 *     npm run devocionais -- 20 --cli        # força o Claude, ignorando as chaves
 *
 * **Dois motores.** Com `GROQ_API_KEYS` ou `NVIDIA_API_KEYS` no ambiente, usa a
 * API — modelos abertos, de graça, com rodízio de chaves. Sem chave nenhuma,
 * cai no CLI do Claude, que consome a assinatura de quem roda e rende ~18
 * devocionais por janela de 5 horas.
 *
 * O motor não muda mais nada: prompt, validação, retentativa e gravação são os
 * mesmos, e quem decide se o texto presta é o Zod. `modelo` fica gravado em
 * cada devocional, então dá para comparar os dois depois.
 *
 * **Só pregação do Nélio, por padrão** — o livro é dele. Ver
 * `PREGADOR_DO_LIVRO`.
 *
 * A fila são as resenhas sem devocional. Interromper no meio não perde nada:
 * cada uma é gravada assim que fica pronta, e a execução seguinte continua de
 * onde parou.
 *
 * **Com um mês, a fila muda de critério**: em vez das mais recentes, as que
 * mais se parecem com o tema. É o modo que vale a pena — a cota rende cerca de
 * 18 devocionais por janela, e gastá-la escrevendo texto que nenhum mês do
 * livro vai usar é o desperdício que este parâmetro existe para evitar.
 */

const MODELO = 'claude-opus-5';
const LOTE_PADRAO = 5;

/**
 * De quem é o livro.
 *
 * Não é preferência de quem roda o script: **o livro é do pastor Nélio**, e
 * devocional escrito a partir da pregação de outra pessoa não pertence a ele.
 * Por isso o filtro é o padrão e não uma flag — depender de alguém lembrar de
 * digitar `--pregador` significa que uma distração contamina o acervo do
 * livro, e o erro só apareceria na diagramação.
 *
 * `--todos` desliga, para geração que não seja para este livro.
 */
const PREGADOR_DO_LIVRO = 'Nélio Monteiro';

/** Limite de tokens por minuto de cada chave da Groq, do plano gratuito. */
const TOKENS_POR_MINUTO_POR_CHAVE = 8000;
/** Chute inicial, só para o primeiro item; depois vale o medido. */
const CUSTO_DE_UM_DEVOCIONAL = 4300;
/** Quanto a chamada leva, para descontar da pausa. */
const GERACAO_TIPICA_MS = 3500;

/**
 * Pausa entre itens, calculada a partir da capacidade real.
 *
 * Era constante, e constante envelhece: 3 segundos estavam certos para cinco
 * chaves e viraram desperdício com onze. Agora sai da conta —
 * `chaves × 8.000 ÷ 4.300` dá quantos cabem por minuto, e a pausa é o intervalo
 * que sobra depois de descontar a geração.
 *
 * Por que existe: sem ritmo o lote pede mais do que o provedor entrega. Com
 * cinco chaves ele ia a catorze por minuto contra nove de capacidade, gastava
 * o colchão do rodízio em uns oitenta itens e derrubava as cinco de uma vez —
 * e aí nem a espera de 65s resolve, porque a demanda segue acima da oferta.
 *
 * **A pausa é por processo.** Dois lotes em paralelo pedem o dobro, e cada um
 * precisa do dobro da pausa. `DEVOCIONAIS_PAUSA_MS` sobrepõe para esse caso.
 */
function pausaEntreItens(chaves: number): number {
  if (process.env.DEVOCIONAIS_PAUSA_MS) return Number(process.env.DEVOCIONAIS_PAUSA_MS);
  if (chaves === 0) return 0;

  const porMinuto = (chaves * TOKENS_POR_MINUTO_POR_CHAVE) / CUSTO_DE_UM_DEVOCIONAL;
  return Math.max(0, Math.round(60_000 / porMinuto - GERACAO_TIPICA_MS));
}
/**
 * Quantas falhas seguidas derrubam o lote.
 *
 * Falha isolada é normal — o modelo devolve um texto longo demais e o Zod
 * recusa. Falha atrás de falha é outra coisa: conta sem uso disponível, sessão
 * do CLI expirada, rede fora. Nesses casos o lote inteiro falharia igual, e um
 * lote de mil itens levaria horas para descobrir isso.
 */
const FALHAS_SEGUIDAS_PARA_ABORTAR = 3;
/** Uma resenha longa com um devocional inteiro de volta leva bem mais que o padrão. */
const TEMPO_LIMITE_MS = 5 * 60 * 1000;

/**
 * O CLI carrega o CLAUDE.md do diretório onde roda. Aqui isso seria desperdício
 * de contexto e ainda arriscaria misturar as instruções do projeto com as do
 * devocional — então ele roda de uma pasta vazia.
 */
const PASTA_NEUTRA = mkdtempSync(join(tmpdir(), 'devocional-'));

/**
 * O ambiente do CLI, com o proxy corporativo repassado.
 *
 * `aplicarProxy()` não serve aqui: ele troca o dispatcher do undici, que vale
 * só para o `fetch` deste processo. O `claude` é outro processo e sai pela rede
 * por conta própria — lê `HTTPS_PROXY` do ambiente e nada mais.
 *
 * Sem isso o comportamento depende de onde o script foi chamado: num terminal
 * que já tenha a variável exportada funciona, num terminal limpo o CLI volta
 * 407 em poucos segundos, com o erro no stdout e o stderr vazio. Foi
 * exatamente esse o sintoma que custou um lote inteiro.
 *
 * Aqui a URL leva a senha percent-encoded, ao contrário do header Basic do
 * undici: é a forma `http://user:pass@host:porta` que o CLI espera.
 */
function ambienteDoCli(): NodeJS.ProcessEnv {
  const proxy = urlDoProxy();
  if (!proxy) return process.env;

  return { ...process.env, HTTP_PROXY: proxy, HTTPS_PROXY: proxy };
}

/**
 * O que de fato deu errado, em uma linha legível.
 *
 * O CLI descreve a falha no **stdout**, num envelope JSON, e deixa o stderr
 * vazio — ler só o stderr produzia `CLI saiu com código 1:` e mais nada. E o
 * envelope é longo: truncar o começo mostra `is_error`, `session_id` e
 * contadores zerados, nunca a frase que explica o motivo. Ela vive no campo
 * `result`, lá no fim.
 */
function motivoDaFalha(saida: string, erro: string): string {
  try {
    const envelope = JSON.parse(saida) as { result?: string; error?: string };
    const texto = envelope.result || envelope.error;
    if (texto) return texto.slice(0, 400);
  } catch {
    // Não era JSON — cai para a saída crua.
  }

  return [erro.trim(), saida.trim()].filter(Boolean).join(' | ').slice(0, 400) || '(sem mensagem)';
}

/**
 * Os argumentos do CLI.
 *
 * `--strict-mcp-config` sem nenhum `--mcp-config` desliga **todos** os MCP.
 * Não é detalhe: a pasta neutra evita o CLAUDE.md do projeto, mas as settings
 * do usuário continuam valendo, e com elas entram firecrawl, playwright e
 * context7 — dezenas de definições de ferramenta, reenviadas a cada chamada.
 *
 * Escrever devocional não usa ferramenta nenhuma. Medido numa chamada com os
 * MCP ligados: ~30k tokens de entrada, dos quais só ~3k eram o nosso prompt.
 * O resto era catálogo de ferramenta que o modelo jamais usaria.
 */
const ARGUMENTOS = [
  '-p',
  '--output-format',
  'json',
  '--model',
  MODELO,
  '--strict-mcp-config',
];

/**
 * O prompt vai pelo stdin, não como argumento.
 *
 * Passar um texto de milhares de caracteres, com quebras de linha e aspas, na
 * linha de comando do Windows não sobrevive: o CLI recebia vazio e respondia
 * "Fala. Que precisa?". Pelo stdin não há o que escapar.
 */
function pedirAoClaude(prompt: string): Promise<{ texto: string; gasto: Gasto }> {
  return new Promise((resolver, rejeitar) => {
    const processo = spawn('claude', ARGUMENTOS, {
      cwd: PASTA_NEUTRA,
      env: ambienteDoCli(),
      shell: true,
      timeout: TEMPO_LIMITE_MS,
    });

    // Sem isto, `saida += pedaco` converte cada chunk em string por conta
    // própria, e um caractere multi-byte partido na fronteira entre dois
    // chunks vira "�": "século" saiu "s�culo" e a referência "2 Coríntios"
    // deixou de casar com a ACF. O setEncoding segura o byte pela metade até
    // o chunk seguinte completar o caractere.
    processo.stdout.setEncoding('utf8');
    processo.stderr.setEncoding('utf8');

    let saida = '';
    let erro = '';
    processo.stdout.on('data', (pedaco) => (saida += pedaco));
    processo.stderr.on('data', (pedaco) => (erro += pedaco));

    processo.on('error', rejeitar);
    processo.on('close', (codigo) => {
      if (codigo !== 0) {
        return rejeitar(new Error(`CLI saiu com código ${codigo}: ${motivoDaFalha(saida, erro)}`));
      }

      try {
        const envelope = JSON.parse(saida) as {
          is_error?: boolean;
          result?: string;
          usage?: {
            input_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
            output_tokens?: number;
          };
        };
        if (envelope.is_error || !envelope.result) {
          return rejeitar(new Error(`CLI devolveu erro: ${motivoDaFalha(saida, erro)}`));
        }

        const u = envelope.usage ?? {};
        resolver({
          texto: envelope.result,
          gasto: {
            // Cache criado e cache lido contam: os dois são entrada, e é a
            // soma que consome a cota da assinatura.
            entrada:
              (u.input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0),
            saida: u.output_tokens ?? 0,
          },
        });
      } catch (e) {
        rejeitar(new Error(`resposta do CLI não é JSON: ${saida.slice(0, 200)}`));
      }
    });

    processo.stdin.write(prompt);
    processo.stdin.end();
  });
}

/**
 * Reconhece o fim da cota da assinatura.
 *
 * A mensagem vem em inglês, do próprio CLI, e traz a hora do reset:
 * `You've hit your session limit · resets 12:30pm (America/Sao_Paulo)`.
 *
 * Isso não é falha de um item: nenhum dos seguintes vai passar. Insistir só
 * gasta tempo, então o lote para na primeira, sem esperar as três seguidas.
 */
function eLimiteDaConta(motivo: string): boolean {
  return /\b(session|usage|rate) limit\b/i.test(motivo);
}


/**
 * Resolve `2027-6` no tema daquele mês. Aceita também o uuid direto, que é o
 * que a API devolve.
 */
async function acharTema(argumento: string) {
  const anoMes = argumento.match(/^(\d{4})-(\d{1,2})$/);

  const tema = anoMes
    ? await connection.temaMes.findUnique({
        where: { ano_mes: { ano: Number(anoMes[1]), mes: Number(anoMes[2]) } },
        select: { id: true, ano: true, mes: true, tema: true },
      })
    : await connection.temaMes.findUnique({
        where: { id: argumento },
        select: { id: true, ano: true, mes: true, tema: true },
      });

  if (!tema) {
    throw new Error(
      `Nenhum tema em "${argumento}". Use ano-mês, como 2027-6, ` +
        `e rode \`npm run seed:temas -- 2027\` se o ano ainda não foi semeado.`,
    );
  }

  return tema;
}

/**
 * O motor do CLI, que só existe aqui.
 *
 * O serviço de escrita não o conhece de propósito: ele roda também dentro do
 * servidor, e lá não há `claude` instalado nem sessão para autenticar. Quem
 * quiser o Claude passa por este script, com `--cli`.
 */
function motorDoClaude(): Motor {
  return {
    nome: `CLI ${MODELO}`,
    escrever: pedirAoClaude,
    tentativas: 2,
  };
}

async function main() {
  const limite = Number(process.argv[2]) || LOTE_PADRAO;
  const alvo = process.argv[3]?.startsWith('--') ? undefined : process.argv[3];

  // O pregador é padrão, não opção: esquecer a flag uma vez colocaria pregação
  // de outra pessoa dentro do livro do Nélio. `--todos` abre para o acervo
  // inteiro, para quando a geração não for para este livro.
  const pedido = process.argv.indexOf('--pregador');
  const pregador = process.argv.includes('--todos')
    ? null
    : await acharPregador(pedido > -1 ? (process.argv[pedido + 1] ?? '') : PREGADOR_DO_LIVRO);

  // Motor: API se houver chave configurada, CLI caso contrário. `--cli` força
  // o Claude mesmo com chaves no ambiente, para comparar os dois lado a lado.
  const provedores = await provedoresDisponiveis();
  const motor =
    provedores.length > 0 && !process.argv.includes('--cli')
      ? await motorDeApi(provedores)
      : motorDoClaude();
  logInfo(`motor: ${motor.nome}`, 'devocional');

  const chavesDaGroq = provedores.find((p) => p.nome === 'groq')?.chaves.length ?? 0;
  const pausa = pausaEntreItens(chavesDaGroq);
  if (chavesDaGroq > 0) {
    const porMinuto = Math.floor((chavesDaGroq * TOKENS_POR_MINUTO_POR_CHAVE) / CUSTO_DE_UM_DEVOCIONAL);
    logInfo(
      `${chavesDaGroq} chaves rendem ~${porMinuto}/min; pausa de ${(pausa / 1000).toFixed(1)}s entre itens` +
        (pausa === 0 ? ' (a geração sozinha já segura o ritmo)' : ''),
      'devocional',
    );
  }

  const pendentes = await connection.resenha.count({ where: { devocional: null } });
  logInfo(`${pendentes} resenhas ainda sem devocional; gerando ${Math.min(limite, pendentes)}`, 'devocional');

  let fila;
  if (alvo) {
    const tema = await acharTema(alvo);
    fila = (await filaDoTema(tema.id, limite, pregador?.id)).fila;
    logInfo(
      `por afinidade com ${MESES[tema.mes - 1]}/${tema.ano} — "${tema.tema}"` +
        (pregador ? `, só de ${pregador.nomeCanonico}` : ''),
      'devocional',
    );
  } else {
    fila = await filaDeGeracao(limite, pregador?.id);
    logInfo(`das mais recentes${pregador ? `, só de ${pregador.nomeCanonico}` : ''}`, 'devocional');
  }

  // Conferir antes de gastar: 20 devocionais são ~560k tokens de entrada, mais
  // do que cabe numa janela da assinatura. Ver a lista custa zero.
  if (process.argv.includes('--listar')) {
    for (const [i, r] of fila.entries()) {
      logInfo(`${String(i + 1).padStart(3)}. ${r.titulo}`, 'devocional');
    }
    logSuccess(`${fila.length} na fila — nada gerado, isto foi só a lista`, 'devocional');
    return;
  }
  let feitos = 0;
  let seguidas = 0;
  let entrada = 0;
  let saidaTokens = 0;
  const falhas: string[] = [];

  for (const [i, item] of fila.entries()) {
    const resenha = await comoPedido(item);

    // Ritmo, e não velocidade máxima.
    //
    // Sem isto o lote roda **acima da capacidade**: são 40.000 tokens por
    // minuto somando as cinco chaves, e cada devocional custa ~4.300 — logo
    // cabem nove por minuto. Indo a catorze, o colchão do rodízio segura por
    // uns oitenta itens e depois as cinco chaves caem juntas em 429, a espera
    // de 65s não resolve porque a demanda continua acima da oferta, e o lote
    // aborta por três falhas seguidas. Foi o que aconteceu no item 85 de 626.
    // Quem segura o ritmo é o `retry-after` do provedor, dentro do rodízio:
    // chave que levou 429 fica de castigo pelo tempo que ela mesma pediu.
    // A pausa aqui é só o piso configurável, para quem rodar dois lotes.
    if (i > 0 && pausa > 0) await new Promise((r) => setTimeout(r, pausa));

    logInfo(`[${i + 1}/${fila.length}] ${resenha.titulo.slice(0, 55)}`, 'devocional');

    try {
      const gasto = await escreverUm(resenha, motor);
      entrada += gasto.entrada;
      saidaTokens += gasto.saida;
      feitos++;
      seguidas = 0;
    } catch (e) {
      // Uma falha não derruba o lote: o resto continua, e esta volta na
      // próxima execução, porque a fila é "resenha sem devocional".
      const motivo = (e as Error).message.slice(0, 400);
      falhas.push(`${resenha.titulo.slice(0, 40)}: ${motivo}`);
      seguidas++;

      // Na hora, não só no fim: guardar o motivo para o resumo final já custou
      // um lote inteiro rodando às cegas com a conta sem uso disponível.
      logWarning(`falhou: ${motivo}`, 'devocional');

      if (eLimiteDaConta(motivo)) {
        logError(
          `cota da assinatura esgotada — o lote parou aqui. ` +
            `Os ${feitos} já gravados ficam; a fila retoma sozinha depois do reset.`,
          'devocional',
        );
        break;
      }

      if (eCotaDiaria(motivo)) {
        logError(
          `cota diária da Groq esgotada — são 200.000 tokens por dia em cada chave, ` +
            `uns 44 devocionais. Os ${feitos} gravados ficam e a fila retoma amanhã.`,
          'devocional',
        );
        break;
      }

      if (seguidas >= FALHAS_SEGUIDAS_PARA_ABORTAR) {
        // A mensagem falava em conferir a conta do CLI mesmo quando o motor
        // era a API — e mandava olhar no lugar errado justamente na hora em
        // que a pessoa precisa saber onde olhar.
        logError(
          `${seguidas} falhas seguidas — o lote parou. Os ${feitos} gravados ficam e a fila ` +
            `retoma de onde parou. Se foram 429, aumente DEVOCIONAIS_PAUSA_MS ou espere alguns ` +
            `minutos: o limite da Groq é por minuto, não por dia.`,
          'devocional',
        );
        break;
      }
    }
  }

  logSuccess(`${feitos} devocionais escritos`, 'devocional');

  // O que decide quantos cabem numa janela da assinatura é o custo por
  // devocional, não o número de itens. Sem medir, não dá para planejar o lote.
  if (feitos > 0) {
    const porItem = Math.round(entrada / feitos);
    logInfo(
      `${entrada.toLocaleString('pt-BR')} tokens de entrada e ` +
        `${saidaTokens.toLocaleString('pt-BR')} de saída — ` +
        `${porItem.toLocaleString('pt-BR')} de entrada por devocional`,
      'devocional',
    );
  }

  if (falhas.length > 0) {
    logWarning(`${falhas.length} falharam e voltam na próxima execução`, 'devocional', falhas);
  }
}

main()
  .catch((e) => {
    logError((e as Error).message, 'devocional');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
