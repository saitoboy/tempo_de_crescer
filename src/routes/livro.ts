import { Router } from 'express';
import { z } from 'zod';
import { exigirPapel } from '../middlewares/autenticacao';
import { assincrono } from '../middlewares/erros';
import connection from '../connection';
import { MESES } from '../services/curadoriaDoLivro';
import { pagina, paginas, paginasDoTema } from '../services/livro';
import { montarHtml } from '../services/livroHtml';
import { montarRevisao } from '../services/livroRevisao';
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
  /**
   * `largo` é o modelo escolhido pelo pastor: pontos e oração em largura
   * total, sem bloco de anotações, QR discreto no rodapé.
   */
  modelo: z.enum(['largo', 'compacto']).default('largo'),
  /**
   * Quantas páginas cada devocional ocupa no IDML.
   * `auto` decide por devocional pelo tamanho do texto; `uma` é o formato do
   * Tozer; `duas` abre em páginas encaradas.
   */
  formato: z.enum(['auto', 'uma', 'duas']).default('auto'),
  /**
   * Monta a partir da curadoria — os temas do mês e os devocionais escolhidos,
   * na ordem definida. Exige `ano`. Sem isto, sai a prévia com os mais
   * recentes, que serve para conferir diagramação.
   */
  edicao: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

/** Os dados de uma página, para quem quiser diagramar por conta própria. */
rotasLivro.get(
  '/paginas/:devocionalId',
  exigirPapel('LIDER', 'PASTOR'),
  assincrono(async (req, res) => {
    const { devocionalId } = z.object({ devocionalId: z.uuid() }).parse(req.params);
    const p = await pagina(devocionalId);
    if (!p) throw new NotFoundError(`Devocional ${devocionalId} não encontrado`);
    res.json(p);
  }),
);

rotasLivro.get(
  '/paginas',
  exigirPapel('LIDER', 'PASTOR'),
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

/**
 * O caderno de revisão, para o pastor corrigir no papel.
 *
 * Fica **aberta**, pelo mesmo motivo de `/imprimir.html`: abre em aba nova, e
 * aba nova não manda cabeçalho `Authorization`.
 *
 * A4 deitado, com a página do livro em A5 real à esquerda e pauta à direita.
 * Quem revisa não usa computador; ler na tela e depois descrever a correção por
 * telefone não funciona.
 */
rotasLivro.get(
  '/revisao.html',
  assincrono(async (req, res) => {
    const filtro = filtroLivro.parse(req.query);
    const { tema } = filtroDaRevisao.parse(req.query);

    // Um caderno por mês: é assim que ele vai revisar, um de cada vez. O mês
    // ainda não existe como escolha — a curadoria vem depois da aprovação —
    // então "as páginas de Março" são as que mais se parecem com o tema de
    // Março entre as já escritas. É o que a curadoria vai lhe oferecer.
    const mes = tema ? await acharTemaDoMes(tema) : null;

    const lista = mes
      ? await paginasDoTema(mes.id, filtro.limite)
      : await paginas(filtro);

    if (lista.length === 0) throw new NotFoundError('Nenhum devocional para revisar');

    const titulo = mes
      ? `Revisão — ${MESES[mes.mes - 1]}/${mes.ano}: ${mes.tema}`
      : 'Revisão — Tempo de Crescer';

    res.type('text/html; charset=utf-8').send(montarRevisao(lista, titulo));
  }),
);

/** `?tema=2027-3` ou o uuid do TemaMes. */
const filtroDaRevisao = z.object({ tema: z.string().trim().min(4).optional() });

async function acharTemaDoMes(argumento: string) {
  const anoMes = argumento.match(/^(\d{4})-(\d{1,2})$/);

  const tema = anoMes
    ? await connection.temaMes.findUnique({
        where: { ano_mes: { ano: Number(anoMes[1]), mes: Number(anoMes[2]) } },
        select: { id: true, ano: true, mes: true, tema: true },
      })
    : await connection.temaMes.findUnique({
        where: { id: argumento },
        select: { id: true, ano: true, mes: true, tema: true },
      });

  if (!tema) throw new NotFoundError(`Nenhum tema em "${argumento}" — use ano-mês, como 2027-3`);
  return tema;
}

/** O livro em IDML, para o designer refinar no InDesign. */
rotasLivro.get(
  '/livro.idml',
  exigirPapel('LIDER', 'PASTOR'),
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
