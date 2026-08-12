import '../utils/timezone';
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import connection from '../connection';
import type { PostBruto } from '../services/blog';
import { carregarContexto, gravarPost, novaContagem } from '../services/ingestao';
import { logInfo, logSuccess, logWarning, progresso } from '../utils/logger';

/**
 * Carga inicial do acervo: 1409 posts, de 2012 a 2026.
 *
 * Lê do cache criado por `src/scripts/baixarPosts.ts` em vez de buscar no blog,
 * porque a carga é reprocessada a cada ajuste no parser e não faz sentido
 * baixar 1409 páginas de novo toda vez. Para o dia a dia existe a ingestão
 * incremental, em `npm run ingerir`.
 *
 * Idempotente — roda de novo sem duplicar, a chave é a URL do post.
 */

const CACHE = join('.cache_blog', 'posts.json');

async function main() {
  if (!existsSync(CACHE)) {
    throw new Error('Cache ausente. Rode antes: npx tsx src/scripts/baixarPosts.ts');
  }

  const posts: PostBruto[] = Object.values(JSON.parse(readFileSync(CACHE, 'utf8')));
  const contexto = await carregarContexto();
  const contagem = novaContagem();

  const barra = progresso('resenhas do cache', posts.length, 'resenha');
  for (const post of posts) {
    await gravarPost(post, contexto, contagem);
    barra.atualizar(contagem.gravadas);
  }
  barra.concluir(`${contagem.gravadas} resenhas processadas`);

  // Convidados que ficaram sem nenhuma resenha são sobra de uma carga anterior:
  // ou o nome era lixo que o parser aprendeu a rejeitar, ou virou alias de um
  // pregador do cadastro. Pastores e seminaristas do seed ficam, mesmo sem
  // resenha ainda.
  const orfaos = await connection.pregador.deleteMany({
    where: { tipo: 'CONVIDADO', resenhas: { none: {} } },
  });

  const cultos = await connection.culto.count();

  logSuccess(`${contagem.gravadas} resenhas e ${cultos} cultos no banco`, 'resenha');
  if (contagem.pregadoresNovos > 0) {
    logInfo(`${contagem.pregadoresNovos} pregadores novos cadastrados`, 'pregador');
  }
  if (orfaos.count > 0) logInfo(`${orfaos.count} convidados sem resenha removidos`, 'pregador');
  if (contagem.anosCorrigidos > 0) {
    logInfo(`${contagem.anosCorrigidos} anos corrigidos pelo dia da semana`, 'parser');
  }

  logWarning('o que ficou incompleto, para revisão manual:', 'resenha', {
    'sem data': contagem.semData,
    'sem turno': contagem.semTurno,
    'sem pregador': contagem.semPregador,
    'sem referência bíblica': contagem.semReferencia,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
