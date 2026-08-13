import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { semearTemas } from '../seeds/temas';
import { logError } from '../utils/logger';

/** npm run seed:temas -- 2027  (padrão: ano que vem) */
async function main() {
  const ano = Number(process.argv[2]) || new Date().getFullYear() + 1;
  await semearTemas(ano);
}

main()
  .catch((e) => {
    logError((e as Error).message, 'livro');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
