import '../utils/timezone';
import 'dotenv/config';
import type { z } from 'zod';
import connection from '../connection';
import * as R from '../docs/respostas';
import { listarTemas, verTema } from '../services/curadoriaDoLivro';
import { paginas } from '../services/livro';
import { listarDevocionais } from '../services/revisaoDeDevocional';
import { listarCultos, listarResenhas, verResenha } from '../services/acervo';
import { listarChaves } from '../services/chaves';
import { listarPendentes } from '../services/curadoria';
import { coberturaBiblica, distribuicaoPorDoutrina, panorama } from '../services/analise';
import { logError, logInfo, logSuccess } from '../utils/logger';

/**
 * O que a API promete no OpenAPI é o que ela devolve?
 *
 * Existe porque a resposta a `GET /temas` divergiu do documento em **três**
 * campos — anunciava `paginas`, escondia `nomeDoMes` e prometia um
 * `doutrina.id` que a consulta não trazia — e nada acusou. O typecheck não vê:
 * os esquemas de saída descrevem o que os `select` do Prisma montam, e
 * descrição não é tipo. Quem integrou pelo documento bateu de frente com a
 * realidade.
 *
 * Aqui a resposta real passa pelo esquema publicado. Roda contra o banco, por
 * isso é script e não teste: `npm test` não depende de Postgres, e não vale
 * trocar essa propriedade por esta conferência.
 *
 *     npm run conferir:contrato
 *
 * O `JSON.parse(JSON.stringify(...))` não é enfeite: serializa datas como a
 * API serializa. Sem isso, `Date` passaria onde a rota manda string ISO, e a
 * conferência aprovaria um contrato que o cliente vê diferente.
 */

type Caso = { rota: string; esquema: z.ZodType; obter: () => Promise<unknown> };

async function main() {
  const casos: Caso[] = [
    {
      rota: 'GET /temas',
      esquema: R.listaDeTemas,
      obter: () => listarTemas(2027),
    },
    {
      rota: 'GET /temas/:id',
      esquema: R.temaCompleto,
      obter: async () => verTema((await listarTemas(2027))[0].id),
    },
    {
      rota: 'GET /resenhas',
      esquema: R.listaDeResenhas,
      obter: () => listarResenhas({ pagina: 1, porPagina: 3 }),
    },
    {
      rota: 'GET /resenhas/pendentes',
      esquema: R.listaDePendentes,
      obter: () => listarPendentes({ pagina: 1, porPagina: 3 }),
    },
    {
      rota: 'GET /resenhas/:id',
      esquema: R.resenhaCompleta,
      obter: async () => verResenha((await listarResenhas({ pagina: 1, porPagina: 1 })).resenhas[0].id),
    },
    {
      rota: 'GET /cultos',
      esquema: R.listaDeCultos,
      obter: () => listarCultos({ pagina: 1, porPagina: 3 }),
    },
    {
      rota: 'GET /livro/paginas',
      esquema: R.paginasDoLivro,
      obter: () => paginas({ limite: 3 }),
    },
    {
      rota: 'GET /devocionais',
      esquema: R.listaDeDevocionais,
      obter: () => listarDevocionais({ pagina: 1, porPagina: 3 }),
    },
    {
      rota: 'GET /chaves',
      esquema: R.listaDeChaves,
      obter: () => listarChaves(),
    },
    {
      rota: 'GET /analise/panorama',
      esquema: R.panorama,
      obter: () => panorama(),
    },
    {
      rota: 'GET /analise/doutrinas',
      esquema: R.porDoutrina,
      obter: () => distribuicaoPorDoutrina(),
    },
    {
      rota: 'GET /analise/biblia',
      esquema: R.cobertura,
      obter: () => coberturaBiblica(),
    },
  ];

  let divergiram = 0;

  for (const caso of casos) {
    let real: unknown;
    try {
      real = JSON.parse(JSON.stringify(await caso.obter()));
    } catch (e) {
      logError(`${caso.rota} — não deu para obter: ${(e as Error).message.slice(0, 120)}`, 'devocional');
      divergiram++;
      continue;
    }

    const r = caso.esquema.safeParse(real);

    if (r.success) {
      logSuccess(`${caso.rota}`, 'devocional');
      continue;
    }

    divergiram++;
    logError(`${caso.rota} — o documento não bate com a resposta:`, 'devocional');
    for (const i of r.error.issues.slice(0, 5)) {
      logError(`    ${i.path.join('.') || '(raiz)'}: ${i.message}`, 'devocional');
    }
  }

  console.log('');
  if (divergiram === 0) {
    logSuccess(`${casos.length} rotas conferidas, documento e resposta batem`, 'devocional');
  } else {
    logError(`${divergiram} de ${casos.length} divergiram — corrija src/docs/respostas.ts`, 'devocional');
    process.exitCode = 1;
  }

  logInfo('rotas fora desta lista não são conferidas — acrescente ao criar contrato novo', 'devocional');
}

main()
  .catch((e) => {
    logError((e as Error).message, 'devocional');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
