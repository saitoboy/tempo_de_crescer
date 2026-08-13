import { aplicarProxy } from '../utils/proxy';

/**
 * Busca semântica sobre o acervo.
 *
 * Existe por causa dos temas que não são doutrina: "Novos Recomeços",
 * "As Mulheres da Bíblia", "Família", "Novas Gerações". A classificação de
 * Grudem não os cobre, mas o significado do texto sim — uma pregação sobre
 * arrependimento e conversão *se parece* com "novos recomeços", ainda que não
 * use a palavra.
 *
 * O modelo roda local, pelo transformers.js: nada sai da máquina, não há chave
 * nem custo por uso. São 384 dimensões e cerca de 9 ms por texto.
 */

/**
 * Modelo multilíngue, treinado com português entre as línguas.
 *
 * O e5 distingue consulta de documento por prefixo, e usar o prefixo errado
 * degrada a busca de forma silenciosa — por isso `comoConsulta` e
 * `comoDocumento` existem separados, em vez de um parâmetro solto.
 */
const MODELO = 'Xenova/multilingual-e5-small';

/** O modelo trunca em 512 tokens; o resto do texto seria ignorado em silêncio. */
const LIMITE_DE_CARACTERES = 1600;

export const DIMENSOES = 384;

type Extrator = (
  texto: string,
  opcoes: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array | number[] }>;

let extrator: Extrator | null = null;

/**
 * Carrega o modelo uma vez por processo.
 *
 * O download inicial passa pelo proxy corporativo; depois fica em cache no
 * disco e a carga é instantânea.
 */
async function carregar(): Promise<Extrator> {
  if (extrator) return extrator;

  aplicarProxy();
  // Import dinâmico: o pacote é ESM e o projeto é CommonJS.
  const { pipeline } = await import('@xenova/transformers');
  extrator = (await pipeline('feature-extraction', MODELO)) as unknown as Extrator;
  return extrator;
}

async function vetorizar(texto: string): Promise<number[]> {
  const extrair = await carregar();
  const saida = await extrair(texto.slice(0, LIMITE_DE_CARACTERES), {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(saida.data);
}

/** O que se procura. */
export function comoConsulta(texto: string): Promise<number[]> {
  return vetorizar(`query: ${texto}`);
}

/** O que está no acervo. */
export function comoDocumento(texto: string): Promise<number[]> {
  return vetorizar(`passage: ${texto}`);
}

/**
 * Semelhança entre dois vetores, de 0 a 1.
 *
 * Como o modelo já devolve vetores normalizados, o cosseno é o produto
 * escalar puro — não precisa dividir pelas normas.
 */
export function semelhanca(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let produto = 0;
  for (let i = 0; i < a.length; i++) produto += a[i] * b[i];

  // O produto pode escapar de [-1, 1] por arredondamento; a porcentagem
  // exibida não pode passar de 100.
  return Math.min(Math.max(produto, -1), 1);
}

/**
 * Reescala as semelhanças do conjunto encontrado para 0 a 100.
 *
 * O cosseno deste modelo se agrupa alto: **tudo** fica entre 85% e 90%, e o
 * número absoluto não informa nada a quem escolhe. O que vale é a ordem.
 *
 * Aqui o melhor do conjunto vira 100 e o pior vira 0, então a porcentagem
 * responde à pergunta certa: "quanto este se aproxima do tema, comparado aos
 * outros que apareceram". Um conjunto todo ruim continua com um 100 no topo —
 * por isso a ordem, e não o número, é que deve guiar a escolha.
 */
export function emAfinidade(valores: number[]): number[] {
  if (valores.length === 0) return [];

  const maior = Math.max(...valores);
  const menor = Math.min(...valores);
  const faixa = maior - menor;

  // Todos iguais: não há o que distinguir.
  if (faixa < 1e-9) return valores.map(() => 100);

  return valores.map((v) => Number((((v - menor) / faixa) * 100).toFixed(1)));
}

/**
 * O texto da resenha que vai virar vetor.
 *
 * Título e texto base entram primeiro porque são o resumo da mensagem — se a
 * truncagem cortar algo, que corte o meio do corpo, não o assunto.
 */
export function textoParaVetor(r: {
  titulo: string;
  textoBase: string | null;
  conteudoLimpo: string;
}): string {
  return [r.titulo, r.textoBase, r.conteudoLimpo].filter(Boolean).join('. ');
}

export type Semelhante = { id: string; semelhanca: number };

/**
 * Os `k` mais parecidos com a consulta.
 *
 * A busca é em memória de propósito: 1.409 vetores de 384 dimensões dão 4 MB,
 * e percorrer isso custa milissegundos. Um índice vetorial no banco só passa a
 * compensar com dezenas de milhares de registros.
 */
export function maisParecidos(
  consulta: number[],
  acervo: Array<{ id: string; embedding: number[] }>,
  k: number,
): Semelhante[] {
  return acervo
    .filter((item) => item.embedding.length === consulta.length)
    .map((item) => ({ id: item.id, semelhanca: semelhanca(consulta, item.embedding) }))
    .sort((a, b) => b.semelhanca - a.semelhanca)
    .slice(0, k);
}
