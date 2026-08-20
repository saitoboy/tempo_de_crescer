import { Router } from 'express';
import { z } from 'zod';
import connection from '../connection';
import { exigirPapel } from '../middlewares/autenticacao';
import { assincrono } from '../middlewares/erros';
import { listarCultos } from '../services/acervo';
import { gerarSvg } from '../services/qrcode';
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
  exigirPapel('LIDER', 'PASTOR'),
  assincrono(async (req, res) => {
    res.json(await listarCultos(filtroCultos.parse(req.query)));
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
      select: { youtubeUrl: true, data: true, qrcodeSvg: true },
    });
    if (!culto) throw new NotFoundError(`Culto ${id} não encontrado`);

    if (!culto.youtubeUrl) {
      throw new NotFoundError(
        `O culto de ${culto.data.toISOString().slice(0, 10)} não tem vídeo no YouTube`,
      );
    }

    // Serve o guardado; gera na hora só se este culto ainda não tiver o seu.
    const svg = culto.qrcodeSvg ?? (await gerarSvg(culto.youtubeUrl));

    res.type('image/svg+xml').send(svg);
  }),
);
