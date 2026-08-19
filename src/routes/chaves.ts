import { Router } from 'express';
import { z } from 'zod';
import { exigirToken } from '../middlewares/autenticacao';
import { assincrono } from '../middlewares/erros';
import { alternarChave, apagarChave, guardarChave, listarChaves } from '../services/chaves';

/**
 * As chaves de API dos provedores.
 *
 * Existem no banco porque a cota diária da Groq é de 200.000 tokens por chave —
 * uns 44 devocionais — então acrescentar e trocar chave é rotina. Pelo `.env`
 * cada troca custava um redeploy.
 *
 * **Escrita só, e nunca leitura do valor.** A chave entra uma vez e não sai
 * mais: as rotas devolvem os quatro últimos caracteres, o bastante para
 * reconhecer qual é. Quem precisar dela de novo cadastra outra — é mais barato
 * do que abrir um caminho de vazamento.
 */
export const rotasChaves = Router();

export const chaveNova = z.object({
  provedor: z.enum(['GROQ', 'NVIDIA']),
  /** Como identificar esta chave na tela. "conta do Guilherme", "conta 3". */
  rotulo: z.string().trim().min(2).max(60),
  /** O valor. Vai cifrado para o banco e nunca mais é devolvido. */
  chave: z.string().trim().min(20).max(200),
});

rotasChaves.get(
  '/',
  assincrono(async (_req, res) => {
    res.json(await listarChaves());
  }),
);

rotasChaves.post(
  '/',
  exigirToken,
  assincrono(async (req, res) => {
    res.status(201).json(await guardarChave(chaveNova.parse(req.body)));
  }),
);

export const situacaoDaChave = z.object({ ativa: z.boolean() });

/**
 * Liga e desliga sem apagar.
 *
 * Chave que estourou a cota do dia não precisa ser removida — desligar e voltar
 * amanhã preserva o rótulo e o histórico de erro, que é o que ajuda a entender
 * qual conta está rendendo.
 */
rotasChaves.patch(
  '/:id',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const { ativa } = situacaoDaChave.parse(req.body);
    res.json(await alternarChave(id, ativa));
  }),
);

rotasChaves.delete(
  '/:id',
  exigirToken,
  assincrono(async (req, res) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    await apagarChave(id);
    res.json({ status: 'ok' });
  }),
);
