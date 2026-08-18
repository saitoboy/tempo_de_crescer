import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import { MESES } from '../services/curadoriaDoLivro';
import { comoConsulta, maisParecidos } from '../services/vetores';
import { logInfo, logSuccess } from '../utils/logger';

/**
 * Quanto do livro já está escrito.
 *
 *     npm run estado            # o ano que vem
 *     npm run estado -- 2027
 *
 * Existe porque **o devocional não guarda para qual mês foi gerado**, e nem
 * deveria: o mês é a lente que escolhe o que escrever, e a atribuição de
 * verdade acontece na curadoria, depois. Só que isso deixa "já rodei março?"
 * sem resposta — e rodar de novo não quebra nada, mas gasta tempo à toa.
 *
 * A pergunta melhor, que este relatório responde, é outra: **dos candidatos
 * que este mês escolheria, quantos já estão escritos?** Se são 18 de 20, o mês
 * está pronto; se são 2, falta rodar.
 *
 * Custo zero: os vetores já estão no banco, o modelo roda local, e nada aqui
 * chama provedor nenhum.
 */

const QUANTOS_POR_MES = 20;

async function main() {
  const ano = Number(process.argv[2]) || new Date().getFullYear() + 1;

  const pregador = await connection.pregador.findFirst({
    where: { nomeCanonico: 'Nélio Monteiro' },
    select: { id: true, nomeCanonico: true },
  });
  if (!pregador) throw new Error('pregador do livro não está no cadastro');

  // Todas as dele, com e sem devocional: a cobertura é sobre o acervo inteiro,
  // não sobre a fila. `filaDoTema` só enxerga as pendentes, e por isso não
  // serve aqui — ela nunca mostraria o que já foi escrito.
  const acervo = await connection.resenha.findMany({
    where: {
      pregadorId: pregador.id,
      conteudoLimpo: { not: '' },
      dataPregacao: { not: null },
    },
    select: { id: true, embedding: true, devocional: { select: { id: true } } },
  });

  const escritas = new Set(acervo.filter((r) => r.devocional).map((r) => r.id));

  const [total, porMotor] = await Promise.all([
    connection.devocional.count(),
    connection.devocional.groupBy({ by: ['modelo'], _count: true, orderBy: { _count: { modelo: 'desc' } } }),
  ]);

  logSuccess(`${total} devocionais no banco`, 'devocional');
  for (const m of porMotor) {
    logInfo(`  ${m._count} por ${m.modelo ?? '(sem motor registrado)'}`, 'devocional');
  }

  const temas = await connection.temaMes.findMany({
    where: { ano },
    orderBy: { mes: 'asc' },
    select: { mes: true, tema: true, descricao: true, _count: { select: { paginas: true } } },
  });

  if (temas.length === 0) {
    throw new Error(`Nenhum tema em ${ano}. Rode \`npm run seed:temas -- ${ano}\`.`);
  }

  console.log(`\n| mês | tema | escritos dos ${QUANTOS_POR_MES} melhores | no livro |`);
  console.log('|---|---|---|---|');

  let faltandoNoTotal = 0;

  for (const t of temas) {
    const consulta = await comoConsulta([t.tema, t.descricao].filter(Boolean).join('. '));
    const melhores = maisParecidos(consulta, acervo, QUANTOS_POR_MES);
    const prontos = melhores.filter((m) => escritas.has(m.id)).length;
    const faltam = melhores.length - prontos;
    faltandoNoTotal += faltam;

    const barra = '█'.repeat(prontos) + '░'.repeat(faltam);
    console.log(
      `| ${MESES[t.mes - 1]} | ${t.tema} | ${barra} ${prontos}/${melhores.length} | ${t._count.paginas} |`,
    );
  }

  console.log('');
  logInfo(
    faltandoNoTotal === 0
      ? 'todos os meses cobertos — o que falta é curadoria, não escrita'
      : `${faltandoNoTotal} devocionais a escrever para cobrir os ${QUANTOS_POR_MES} melhores de cada mês`,
    'devocional',
  );
  logInfo('"no livro" é o que a curadoria já escolheu, não o que existe', 'devocional');
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
