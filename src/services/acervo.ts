import connection from '../connection';
import { comoDataUri } from './qrcode';
import { NotFoundError } from '../utils/logger';

/**
 * A leitura do acervo: resenhas e cultos.
 *
 * Saiu de dentro das rotas quando o conferidor de contrato precisou chamá-las
 * sem subir servidor. Consulta dentro do handler não é testável nem
 * reaproveitável — e foi justamente numa dessas que o documento passou a
 * divergir da resposta sem ninguém ver.
 */

export type FiltroDeResenhas = {
  ano?: number;
  pregadorId?: string;
  pagina: number;
  porPagina: number;
};

export async function listarResenhas(filtro: FiltroDeResenhas) {
  const where = {
    ...(filtro.ano ? { ano: filtro.ano } : {}),
    ...(filtro.pregadorId ? { pregadorId: filtro.pregadorId } : {}),
  };

  const [total, resenhas] = await Promise.all([
    connection.resenha.count({ where }),
    connection.resenha.findMany({
      where,
      orderBy: [{ publicadoEm: 'desc' }],
      skip: (filtro.pagina - 1) * filtro.porPagina,
      take: filtro.porPagina,
      select: {
        id: true,
        slug: true,
        titulo: true,
        dataPregacao: true,
        ano: true,
        textoBase: true,
        pregador: { select: { id: true, nomeCanonico: true } },
        culto: { select: { data: true, turno: true, natureza: true } },
      },
    }),
  ]);

  return {
    total,
    pagina: filtro.pagina,
    porPagina: filtro.porPagina,
    paginas: Math.ceil(total / filtro.porPagina),
    resenhas,
  };
}

export async function verResenha(id: string) {
  const resenha = await connection.resenha.findUnique({
    where: { id },
    include: {
      pregador: { select: { id: true, nomeCanonico: true, tipo: true } },
      culto: true,
      classificacoes: { include: { doutrina: true } },
      devocional: true,
    },
  });
  if (!resenha) throw new NotFoundError(`Resenha ${id} não encontrada`);

  return resenha;
}

export type FiltroDeCultos = {
  ano?: number;
  turno?: 'DIA' | 'NOITE';
  natureza?: 'CULTO' | 'CELEBRACAO' | 'EBD' | 'ESTUDO' | 'VIGILIA' | 'CONFERENCIA' | 'FUNEBRE';
  comVideo?: 'true' | 'false';
  pagina: number;
  porPagina: number;
};

export async function listarCultos(filtro: FiltroDeCultos) {
  const where = {
    ...(filtro.turno ? { turno: filtro.turno } : {}),
    ...(filtro.natureza ? { natureza: filtro.natureza } : {}),
    ...(filtro.comVideo === 'true' ? { youtubeVideoId: { not: null } } : {}),
    ...(filtro.comVideo === 'false' ? { youtubeVideoId: null } : {}),
    ...(filtro.ano
      ? {
          data: {
            gte: new Date(`${filtro.ano}-01-01T00:00:00Z`),
            lt: new Date(`${filtro.ano + 1}-01-01T00:00:00Z`),
          },
        }
      : {}),
  };

  const [total, cultos] = await Promise.all([
    connection.culto.count({ where }),
    connection.culto.findMany({
      where,
      orderBy: [{ data: 'desc' }],
      skip: (filtro.pagina - 1) * filtro.porPagina,
      take: filtro.porPagina,
      select: {
        id: true,
        data: true,
        turno: true,
        natureza: true,
        youtubeUrl: true,
        youtubeVideoId: true,
        tituloLive: true,
        qrcodeSvg: true,
        resenhas: {
          select: {
            id: true,
            titulo: true,
            textoBase: true,
            pregador: { select: { nomeCanonico: true } },
          },
        },
      },
    }),
  ]);

  return {
    total,
    pagina: filtro.pagina,
    porPagina: filtro.porPagina,
    paginas: Math.ceil(total / filtro.porPagina),
    // O SVG cru não vai na listagem: são 2,4 KB por culto e inflaria a
    // resposta. Vai a forma embutível, que é o que o front e o InDesign usam.
    cultos: cultos.map(({ qrcodeSvg, ...culto }) => ({
      ...culto,
      qrcode: qrcodeSvg ? comoDataUri(qrcodeSvg) : null,
    })),
  };
}
