import { AMBIGUAS, MARCADORES, PESOS, type Peso } from './marcadores';
export { AMBIGUAS };

/**
 * Classificação teológica por score relativo ao corpus.
 *
 * O problema que isto resolve: **uma pregação pode citar Jesus do começo ao
 * fim sem ser sobre cristologia.** Contagem absoluta de marcadores erra nesse
 * caso, e era o defeito do classificador antigo.
 *
 * A saída é dizer que a pregação é "sobre" a doutrina X quando a densidade de
 * marcadores de X está anormalmente alta **em relação à média do corpus** — e
 * não quando a contagem bruta é a maior. Como toda pregação cita Jesus, a média
 * de cristologia já é alta, e citar Jesus muito produz z ≈ 0: é o comportamento
 * normal do corpus, não sinal.
 *
 * Efeito colateral bom: com z-score, manter palavras genéricas no vocabulário
 * deixa de ser problema — elas se anulam sozinhas pela média alta.
 */

/** Desvios acima da média para uma doutrina virar tema secundário. */
export const MINIMO_SECUNDARIO = 1.0;
/** Abaixo disso, nem o primeiro colocado convence: o tema fica indefinido. */
export const MINIMO_PRINCIPAL = 0.5;
/** Quantos secundários no máximo. */
export const MAXIMO_SECUNDARIOS = 2;
/** O título pesa mais que o corpo: é onde o pregador resume a mensagem. */
export const PESO_DO_TITULO = 3;

export const DOUTRINAS = Object.keys(MARCADORES).map(Number);

/** Minúsculas, sem acento — o corpus mistura as duas formas o tempo todo. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function contar(texto: string, expressao: string): number {
  if (!expressao) return 0;
  let total = 0;
  let posicao = texto.indexOf(expressao);
  while (posicao !== -1) {
    total++;
    posicao = texto.indexOf(expressao, posicao + expressao.length);
  }
  return total;
}

/**
 * Para onde vai uma expressão que serve a mais de uma doutrina.
 *
 * Vence a doutrina cujo contexto aparece no texto. Sem contexto nenhum, a
 * expressão é descartada: perder o sinal é melhor que dá-lo a quem não é.
 */
function desambiguar(texto: string, expressao: string): number | null {
  const regra = AMBIGUAS.find((a) => a.expressao === expressao);
  if (!regra) return null;

  for (const destino of regra.destinos) {
    if (destino.contexto.some((pista) => texto.includes(pista))) return destino.doutrina;
  }
  return null;
}

export type Densidades = Record<number, number>;

/**
 * Densidade de cada doutrina num texto: marcadores ponderados por palavra.
 *
 * Dividir pelo tamanho é o que torna comparável uma resenha de 400 palavras e
 * outra de 3.000. O classificador antigo multiplicava todas as categorias pelo
 * mesmo fator, o que não mudava o ranking em nada.
 */
export function calcularDensidades(titulo: string, conteudo: string): Densidades {
  const texto = normalizar(`${titulo} ${conteudo}`);
  const noTitulo = normalizar(titulo);
  const palavras = Math.max(texto.split(' ').length, 1);

  const pontos: Densidades = Object.fromEntries(DOUTRINAS.map((d) => [d, 0]));

  const pontuar = (dono: number, expressao: string, ocorrencias: number, peso: Peso) => {
    pontos[dono] += ocorrencias * PESOS[peso];
    // Estar no título é declaração de tema, não menção de passagem.
    if (noTitulo.includes(expressao)) pontos[dono] += PESOS[peso] * PESO_DO_TITULO;
  };

  for (const doutrina of DOUTRINAS) {
    for (const [peso, expressoes] of Object.entries(MARCADORES[doutrina]) as Array<[Peso, string[]]>) {
      for (const expressao of expressoes) {
        const ocorrencias = contar(texto, expressao);
        if (ocorrencias > 0) pontuar(doutrina, expressao, ocorrencias, peso);
      }
    }
  }

  // As ambíguas são varridas à parte, porque de propósito não pertencem a
  // doutrina nenhuma: quem decide o dono é o contexto. Se dependessem de estar
  // numa lista de MARCADORES, a desambiguação nunca rodaria — foi o defeito do
  // classificador antigo, onde as regras existiam e nunca eram chamadas.
  for (const { expressao } of AMBIGUAS) {
    const ocorrencias = contar(texto, expressao);
    if (ocorrencias === 0) continue;

    const dono = desambiguar(texto, expressao);
    // Sem contexto que decida, o sinal é descartado: perder é melhor que
    // atribuir à doutrina errada.
    if (dono !== null) pontuar(dono, expressao, ocorrencias, 'media');
  }

  return Object.fromEntries(
    DOUTRINAS.map((d) => [d, pontos[d] / palavras]),
  ) as Densidades;
}

export type EstatisticasDoCorpus = Record<number, { media: number; desvio: number }>;

/**
 * Média e desvio padrão de cada doutrina no corpus inteiro.
 *
 * É a linha de base contra a qual cada pregação é medida. Precisa ser calculada
 * sobre todas as resenhas antes de classificar qualquer uma — por isso a
 * classificação é um passo de lote, e não algo feito na ingestão de uma só.
 */
export function calcularEstatisticas(corpus: Densidades[]): EstatisticasDoCorpus {
  const estatisticas = {} as EstatisticasDoCorpus;

  for (const doutrina of DOUTRINAS) {
    const valores = corpus.map((d) => d[doutrina] ?? 0);
    const media = valores.reduce((a, b) => a + b, 0) / Math.max(valores.length, 1);
    const variancia =
      valores.reduce((soma, v) => soma + (v - media) ** 2, 0) / Math.max(valores.length, 1);

    estatisticas[doutrina] = { media, desvio: Math.sqrt(variancia) };
  }

  return estatisticas;
}

export type Classificacao = {
  principal: number | null;
  secundarios: number[];
  /** z de cada doutrina, para a decisão poder ser auditada. */
  zscores: Record<number, number>;
  densidades: Densidades;
  /** true quando nenhuma doutrina passou do mínimo — vai para revisão. */
  indefinido: boolean;
};

/**
 * Quão pequeno o desvio pode ser, em relação à média, antes de a doutrina ser
 * considerada sem variação.
 *
 * Não basta testar `desvio > 0`: somar centenas de valores iguais deixa um
 * resíduo de ponto flutuante, e dividir por ele produz z de ±1 ou pior, tirado
 * do nada. Uma doutrina cuja densidade praticamente não varia no corpus não
 * distingue pregação nenhuma, e o z dela tem de ser zero.
 */
const VARIACAO_MINIMA = 1e-6;

/**
 * Classifica uma resenha contra a linha de base do corpus.
 */
export function classificar(
  densidades: Densidades,
  estatisticas: EstatisticasDoCorpus,
): Classificacao {
  const zscores = Object.fromEntries(
    DOUTRINAS.map((d) => {
      const { media, desvio } = estatisticas[d];
      const variaDeVerdade = desvio > Math.max(Math.abs(media), 1) * VARIACAO_MINIMA;
      return [d, variaDeVerdade ? (densidades[d] - media) / desvio : 0];
    }),
  ) as Record<number, number>;

  const ranking = DOUTRINAS.slice().sort((a, b) => zscores[b] - zscores[a]);
  const lider = ranking[0];

  if (zscores[lider] < MINIMO_PRINCIPAL) {
    return { principal: null, secundarios: [], zscores, densidades, indefinido: true };
  }

  const secundarios = ranking
    .slice(1)
    .filter((d) => zscores[d] >= MINIMO_SECUNDARIO)
    .slice(0, MAXIMO_SECUNDARIOS);

  return { principal: lider, secundarios, zscores, densidades, indefinido: false };
}
