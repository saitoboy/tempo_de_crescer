import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { ingerirNovos } from '../services/ingestao';
import { aplicarProxy } from '../utils/proxy';

/**
 * Busca no blog as resenhas que ainda não estão no banco e grava.
 *
 * É o mesmo trabalho que o agendamento do servidor faz todo dia — este script
 * serve para rodar na mão, sem esperar o horário.
 */

async function main() {
  const proxy = aplicarProxy();
  if (proxy) console.log(`via proxy ${proxy}`);

  const resultado = await ingerirNovos();

  console.log(`sitemap: ${resultado.noSitemap} posts | novos: ${resultado.novas}`);

  if (resultado.novas === 0) {
    console.log('nada novo.');
    return;
  }

  console.log(`✓ ${resultado.gravadas} gravadas`);
  if (resultado.pregadoresNovos > 0) console.log(`  ${resultado.pregadoresNovos} pregadores novos`);
  if (resultado.semData > 0) console.log(`  ${resultado.semData} sem data`);
  if (resultado.semPregador > 0) console.log(`  ${resultado.semPregador} sem pregador`);

  if (resultado.falhas.length > 0) {
    console.log(`\n${resultado.falhas.length} falharam:`);
    resultado.falhas.forEach((f) => console.log(`  ${f.erro}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
