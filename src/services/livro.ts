import connection from '../connection';

/**
 * A página do livro, montada a partir do banco.
 *
 * Cada bloco corresponde a um elemento do modelo escaneado em
 * `CONTEXTO/modelo-pagina.jpeg`. Nada aqui é gerado na hora: o texto vem do
 * `Devocional`, o versículo da ACF, a data e o pregador da `Resenha`, e o QR
 * do `Culto`.
 */

export type PaginaDoLivro = {
  devocionalId: string;
  titulo: string;
  versiculo: string | null;
  referencia: string | null;
  data: string | null;
  pregador: string | null;
  reflexao: string[];
  pontosAplicacao: string[];
  oracao: string | null;
  qrcodeSvg: string | null;
  youtubeUrl: string | null;
  /** Quem redigiu a resenha de origem — recebe crédito no livro. */
  redator: string | null;
};

const SELECAO = {
  id: true,
  titulo: true,
  versiculo: true,
  referencia: true,
  reflexao: true,
  pontosAplicacao: true,
  oracao: true,
  resenha: {
    select: {
      dataPregacao: true,
      redator: true,
      pregador: { select: { nomeCanonico: true } },
      culto: { select: { data: true, qrcodeSvg: true, youtubeUrl: true } },
    },
  },
} as const;

function montar(d: {
  id: string;
  titulo: string;
  versiculo: string | null;
  referencia: string | null;
  reflexao: string;
  pontosAplicacao: string[];
  oracao: string | null;
  resenha: {
    dataPregacao: Date | null;
    redator: string | null;
    pregador: { nomeCanonico: string } | null;
    culto: { data: Date; qrcodeSvg: string | null; youtubeUrl: string | null } | null;
  };
}): PaginaDoLivro {
  // A data do culto é a boa; a da resenha serve quando o culto não foi casado.
  const data = d.resenha.culto?.data ?? d.resenha.dataPregacao;

  return {
    devocionalId: d.id,
    titulo: d.titulo,
    versiculo: d.versiculo,
    referencia: d.referencia,
    data: data ? data.toISOString().slice(0, 10) : null,
    pregador: d.resenha.pregador?.nomeCanonico ?? null,
    // A reflexão é guardada como texto corrido com parágrafos separados por
    // linha em branco; a página precisa deles separados.
    reflexao: d.reflexao.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    pontosAplicacao: d.pontosAplicacao,
    oracao: d.oracao,
    qrcodeSvg: d.resenha.culto?.qrcodeSvg ?? null,
    youtubeUrl: d.resenha.culto?.youtubeUrl ?? null,
    redator: d.resenha.redator,
  };
}

export async function pagina(devocionalId: string): Promise<PaginaDoLivro | null> {
  const d = await connection.devocional.findUnique({
    where: { id: devocionalId },
    select: SELECAO,
  });
  return d ? montar(d) : null;
}

/**
 * As páginas do livro.
 *
 * Com `edicao`, monta a partir da **curadoria**: os meses do ano, na ordem,
 * com os devocionais que foram escolhidos e na posição em que foram postos.
 * É assim que o livro de verdade sai.
 *
 * Sem `edicao`, devolve os devocionais mais recentes — serve para conferir a
 * diagramação antes de haver curadoria, e é o que o preview usa.
 */
export async function paginas(filtro: {
  ano?: number;
  limite: number;
  edicao?: boolean;
}): Promise<PaginaDoLivro[]> {
  if (filtro.edicao && filtro.ano) return paginasDaEdicao(filtro.ano);

  const devocionais = await connection.devocional.findMany({
    where: filtro.ano ? { resenha: { ano: filtro.ano } } : {},
    orderBy: [{ resenha: { dataPregacao: 'asc' } }],
    take: filtro.limite,
    select: SELECAO,
  });
  return devocionais.map(montar);
}

/** O livro montado como a igreja escolheu: mês a mês, na ordem definida. */
async function paginasDaEdicao(ano: number): Promise<PaginaDoLivro[]> {
  const temas = await connection.temaMes.findMany({
    where: { ano },
    orderBy: { mes: 'asc' },
    select: {
      paginas: {
        orderBy: { ordem: 'asc' },
        select: { devocional: { select: SELECAO } },
      },
    },
  });

  return temas.flatMap((t) => t.paginas.map((p) => montar(p.devocional)));
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "28/12/2022" — como aparece na página. */
export function dataPorExtenso(iso: string | null): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function mesPorExtenso(iso: string | null): string {
  if (!iso) return '';
  const [, mes] = iso.split('-');
  return MESES[Number(mes) - 1] ?? '';
}
