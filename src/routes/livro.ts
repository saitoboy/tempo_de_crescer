import { Router } from 'express';
import { z } from 'zod';
import { assincrono } from '../middlewares/erros';
import { pagina, paginas } from '../services/livro';
import { montarHtml } from '../services/livroHtml';
import { montarIdml } from '../services/livroIdml';
import { NotFoundError } from '../utils/logger';

export const rotasLivro = Router();

export const filtroLivro = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  limite: z.coerce.number().int().min(1).max(400).default(50),
  /**
   * Dois desenhos de miolo:
   * - `compacto`: QR ao lado dos pontos, com espaço para anotações
   * - `largo`: pontos e oração em largura total, QR discreto no rodapé
   */
  modelo: z.enum(['compacto', 'largo']).default('compacto'),
  /**
   * Quantas páginas cada devocional ocupa no IDML.
   * `auto` decide por devocional pelo tamanho do texto; `uma` é o formato do
   * Tozer; `duas` abre em páginas encaradas.
   */
  formato: z.enum(['auto', 'uma', 'duas']).default('auto'),
});

/** Os dados de uma página, para quem quiser diagramar por conta própria. */
rotasLivro.get(
  '/paginas/:devocionalId',
  assincrono(async (req, res) => {
    const { devocionalId } = z.object({ devocionalId: z.uuid() }).parse(req.params);
    const p = await pagina(devocionalId);
    if (!p) throw new NotFoundError(`Devocional ${devocionalId} não encontrado`);
    res.json(p);
  }),
);

rotasLivro.get(
  '/paginas',
  assincrono(async (req, res) => {
    const filtro = filtroLivro.parse(req.query);
    res.json(await paginas(filtro));
  }),
);

/**
 * O livro pronto para imprimir em A5.
 *
 * Abrir no navegador e imprimir para PDF dá o arquivo final. O texto justificado
 * com hifenização, as viúvas e as órfãs ficam a cargo do motor de texto do
 * navegador, que faz isso melhor do que montar em coordenadas à mão.
 */
rotasLivro.get(
  '/imprimir.html',
  assincrono(async (req, res) => {
    const filtro = filtroLivro.parse(req.query);
    const lista = await paginas(filtro);
    if (lista.length === 0) throw new NotFoundError('Nenhum devocional para montar o livro');

    res.type('text/html; charset=utf-8').send(montarHtml(lista, filtro.modelo));
  }),
);

/** O livro em IDML, para o designer refinar no InDesign. */
rotasLivro.get(
  '/livro.idml',
  assincrono(async (req, res) => {
    const filtro = filtroLivro.parse(req.query);
    const lista = await paginas(filtro);
    if (lista.length === 0) throw new NotFoundError('Nenhum devocional para montar o livro');

    res
      .type('application/vnd.adobe.indesign-idml-package')
      .set('Content-Disposition', 'attachment; filename="tempo-de-crescer.idml"')
      .send(await montarIdml(lista, filtro.formato));
  }),
);
