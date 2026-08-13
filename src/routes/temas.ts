import { Router } from 'express';
import { z } from 'zod';
import connection from '../connection';
import { exigirToken } from '../middlewares/autenticacao';
import { assincrono } from '../middlewares/erros';
import {
  adicionarPagina,
  listarTemas,
  removerPagina,
  reordenar,
  sugerir,
  verTema,
} from '../services/curadoriaDoLivro';

export const rotasTemas = Router();

export const filtroTemas = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
});

rotasTemas.get(
  '/',
  assincrono(async (req, res) => {
    const { ano } = filtroTemas.parse(req.query);
    res.json(await listarTemas(ano));
  }),
);

rotasTemas.get(
  '/:id',
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    res.json(await verTema(id));
  }),
);

export const novoTema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  tema: z.string().trim().min(3).max(120),
  descricao: z.string().trim().max(400).optional(),
  versiculo: z.string().trim().max(600).optional(),
  referencia: z.string().trim().max(60).optional(),
  doutrinaId: z.uuid().optional(),
});

rotasTemas.post(
  '/',
  exigirToken,
  assincrono(async (req, res) => {
    const dados = novoTema.parse(req.body);
    res.status(201).json(await connection.temaMes.create({ data: dados }));
  }),
);

rotasTemas.patch(
  '/:id',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const dados = novoTema.partial().parse(req.body);
    res.json(await connection.temaMes.update({ where: { id }, data: dados }));
  }),
);

export const filtroDeEscolha = z.object({
  /** Sobrepõe a doutrina do tema. */
  doutrinaId: z.uuid().optional(),
  /** Ignora a classificação e traz o acervo todo. */
  semDoutrina: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  pregadorId: z.uuid().optional(),
  /** Ano da pregação, não do livro. */
  anoDaPregacao: z.coerce.number().int().min(2000).max(2100).optional(),
  busca: z.string().trim().min(2).max(80).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Os devocionais que podem entrar no mês.
 *
 * Parte da doutrina do tema, mas tudo é sobreponível: por pastor, por ano da
 * pregação, por palavra no título, ou sem doutrina nenhuma.
 */
rotasTemas.get(
  '/:id/sugestoes',
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    res.json(await sugerir(id, filtroDeEscolha.parse(req.query)));
  }),
);

export const paginaEscolhida = z.object({ devocionalId: z.uuid() });

rotasTemas.post(
  '/:id/paginas',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const { devocionalId } = paginaEscolhida.parse(req.body);
    res.status(201).json(await adicionarPagina(id, devocionalId));
  }),
);

rotasTemas.delete(
  '/:id/paginas/:devocionalId',
  exigirToken,
  assincrono(async (req, res) => {
    const { id, devocionalId } = z
      .object({ id: z.uuid(), devocionalId: z.uuid() })
      .parse(req.params);
    await removerPagina(id, devocionalId);
    res.json({ status: 'ok' });
  }),
);

export const novaOrdem = z.object({ devocionais: z.array(z.uuid()).min(1) });

rotasTemas.patch(
  '/:id/ordem',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const { devocionais } = novaOrdem.parse(req.body);
    await reordenar(id, devocionais);
    res.json(await verTema(id));
  }),
);
