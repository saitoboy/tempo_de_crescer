import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import connection from '../connection';
import { logInfo, logSuccess, logWarning } from '../utils/logger';

/**
 * O livro montado viaja como dado, igual aos devocionais.
 *
 * As 365 páginas de 2027 são trabalho humano: alguém escolheu o que entra em
 * cada mês e em que ordem. Isso vive só em `PaginaLivro`, e num banco novo se
 * perderia inteiro — enquanto os devocionais voltariam pelo arquivo e as
 * resenhas pela ingestão.
 *
 * **A chave é o slug da resenha, como nos devocionais.** Os ids de `TemaMes` e
 * `Devocional` são uuid de banco: os daqui não existem em produção. O tema se
 * reencontra por ano e mês, que são estáveis; a página, pelo slug da resenha
 * que originou o devocional.
 */

const ARQUIVO = join('prisma', 'dados', 'curadoria.json');

type PaginaExportada = {
  ano: number;
  mes: number;
  ordem: number;
  /** Do devocional não: da resenha, que é o que tem slug estável. */
  slug: string;
};

export async function exportarCuradoria(caminho = ARQUIVO): Promise<number> {
  const paginas = await connection.paginaLivro.findMany({
    orderBy: [{ temaMes: { ano: 'asc' } }, { temaMes: { mes: 'asc' } }, { ordem: 'asc' }],
    select: {
      ordem: true,
      temaMes: { select: { ano: true, mes: true } },
      devocional: { select: { resenha: { select: { slug: true } } } },
    },
  });

  const exportadas: PaginaExportada[] = paginas.map((p) => ({
    ano: p.temaMes.ano,
    mes: p.temaMes.mes,
    ordem: p.ordem,
    slug: p.devocional.resenha.slug,
  }));

  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, JSON.stringify(exportadas, null, 1), 'utf8');

  return exportadas.length;
}

/**
 * De quais anos o arquivo fala.
 *
 * O seed precisa disto para semear os temas antes de montar as páginas: a
 * página aponta para um `TemaMes`, e num banco novo ele não existe.
 */
export function anosDaCuradoria(caminho = ARQUIVO): number[] {
  if (!existsSync(caminho)) return [];

  const arquivo = JSON.parse(readFileSync(caminho, 'utf8')) as PaginaExportada[];
  return [...new Set(arquivo.map((p) => p.ano))].sort();
}

/**
 * Carrega o livro montado.
 *
 * **Não sobrescreve mês que já tem páginas.** Se alguém montou Março em
 * produção pela tela, uma carga não desfaz — o arquivo é ponto de partida, não
 * verdade final, pela mesma razão dos devocionais.
 */
export async function importarCuradoria(caminho = ARQUIVO): Promise<{
  criadas: number;
  mesesIntactos: number;
  semDevocional: string[];
}> {
  if (!existsSync(caminho)) {
    logInfo(`sem ${caminho}, nada a importar`, 'livro');
    return { criadas: 0, mesesIntactos: 0, semDevocional: [] };
  }

  const arquivo = JSON.parse(readFileSync(caminho, 'utf8')) as PaginaExportada[];
  if (arquivo.length === 0) return { criadas: 0, mesesIntactos: 0, semDevocional: [] };

  // Uma consulta para tudo: buscar devocional por slug, um a um, seriam
  // trezentas e sessenta e cinco viagens ao banco.
  const resenhas = await connection.resenha.findMany({
    where: { slug: { in: [...new Set(arquivo.map((p) => p.slug))] } },
    select: { slug: true, devocional: { select: { id: true } } },
  });
  const devocionalPorSlug = new Map(
    resenhas.filter((r) => r.devocional).map((r) => [r.slug, r.devocional!.id]),
  );

  const temas = await connection.temaMes.findMany({ select: { id: true, ano: true, mes: true } });
  const temaPorMes = new Map(temas.map((t) => [`${t.ano}-${t.mes}`, t.id]));

  const jaMontados = await connection.paginaLivro.groupBy({
    by: ['temaMesId'],
    _count: true,
  });
  const ocupados = new Set(jaMontados.map((m) => m.temaMesId));

  const resultado = { criadas: 0, mesesIntactos: 0, semDevocional: [] as string[] };
  const novas: Array<{ temaMesId: string; devocionalId: string; ordem: number }> = [];
  const mesesPulados = new Set<string>();

  for (const p of arquivo) {
    const temaMesId = temaPorMes.get(`${p.ano}-${p.mes}`);
    if (!temaMesId) continue;

    if (ocupados.has(temaMesId)) {
      mesesPulados.add(`${p.ano}-${p.mes}`);
      continue;
    }

    const devocionalId = devocionalPorSlug.get(p.slug);
    if (!devocionalId) {
      resultado.semDevocional.push(p.slug);
      continue;
    }

    novas.push({ temaMesId, devocionalId, ordem: p.ordem });
  }

  if (novas.length > 0) {
    // `skipDuplicates` porque a ordem é única por mês: uma página repetida no
    // arquivo derrubaria a carga inteira em vez de ser ignorada.
    const { count } = await connection.paginaLivro.createMany({ data: novas, skipDuplicates: true });
    resultado.criadas = count;
  }

  resultado.mesesIntactos = mesesPulados.size;

  if (resultado.criadas > 0) logSuccess(`${resultado.criadas} páginas do livro montadas`, 'livro');
  if (resultado.mesesIntactos > 0) {
    logInfo(`${resultado.mesesIntactos} meses já tinham páginas e foram preservados`, 'livro');
  }
  if (resultado.semDevocional.length > 0) {
    logWarning(
      `${resultado.semDevocional.length} páginas sem devocional no destino — carregue os devocionais primeiro`,
      'livro',
      resultado.semDevocional.slice(0, 5),
    );
  }

  return resultado;
}
