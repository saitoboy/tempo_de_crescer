import { Router } from 'express';
import { z } from 'zod';
import connection from '../connection';
import { assincrono } from '../middlewares/erros';
import { exigirToken } from '../middlewares/autenticacao';
import { corrigirResenha, listarPendentes } from '../services/curadoria';
import { NotFoundError } from '../utils/logger';

export const rotasResenhas = Router();

const booleano = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

export const filtroPendentes = z.object({
  semPregador: booleano,
  semData: booleano,
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  pagina: z.coerce.number().int().min(1).optional(),
  porPagina: z.coerce.number().int().min(1).max(100).optional(),
});

/** A fila de revisão: o que a ingestão não conseguiu completar sozinha. */
rotasResenhas.get(
  '/pendentes',
  assincrono(async (req, res) => {
    const filtro = filtroPendentes.parse(req.query);
    res.json(await listarPendentes(filtro));
  }),
);

export const filtroListagem = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  pregadorId: z.uuid().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

rotasResenhas.get(
  '/',
  assincrono(async (req, res) => {
    const { ano, pregadorId, pagina, porPagina } = filtroListagem.parse(req.query);
    const where = { ...(ano ? { ano } : {}), ...(pregadorId ? { pregadorId } : {}) };

    const [total, resenhas] = await Promise.all([
      connection.resenha.count({ where }),
      connection.resenha.findMany({
        where,
        orderBy: [{ publicadoEm: 'desc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
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

    res.json({ total, pagina, porPagina, paginas: Math.ceil(total / porPagina), resenhas });
  }),
);

rotasResenhas.get(
  '/:id',
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);

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

    res.json(resenha);
  }),
);

export const correcaoResenha = z
  .object({
    pregadorId: z.uuid().optional(),
    pregadorNome: z.string().trim().min(2).max(120).optional(),
    criarSeNaoExistir: z.boolean().optional(),
    // Data de calendário, sem hora e sem fuso.
    dataPregacao: z.iso.date().optional(),
    turno: z.enum(['DIA', 'NOITE']).optional(),
    natureza: z
      .enum(['CULTO', 'CELEBRACAO', 'EBD', 'ESTUDO', 'VIGILIA', 'CONFERENCIA', 'FUNEBRE'])
      .optional(),
  })
  .refine((c) => Object.keys(c).length > 0, { message: 'informe ao menos um campo' });

/** Correção manual. Só o que vier aqui é marcado como MANUAL. */
rotasResenhas.patch(
  '/:id',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    res.json(await corrigirResenha(id, correcaoResenha.parse(req.body)));
  }),
);
