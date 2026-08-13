import { z } from 'zod';
import connection from '../connection';
import { comoConsulta, maisParecidos } from './vetores';

/**
 * Transforma a resenha de um culto em devocional para o livro.
 *
 * O texto é escrito pelo Claude Opus, chamado pelo CLI local — a assinatura em
 * vez da chave de API. Groq com llama foi testado e descartado: texto fraco.
 *
 * Duas regras que valem mais que a qualidade da prosa:
 *
 * 1. **O versículo nunca é escrito pelo modelo.** Ele indica a referência; o
 *    texto vem da tabela `Versiculo`, que tem a ACF inteira. Modelo citando
 *    Escritura de memória erra palavra, e num livro devocional isso é grave.
 * 2. **O devocional nasce da resenha, não do nada.** O que ele diz tem de ser
 *    o que foi pregado naquele culto, não teologia genérica sobre a passagem.
 */

/** Os blocos da página do livro — ver CONTEXTO/modelo-pagina.jpeg. */
export const respostaDoModelo = z.object({
  // Acima de ~34 o título quebra em duas linhas e empurra a página para fora.
  titulo: z.string().trim().min(3).max(48),
  /** Referência do versículo em destaque: "Salmos 23:1". */
  referencia: z.string().trim().min(3).max(60),
  /**
   * O teto foi medido na página A5 renderizada, não estimado: com os blocos
   * fixos ocupando 501px dos 695px úteis, sobram 194px para a reflexão, o que
   * dá cerca de 1.250 caracteres. O limite fica abaixo disso para o texto não
   * encostar no rodapé.
   */
  reflexao: z.string().trim().min(200).max(1050),
  pontosAplicacao: z.array(z.string().trim().min(10)).min(3).max(4),
  oracao: z.string().trim().min(50),
});

export type RespostaDoModelo = z.infer<typeof respostaDoModelo>;

export type ResenhaParaDevocional = {
  id: string;
  titulo: string;
  conteudoLimpo: string;
  textoBase: string | null;
  pregador: string | null;
  doutrina: string | null;
};

const ESTILO = `Você escreve devocionais no estilo de A.W. Tozer, em português do Brasil.

O que caracteriza esse estilo:
- Abre pelo peso teológico do texto, não por anedota nem por pergunta retórica.
- Fala com a igreja: "meus irmãos", "nossa vida", segunda pessoa do plural.
- Frases curtas e afirmativas. Exclamação usada de verdade, com moderação.
- Sustenta a afirmação com outra passagem bíblica, citada e referenciada.
- Não modera o que a Escritura afirma nem suaviza contraste doutrinário.
- Nada de linguagem corporativa, autoajuda ou motivacional.`;

/**
 * Monta o pedido.
 *
 * A resenha vai inteira: é dela que o devocional tem de nascer. O modelo não
 * escreve o versículo — só indica a referência, e o texto vem do banco.
 */
export function montarPrompt(resenha: ResenhaParaDevocional): string {
  const contexto = [
    `Título da pregação: ${resenha.titulo}`,
    resenha.textoBase ? `Texto base: ${resenha.textoBase}` : null,
    resenha.pregador ? `Pregador: ${resenha.pregador}` : null,
    resenha.doutrina ? `Doutrina predominante: ${resenha.doutrina}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${ESTILO}

Abaixo está a resenha de uma pregação da Igreja Batista do Parque Safira.
Escreva um devocional para a página de um livro, fiel ao que foi pregado —
não teologia genérica sobre a passagem, mas o que esta mensagem disse.

${contexto}

--- RESENHA ---
${resenha.conteudoLimpo}
--- FIM DA RESENHA ---

Responda SOMENTE com JSON válido, sem cercas de código e sem comentário:

{
  "titulo": "título curto e forte, até 34 caracteres, para caber em UMA linha",
  "referencia": "a referência do versículo que resume a mensagem, ex: Salmos 23:1",
  "reflexao": "2 a 3 parágrafos, 800 a 950 caracteres NO TOTAL, separados por \\n\\n",
  "pontosAplicacao": ["exatamente 3 aplicações, uma linha curta cada, no imperativo"],
  "oracao": "oração curta, primeira pessoa do PLURAL, 180 a 260 caracteres"
}

Os limites de tamanho são rígidos: tudo isso precisa caber em UMA página A5
impressa, junto com o versículo, o QR code e um espaço para anotações. Texto
mais longo do que o pedido não cabe e será cortado.

A "referencia" deve ser um único versículo ou um trecho curto de um capítulo
só, e precisa existir na Bíblia. Não escreva o texto do versículo: apenas a
referência.`;
}

/** O modelo às vezes embrulha o JSON em cercas, mesmo quando pedimos que não. */
export function extrairJson(saida: string): unknown {
  const semCercas = saida
    .replace(/^[\s\S]*?```(?:json)?\s*/m, (trecho) => (trecho.includes('```') ? '' : trecho))
    .replace(/```[\s\S]*$/m, '')
    .trim();

  const candidato = semCercas.startsWith('{') ? semCercas : saida.slice(saida.indexOf('{'));
  return JSON.parse(candidato);
}

/**
 * Resolve a referência em texto bíblico de verdade, vindo da ACF no banco.
 *
 * Aceita "Salmos 23:1" e "Salmos 23:1-3". Faixa vira um texto só, com os
 * versículos emendados — é como aparece impresso na página.
 */
export async function buscarVersiculo(referencia: string): Promise<string | null> {
  const m = referencia.match(/^\s*(.+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?\s*$/);
  if (!m) return null;

  const [, nomeLivro, capitulo, primeiro, ultimo] = m;
  const alvo = nomeLivro
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s/g, '');

  const livros = await connection.livroBiblico.findMany({ select: { id: true, nome: true } });
  const livro = livros.find(
    (l) =>
      l.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s/g, '') === alvo,
  );
  if (!livro) return null;

  const versiculos = await connection.versiculo.findMany({
    where: {
      livroId: livro.id,
      capitulo: Number(capitulo),
      numero: { gte: Number(primeiro), lte: Number(ultimo ?? primeiro) },
    },
    orderBy: { numero: 'asc' },
    select: { texto: true },
  });

  return versiculos.length > 0 ? versiculos.map((v) => v.texto).join(' ') : null;
}

/**
 * As resenhas que ainda não viraram devocional. É a fila, e não um status.
 *
 * **Resenha sem data fica de fora.** No Postgres, `ORDER BY data DESC` põe os
 * NULL primeiro, e a fila estava servindo justamente as 297 sem data — que são
 * as piores candidatas: sem data não há culto, sem culto não há QR code, e a
 * página do livro sai sem os dois. Elas voltam à fila depois que a curadoria
 * manual preencher a data.
 *
 * A ordem decrescente também é intencional: o canal do YouTube só começou a
 * transmitir em 2020, então as pregações recentes são as que têm culto casado
 * e QR code. Começar pelas novas rende página completa desde o primeiro lote.
 */
export function filaDeGeracao(limite: number) {
  return connection.resenha.findMany({
    where: PENDENTES,
    orderBy: [{ dataPregacao: 'desc' }],
    take: limite,
    select: CAMPOS_DA_FILA,
  });
}

/** Quem ainda não virou devocional e tem material para virar. */
const PENDENTES = {
  devocional: null,
  conteudoLimpo: { not: '' },
  dataPregacao: { not: null },
} as const;

const CAMPOS_DA_FILA = {
  id: true,
  titulo: true,
  conteudoLimpo: true,
  textoBase: true,
  pregador: { select: { nomeCanonico: true } },
  classificacoes: {
    where: { papel: 'PRINCIPAL' as const },
    select: { doutrina: { select: { nome: true } } },
  },
} as const;

/**
 * A fila de um mês do livro: as resenhas cujo texto mais se parece com o tema.
 *
 * Existe porque gerar a fila inteira não é viável. Cada devocional custa ~28k
 * tokens de entrada, e a cota da assinatura rende cerca de 18 por janela — mil
 * resenhas levariam meses. Mas o livro não precisa de mil: precisa das doze
 * dúzias que o pastor vai montar. Gerar o que vai ser usado, e só isso.
 *
 * A ordenação é a mesma da curadoria (`porSemelhanca`), com o alvo invertido:
 * lá a busca é sobre quem **já tem** devocional, para escolher a página; aqui é
 * sobre quem **ainda não tem**, para escrevê-la.
 *
 * A comparação é sobre o vetor da resenha, não do devocional — que nem existe
 * ainda. É a pregação inteira que carrega o assunto.
 */
export async function filaDoTema(temaMesId: string, limite: number, pregadorId?: string) {
  const tema = await connection.temaMes.findUnique({
    where: { id: temaMesId },
    select: { tema: true, descricao: true },
  });
  if (!tema) throw new Error(`Tema ${temaMesId} não encontrado`);

  const consulta = await comoConsulta([tema.tema, tema.descricao].filter(Boolean).join('. '));

  // Só id e vetor: trazer o conteúdo de mil resenhas para ordenar seria
  // carregar megabytes de texto e descartar quase tudo.
  const candidatas = await connection.resenha.findMany({
    where: { ...PENDENTES, ...(pregadorId ? { pregadorId } : {}) },
    select: { id: true, embedding: true },
  });

  const ranking = maisParecidos(consulta, candidatas, limite);

  const resenhas = await connection.resenha.findMany({
    where: { id: { in: ranking.map((r) => r.id) } },
    select: CAMPOS_DA_FILA,
  });

  // O `IN` volta em ordem de banco; a de afinidade é a que importa.
  const porId = new Map(resenhas.map((r) => [r.id, r]));
  return {
    tema: tema.tema,
    fila: ranking.map((r) => porId.get(r.id)!).filter(Boolean),
  };
}

export async function guardarDevocional(
  resenhaId: string,
  resposta: RespostaDoModelo,
  modelo: string,
) {
  return connection.devocional.create({
    data: {
      resenhaId,
      titulo: resposta.titulo,
      referencia: resposta.referencia,
      // Da ACF no banco, nunca do modelo.
      versiculo: await buscarVersiculo(resposta.referencia),
      reflexao: resposta.reflexao,
      pontosAplicacao: resposta.pontosAplicacao,
      oracao: resposta.oracao,
      modelo,
    },
  });
}
