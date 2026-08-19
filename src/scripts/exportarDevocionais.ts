import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { exportarCuradoria } from '../seeds/curadoria';
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

  // Junto de propósito: o livro montado é trabalho humano e se perderia num
  // banco novo, enquanto os devocionais voltariam pelo arquivo e as resenhas
  // pela ingestão. Exportar um sem o outro deixaria produção com as páginas
  // soltas e nenhum mês montado.
  const paginas = await exportarCuradoria();
  logSuccess(`${paginas} páginas do livro em prisma/dados/curadoria.json`, 'livro');
}

main()
  .catch((e) => {
    logError((e as Error).message, 'devocional');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
