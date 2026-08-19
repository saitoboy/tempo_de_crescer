import { Router } from 'express';
import { z } from 'zod';
import connection from '../connection';
import { assincrono } from '../middlewares/erros';
import { exigirToken } from '../middlewares/autenticacao';
import { listarResenhas, verResenha } from '../services/acervo';
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
    res.json(await listarResenhas(filtroListagem.parse(req.query)));
  }),
);

rotasResenhas.get(
  '/:id',
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    res.json(await verResenha(id));
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
