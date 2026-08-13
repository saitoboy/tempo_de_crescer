import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { exportarDevocionais } from '../seeds/devocionais';
import { logError, logSuccess } from '../utils/logger';

/**
 * Grava os devocionais em arquivo, para versionar e levar a produção.
 *
 * Rode depois de cada lote de geração: o texto custou assinatura, e ele só
 * está seguro quando sai do banco local e entra no repositório.
 */
async function main() {
  const total = await exportarDevocionais();
  logSuccess(`${total} devocionais em prisma/dados/devocionais.json`, 'devocional');
}

main()
  .catch((e) => {
    logError((e as Error).message, 'devocional');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
