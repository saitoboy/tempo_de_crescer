import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { ingerirNovos } from '../services/ingestao';
import { logError, logInfo, logSuccess } from '../utils/logger';
import { aplicarProxy } from '../utils/proxy';

/**
 * Busca no blog as resenhas que ainda não estão no banco e grava.
 *
 * É o mesmo trabalho que o agendamento do servidor faz todo dia — este script
 * serve para rodar na mão, sem esperar o horário.
 */

async function main() {
  const proxy = aplicarProxy();
  if (proxy) logInfo(`saindo pelo proxy ${proxy}`, 'proxy');

  const resultado = await ingerirNovos();

  logInfo(`o blog tem ${resultado.noSitemap} resenhas publicadas`, 'blog');

  if (resultado.novas === 0) {
    logSuccess('tudo já está no banco, nada a buscar', 'ingestao');
    return;
  }

  logSuccess(`${resultado.gravadas} resenhas novas guardadas`, 'ingestao');
  if (resultado.pregadoresNovos > 0) logInfo(`${resultado.pregadoresNovos} pregadores novos cadastrados`, 'pregador');
  if (resultado.semData > 0) logInfo(`${resultado.semData} sem data no texto, vão para revisão`, 'resenha');
  if (resultado.semPregador > 0) logInfo(`${resultado.semPregador} sem assinatura de pregador, vão para revisão`, 'resenha');

  if (resultado.falhas.length > 0) {
    logError(`${resultado.falhas.length} não puderam ser lidas`, 'ingestao');
    resultado.falhas.forEach((f) => logError(f.erro, 'ingestao'));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
