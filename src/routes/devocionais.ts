import { Router } from 'express';
import { z } from 'zod';
import connection from '../connection';
import { exigirToken } from '../middlewares/autenticacao';
import { assincrono } from '../middlewares/erros';
import { conferirFidelidade } from '../services/fidelidade';
import {
  correcaoDeDevocional,
  corrigirDevocional,
  listarDevocionais,
} from '../services/revisaoDeDevocional';
import { NotFoundError } from '../utils/logger';

/**
 * A revisão dos devocionais.
 *
 * Fecha o ciclo que o caderno de papel abriu: o pastor corrige à caneta, alguém
 * digita aqui, e o texto vira `REVISADO`. Sem estas rotas o caderno era papel
 * que ninguém conseguia transformar em nada, e o `status` do schema nunca saía
 * de `GERADO`.
 */
export const rotasDevocionais = Router();

export const filtroDevocionais = z.object({
  /** `GERADO` é a fila de revisão: o que a máquina escreveu e ninguém leu. */
  status: z.enum(['GERADO', 'REVISADO']).optional(),
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  /** As páginas que sairão sem o quadrado do QR, para conferir à parte. */
  semQrcode: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  busca: z.string().trim().min(2).max(80).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

rotasDevocionais.get(
  '/',
  assincrono(async (req, res) => {
    res.json(await listarDevocionais(filtroDevocionais.parse(req.query)));
  }),
);

/**
 * Um devocional inteiro, com o que a conferência contra a ACF achou.
 *
 * As suspeitas vêm junto de propósito: quem abre esta tela é quem vai decidir
 * se a citação está certa, e ter de pedir isso numa segunda chamada faria a
 * conferência ser esquecida.
 */
rotasDevocionais.get(
  '/:id',
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);

    const devocional = await connection.devocional.findUnique({
      where: { id },
      include: {
        resenha: {
          select: {
            id: true,
            titulo: true,
            dataPregacao: true,
            conteudoLimpo: true,
            pregador: { select: { nomeCanonico: true } },
            culto: { select: { youtubeUrl: true, qrcodeSvg: true } },
          },
        },
      },
    });
    if (!devocional) throw new NotFoundError(`Devocional ${id} não encontrado`);

    const suspeitas = await conferirFidelidade({
      reflexao: devocional.reflexao,
      oracao: devocional.oracao,
      referencia: devocional.referencia,
      versiculoResolvido: devocional.versiculo !== null,
    });

    res.json({ ...devocional, suspeitas });
  }),
);

/**
 * Aplica a correção do pastor.
 *
 * Marca `REVISADO`, porque quem digita aqui está transcrevendo a revisão dele.
 * `manterStatus: true` serve ao conserto de digitação, que não é aprovação.
 *
 * Trocar a `referencia` re-resolve o versículo na ACF: sem isso a página
 * ficaria com o texto de um versículo sob a citação de outro.
 */
rotasDevocionais.patch(
  '/:id',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    res.json(await corrigirDevocional(id, correcaoDeDevocional.parse(req.body)));
  }),
);

/**
 * Aprova sem mexer no texto — o caso de "está bom assim".
 *
 * `?desfazer=true` devolve a `GERADO`. Existe porque aprovação errada acontece,
 * e sem volta a única saída seria mexer no banco na mão. `REVISADO` também é o
 * que protege o texto da regeração, então marcar por engano trava a página no
 * lugar errado.
 */
rotasDevocionais.post(
  '/:id/aprovar',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const { desfazer } = z
      .object({
        desfazer: z
          .enum(['true', 'false'])
          .optional()
          .transform((v) => v === 'true'),
      })
      .parse(req.query);

    const existe = await connection.devocional.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundError(`Devocional ${id} não encontrado`);

    const salvo = await connection.devocional.update({
      where: { id },
      data: { status: desfazer ? 'GERADO' : 'REVISADO' },
      select: { id: true, titulo: true, status: true },
    });

    res.json(salvo);
  }),
);
