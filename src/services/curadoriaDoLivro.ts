import connection from '../connection';
import { NotFoundError, ValidationError } from '../utils/logger';

/**
 * Curadoria do livro: quais devocionais entram, sob qual tema, em que ordem.
 *
 * É a peça que faltava entre gerar devocional e ter livro. A escolha é humana:
 * a classificação automática **sugere** candidatos, mas quem monta o mês é
 * quem edita. Uma pregação classificada como Escatologia pode não servir ao
 * mês de Escatologia, e uma de outra doutrina pode servir muito bem.
 */

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export async function listarTemas(ano?: number) {
  const temas = await connection.temaMes.findMany({
    where: ano ? { ano } : {},
    orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
    include: {
      doutrina: { select: { numero: true, nome: true } },
      _count: { select: { paginas: true } },
    },
  });

  return temas.map((t) => ({
    id: t.id,
    ano: t.ano,
    mes: t.mes,
    nomeDoMes: MESES[t.mes - 1],
    tema: t.tema,
    descricao: t.descricao,
    versiculo: t.versiculo,
    referencia: t.referencia,
    doutrina: t.doutrina,
    devocionais: t._count.paginas,
  }));
}

/** Um mês com as páginas na ordem em que serão impressas. */
export async function verTema(id: string) {
  const tema = await connection.temaMes.findUnique({
    where: { id },
    include: {
      doutrina: { select: { numero: true, nome: true } },
      paginas: {
        orderBy: { ordem: 'asc' },
        include: {
          devocional: {
            select: {
              id: true,
              titulo: true,
              referencia: true,
              resenha: {
                select: {
                  dataPregacao: true,
                  pregador: { select: { nomeCanonico: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!tema) throw new NotFoundError(`Tema ${id} não encontrado`);

  return {
    ...tema,
    nomeDoMes: MESES[tema.mes - 1],
    paginas: tema.paginas.map((p) => ({
      ordem: p.ordem,
      devocionalId: p.devocional.id,
      titulo: p.devocional.titulo,
      referencia: p.devocional.referencia,
      data: p.devocional.resenha.dataPregacao?.toISOString().slice(0, 10) ?? null,
      pregador: p.devocional.resenha.pregador?.nomeCanonico ?? null,
    })),
  };
}

export type FiltroDeEscolha = {
  /** Sobrepõe a doutrina do tema. `nenhuma` ignora a classificação. */
  doutrinaId?: string;
  semDoutrina?: boolean;
  pregadorId?: string;
  /** Ano da pregação, não do livro. */
  anoDaPregacao?: number;
  /** Busca no título do devocional e da resenha. */
  busca?: string;
  limite: number;
};

export type Candidato = {
  id: string;
  titulo: string;
  referencia: string | null;
  data: string | null;
  pregador: string | null;
  doutrina: string | null;
  zscore: number | null;
  /** Em qual mês já foi usado, se já foi. */
  jaUsadoEm: string | null;
};

/**
 * Os devocionais que podem entrar no mês.
 *
 * Sem filtro, parte da doutrina do tema — Escatologia puxa o que a
 * classificação achou de escatologia, do maior z-score para baixo, que são os
 * mais claramente sobre o assunto. Mas tudo é sobreponível: dá para pedir só
 * as pregações do Pr. Gabriel, ou de 2019, ou buscar por palavra no título.
 *
 * Os já escolhidos em outro mês do mesmo ano aparecem marcados em vez de
 * sumirem — quem edita precisa saber que a página existe e onde está, senão
 * procura por ela sem entender por que não aparece.
 */
export async function sugerir(temaMesId: string, filtro: FiltroDeEscolha): Promise<Candidato[]> {
  const tema = await connection.temaMes.findUnique({
    where: { id: temaMesId },
    select: { id: true, ano: true, doutrinaId: true },
  });
  if (!tema) throw new NotFoundError(`Tema ${temaMesId} não encontrado`);

  const usadas = await connection.paginaLivro.findMany({
    where: { temaMes: { ano: tema.ano } },
    select: { devocionalId: true, temaMes: { select: { mes: true, tema: true } } },
  });
  const onde = new Map(usadas.map((p) => [p.devocionalId, `${MESES[p.temaMes.mes - 1]} — ${p.temaMes.tema}`]));

  // A doutrina do tema é o ponto de partida, não uma amarra.
  const doutrinaId = filtro.semDoutrina ? undefined : (filtro.doutrinaId ?? tema.doutrinaId ?? undefined);

  const devocionais = await connection.devocional.findMany({
    where: {
      resenha: {
        ...(filtro.pregadorId ? { pregadorId: filtro.pregadorId } : {}),
        ...(filtro.anoDaPregacao ? { ano: filtro.anoDaPregacao } : {}),
        ...(doutrinaId ? { classificacoes: { some: { doutrinaId, papel: 'PRINCIPAL' } } } : {}),
      },
      ...(filtro.busca
        ? {
            OR: [
              { titulo: { contains: filtro.busca, mode: 'insensitive' } },
              { resenha: { titulo: { contains: filtro.busca, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: [{ resenha: { dataPregacao: 'desc' } }],
    take: filtro.limite,
    select: {
      id: true,
      titulo: true,
      referencia: true,
      resenha: {
        select: {
          dataPregacao: true,
          pregador: { select: { nomeCanonico: true } },
          classificacoes: {
            where: { papel: 'PRINCIPAL' },
            select: { zscore: true, doutrina: { select: { nome: true } } },
          },
        },
      },
    },
  });

  const candidatos = devocionais.map((d) => {
    const principal = d.resenha.classificacoes[0];
    return {
      id: d.id,
      titulo: d.titulo,
      referencia: d.referencia,
      data: d.resenha.dataPregacao?.toISOString().slice(0, 10) ?? null,
      pregador: d.resenha.pregador?.nomeCanonico ?? null,
      doutrina: principal?.doutrina.nome ?? null,
      zscore: principal?.zscore ?? null,
      jaUsadoEm: onde.get(d.id) ?? null,
    };
  });

  // Com doutrina no filtro, o z-score ordena: quem trata mais claramente do
  // assunto vem primeiro. Sem ela, a data já ordenou na consulta.
  return doutrinaId
    ? candidatos.sort((a, b) => (b.zscore ?? 0) - (a.zscore ?? 0))
    : candidatos;
}

/** Põe um devocional no fim do mês. */
export async function adicionarPagina(temaMesId: string, devocionalId: string) {
  const [tema, devocional] = await Promise.all([
    connection.temaMes.findUnique({ where: { id: temaMesId }, select: { id: true } }),
    connection.devocional.findUnique({ where: { id: devocionalId }, select: { id: true } }),
  ]);
  if (!tema) throw new NotFoundError(`Tema ${temaMesId} não encontrado`);
  if (!devocional) throw new NotFoundError(`Devocional ${devocionalId} não encontrado`);

  const jaEsta = await connection.paginaLivro.findUnique({
    where: { temaMesId_devocionalId: { temaMesId, devocionalId } },
  });
  if (jaEsta) {
    throw new ValidationError('Este devocional já está neste mês', [
      { campo: 'devocionalId', mensagem: `já ocupa a posição ${jaEsta.ordem}` },
    ]);
  }

  const ultima = await connection.paginaLivro.findFirst({
    where: { temaMesId },
    orderBy: { ordem: 'desc' },
    select: { ordem: true },
  });

  return connection.paginaLivro.create({
    data: { temaMesId, devocionalId, ordem: (ultima?.ordem ?? 0) + 1 },
  });
}

/**
 * Tira um devocional do mês e fecha o buraco na numeração.
 *
 * Sem renumerar, a ordem ficaria com furos e a próxima inserção colidiria com
 * o índice único de posição.
 */
export async function removerPagina(temaMesId: string, devocionalId: string) {
  const pagina = await connection.paginaLivro.findUnique({
    where: { temaMesId_devocionalId: { temaMesId, devocionalId } },
  });
  if (!pagina) throw new NotFoundError('Este devocional não está neste mês');

  await connection.$transaction([
    connection.paginaLivro.delete({ where: { id: pagina.id } }),
    connection.$executeRaw`
      UPDATE pagina_livro SET ordem = ordem - 1
      WHERE "temaMesId" = ${temaMesId}::uuid AND ordem > ${pagina.ordem}`,
  ]);
}

/**
 * Reordena o mês inteiro de uma vez.
 *
 * A gravação é em duas etapas, com as posições primeiro em negativo: a ordem é
 * única por mês, e trocar duas páginas de lugar direto esbarraria no índice no
 * meio da operação.
 */
export async function reordenar(temaMesId: string, devocionaisEmOrdem: string[]) {
  const paginas = await connection.paginaLivro.findMany({
    where: { temaMesId },
    select: { devocionalId: true },
  });

  const atuais = new Set(paginas.map((p) => p.devocionalId));
  const novos = new Set(devocionaisEmOrdem);

  if (atuais.size !== novos.size || [...atuais].some((d) => !novos.has(d))) {
    throw new ValidationError('A nova ordem precisa conter exatamente as páginas do mês', [
      { campo: 'ordem', mensagem: `o mês tem ${atuais.size} páginas e vieram ${novos.size}` },
    ]);
  }

  await connection.$transaction([
    ...devocionaisEmOrdem.map((devocionalId, i) =>
      connection.paginaLivro.update({
        where: { temaMesId_devocionalId: { temaMesId, devocionalId } },
        data: { ordem: -(i + 1) },
      }),
    ),
    ...devocionaisEmOrdem.map((devocionalId, i) =>
      connection.paginaLivro.update({
        where: { temaMesId_devocionalId: { temaMesId, devocionalId } },
        data: { ordem: i + 1 },
      }),
    ),
  ]);
}
