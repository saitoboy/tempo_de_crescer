import connection from '../connection';
import {
  comoCorrecao,
  comoPedido,
  extrairJson,
  filaDeGeracao,
  guardarDevocional,
  montarPrompt,
  respostaDoModelo,
  type ResenhaParaDevocional,
} from './devocional';
import { comoCorrecaoDeFidelidade, conferirFidelidade } from './fidelidade';
import { escrever as escreverPorApi, provedoresDoAmbiente } from './provedores';
import { logInfo, logSuccess, logWarning } from '../utils/logger';

/**
 * Escrever devocional, sem depender de quem chama.
 *
 * Nasceu dentro do script de lote, e saiu de lá quando a geração passou a ser
 * possível **em produção**. Isso mudou com a API aberta: o CLI do Claude
 * autentica com a sessão da máquina de quem escreve, e por isso o contêiner
 * nunca conseguiu gerar; uma chave de API não tem esse problema.
 *
 * O que **não** mudou: o texto só vira página impressa depois da leitura do
 * pastor. A geração automática enche a fila em `status: GERADO`; publicar
 * continua sendo decisão humana.
 */

const CONTEXTO = 'devocional';

/** O que uma chamada custou. */
export type Gasto = { entrada: number; saida: number };

/**
 * Quem escreve o texto.
 *
 * O motor não muda mais nada: prompt, validação, retentativa e gravação são os
 * mesmos. Quem decide se o texto presta é o Zod e a conferência contra a ACF,
 * não o provedor.
 */
export type Motor = {
  nome: string;
  escrever(prompt: string): Promise<{ texto: string; gasto: Gasto }>;
  /**
   * Quantas vezes tentar o mesmo devocional.
   *
   * Pela API aberta a retentativa é de graça, então cabe uma a mais: uma para
   * o formato (o Zod recusando tamanho) e outra para a fidelidade (citação
   * fora da ACF). Pelo CLI cada tentativa custa uma fatia da assinatura.
   */
  tentativas: number;
};

export function motorDeApi(provedores = provedoresDoAmbiente()): Motor {
  if (provedores.length === 0) {
    throw new Error('Nenhum provedor configurado — defina GROQ_API_KEYS ou NVIDIA_API_KEYS');
  }

  return {
    nome: provedores.map((p) => `${p.nome}/${p.modelo} (${p.chaves.length} chaves)`).join(' → '),
    tentativas: 3,
    async escrever(prompt: string) {
      const r = await escreverPorApi(provedores, prompt);
      return { texto: r.texto, gasto: { entrada: r.entrada, saida: r.saida } };
    },
  };
}

/**
 * Recusa por fidelidade, não por formato.
 *
 * O Zod devolve `ZodError`, e `comoCorrecao` sabe traduzi-lo. A citação fora da
 * ACF já vem com a instrução pronta, e passá-la pelo mesmo tradutor a
 * transformaria em "a resposta não era JSON" — mandando o modelo consertar o
 * que não está quebrado.
 */
export class NaoConfere extends Error {}

/** A recusa em uma linha, para o log dizer o que houve. */
function resumirRecusa(erro: unknown): string {
  const issues = (erro as { issues?: Array<{ path: PropertyKey[]; message: string }> })?.issues;

  if (Array.isArray(issues)) {
    return issues.map((i) => `${i.path.join('.') || 'raiz'}: ${i.message}`).join('; ').slice(0, 160);
  }

  return (erro as Error)?.message?.slice(0, 160) ?? String(erro);
}

/**
 * Escreve um devocional e grava.
 *
 * A citação fora da ACF derruba a tentativa e regera, com a correção dizendo
 * exatamente o que foi inventado. Medido: dois modelos abertos inventaram a
 * **mesma** frase na mesma resenha — "na casa do Pai ainda há lugar", atribuída
 * a Jesus. O título da pregação induz a invenção, então repetir o prompt
 * intacto tenderia a repeti-la.
 *
 * Na última tentativa grava assim mesmo, avisando. A conferência não separa
 * invenção de citação em outra tradução — os números se cruzam — e travar a
 * fila por uma medida que reconhecidamente erra sairia pior. A página só vai
 * impressa depois da leitura do pastor.
 */
export async function escreverUm(
  resenha: ResenhaParaDevocional,
  motor: Motor,
  /** Regeração: substitui o devocional que já existe para esta resenha. */
  sobrescrever = false,
): Promise<Gasto> {
  const gasto: Gasto = { entrada: 0, saida: 0 };
  let recusa: unknown;

  for (let tentativa = 1; tentativa <= motor.tentativas; tentativa++) {
    const correcao =
      tentativa === 1
        ? undefined
        : recusa instanceof NaoConfere
          ? recusa.message
          : comoCorrecao(recusa);

    // Erro do motor (cota, proxy, rede) sobe daqui e não é retentado: nenhuma
    // repetição resolveria, e o lote tem seu próprio tratamento.
    const { texto, gasto: custo } = await motor.escrever(montarPrompt(resenha, correcao));
    gasto.entrada += custo.entrada;
    gasto.saida += custo.saida;

    try {
      const resposta = respostaDoModelo.parse(extrairJson(texto));

      const suspeitas = await conferirFidelidade({
        reflexao: resposta.reflexao,
        oracao: resposta.oracao,
      });

      if (suspeitas.length > 0 && tentativa < motor.tentativas) {
        recusa = new NaoConfere(comoCorrecaoDeFidelidade(suspeitas));
        logWarning(
          `citação fora da ACF: "${suspeitas[0].trecho.slice(0, 70)}" — regerando`,
          CONTEXTO,
        );
        continue;
      }

      const devocional = await guardarDevocional(resenha.id, resposta, motor.nome, sobrescrever);

      logSuccess(`"${devocional.titulo}" — ${devocional.referencia}`, CONTEXTO);
      if (!devocional.versiculo) {
        logWarning(`referência "${devocional.referencia}" não resolveu na ACF`, CONTEXTO);
      }
      for (const s of suspeitas) {
        logWarning(`para o pastor conferir: "${s.trecho.slice(0, 90)}"`, CONTEXTO);
      }

      return gasto;
    } catch (e) {
      recusa = e;
      if (tentativa < motor.tentativas) {
        // Com o motivo junto. "resposta recusada" sozinho não diz se foi
        // tamanho, formato ou JSON quebrado — e sem isso não dá para saber se
        // o prompt precisa de ajuste ou se é o acaso de sempre.
        logWarning(
          `recusada (${tentativa}/${motor.tentativas}): ${resumirRecusa(e)}`,
          CONTEXTO,
        );
      }
    }
  }

  throw recusa;
}

export type ResultadoDaEscrita = {
  escritos: number;
  falhas: string[];
  entrada: number;
  saida: number;
};

/**
 * Escreve as `limite` resenhas mais recentes que ainda não têm devocional.
 *
 * É a fila do dia a dia, não a do livro: são três cultos por semana, e manter
 * o acervo em dia pede lotes pequenos e frequentes. Montar um mês do livro é
 * outra coisa — usa `filaDoTema`, pelo script, com a curadoria junto.
 */
export async function escreverPendentes(
  limite: number,
  pregadorId?: string,
  motor = motorDeApi(),
): Promise<ResultadoDaEscrita> {
  const fila = await filaDeGeracao(limite, pregadorId);
  const resultado: ResultadoDaEscrita = { escritos: 0, falhas: [], entrada: 0, saida: 0 };

  for (const item of fila) {
    try {
      const gasto = await escreverUm(await comoPedido(item), motor);
      resultado.escritos++;
      resultado.entrada += gasto.entrada;
      resultado.saida += gasto.saida;
    } catch (e) {
      resultado.falhas.push(`${item.titulo.slice(0, 40)}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  return resultado;
}

/** Quem é o pregador do livro, resolvido pelo nome canônico ou por alias. */
export async function acharPregador(nome: string) {
  const pregador = await connection.pregador.findFirst({
    where: {
      OR: [{ nomeCanonico: { equals: nome, mode: 'insensitive' } }, { aliases: { has: nome.toLowerCase() } }],
    },
    select: { id: true, nomeCanonico: true },
  });

  if (!pregador) throw new Error(`Pregador "${nome}" não está no cadastro`);
  return pregador;
}

export function relatarGasto(r: ResultadoDaEscrita): void {
  if (r.escritos === 0) return;

  logInfo(
    `${r.entrada.toLocaleString('pt-BR')} tokens de entrada e ${r.saida.toLocaleString('pt-BR')} de saída — ` +
      `${Math.round(r.entrada / r.escritos).toLocaleString('pt-BR')} de entrada por devocional`,
    CONTEXTO,
  );
}
