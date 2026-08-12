import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import connection from '../connection';
import { assincrono } from '../middlewares/erros';
import { NotFoundError } from '../utils/logger';

export const rotasCultos = Router();

export const filtroCultos = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  turno: z.enum(['DIA', 'NOITE']).optional(),
  natureza: z
    .enum(['CULTO', 'CELEBRACAO', 'EBD', 'ESTUDO', 'VIGILIA', 'CONFERENCIA', 'FUNEBRE'])
    .optional(),
  comVideo: z.enum(['true', 'false']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

rotasCultos.get(
  '/',
  assincrono(async (req, res) => {
    const { ano, turno, natureza, comVideo, pagina, porPagina } = filtroCultos.parse(req.query);

    const where = {
      ...(turno ? { turno } : {}),
      ...(natureza ? { natureza } : {}),
      ...(comVideo === 'true' ? { youtubeVideoId: { not: null } } : {}),
      ...(comVideo === 'false' ? { youtubeVideoId: null } : {}),
      ...(ano
        ? {
            data: {
              gte: new Date(`${ano}-01-01T00:00:00Z`),
              lt: new Date(`${ano + 1}-01-01T00:00:00Z`),
            },
          }
        : {}),
    };

    const [total, cultos] = await Promise.all([
      connection.culto.count({ where }),
      connection.culto.findMany({
        where,
        orderBy: [{ data: 'desc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        select: {
          id: true,
          data: true,
          turno: true,
          natureza: true,
          youtubeUrl: true,
          tituloLive: true,
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

    res.json({ total, pagina, porPagina, paginas: Math.ceil(total / porPagina), cultos });
  }),
);

/**
 * QR code do culto, em SVG.
 *
 * Gerado na hora, não guardado: a imagem é função da URL do vídeo, e guardar
 * arquivo só criaria a chance de ele ficar desatualizado. SVG porque a página
 * do livro é impressa, e vetor não perde no A5.
 */
rotasCultos.get(
  '/:id/qrcode.svg',
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);

    const culto = await connection.culto.findUnique({
      where: { id },
      select: { youtubeUrl: true, data: true },
    });
    if (!culto) throw new NotFoundError(`Culto ${id} não encontrado`);

    if (!culto.youtubeUrl) {
      throw new NotFoundError(
        `O culto de ${culto.data.toISOString().slice(0, 10)} não tem vídeo no YouTube`,
      );
    }

    const svg = await QRCode.toString(culto.youtubeUrl, {
      type: 'svg',
      margin: 1,
      // Alta correção de erro: o QR vai impresso e pode ser lido de papel
      // dobrado, com tinta falhada ou luz ruim.
      errorCorrectionLevel: 'H',
    });

    res.type('image/svg+xml').send(svg);
  }),
);
