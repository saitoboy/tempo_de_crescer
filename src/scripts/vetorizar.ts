import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { relatarVetores, vetorizarResenhas } from '../seeds/vetores';
import { logError, logInfo } from '../utils/logger';

/** npm run vetorizar */
async function main() {
  logInfo('carregando o modelo (baixa uma vez, depois fica em cache)...', 'classificacao');
  const feitos = await vetorizarResenhas();
  if (feitos === 0) logInfo('todas as resenhas já têm vetor', 'classificacao');
  await relatarVetores();
}

main()
  .catch((e) => {
    logError((e as Error).message, 'classificacao');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
