import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { casarComYoutube, relatar } from '../services/casamentoYoutube';
import { logError, logInfo } from '../utils/logger';
import { aplicarProxy } from '../utils/proxy';

/**
 * Liga os cultos do banco às transmissões do canal no YouTube.
 *
 * Roda na mão: o acervo antigo não muda, e os cultos novos ganham vídeo na
 * execução seguinte. Idempotente — culto que já tem vídeo não é tocado.
 */
async function main() {
  const proxy = aplicarProxy();
  if (proxy) logInfo(`saindo pelo proxy ${proxy}`, 'proxy');

  relatar(await casarComYoutube());
}

main()
  .catch((e) => {
    logError((e as Error).message, 'youtube');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
