import { Router } from 'express';
import { z } from 'zod';
import { assincrono } from '../middlewares/erros';
import {
  coberturaBiblica,
  distribuicaoPorDoutrina,
  evolucaoPorAno,
  panorama,
  perfilDosPregadores,
} from '../services/analise';

export const rotasAnalise = Router();

rotasAnalise.get('/panorama', assincrono(async (_req, res) => res.json(await panorama())));

rotasAnalise.get('/doutrinas', assincrono(async (_req, res) => res.json(await distribuicaoPorDoutrina())));

rotasAnalise.get('/evolucao', assincrono(async (_req, res) => res.json(await evolucaoPorAno())));

export const filtroPregadores = z.object({
  minimo: z.coerce.number().int().min(1).default(5),
});

rotasAnalise.get(
  '/pregadores',
  assincrono(async (req, res) => {
    const { minimo } = filtroPregadores.parse(req.query);
    res.json(await perfilDosPregadores(minimo));
  }),
);

rotasAnalise.get('/biblia', assincrono(async (_req, res) => res.json(await coberturaBiblica())));
