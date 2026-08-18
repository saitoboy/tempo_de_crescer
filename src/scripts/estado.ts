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

/**
 * Quantos devocionais o mês precisa: um por dia.
 *
 * O livro é diário, então o alvo é o calendário, não um número redondo.
 * Fevereiro de 2027 tem 28 — o ano não é bissexto — e o ano fecha em 365.
 *
 * `new Date(ano, mes, 0)` devolve o último dia do mês anterior ao índice, e
 * como `mes` aqui é 1-based isso dá o último dia do próprio mês. Resolve
 * bissexto sozinho, sem tabela.
 */
function diasDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

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

  console.log('\n| mês | tema | dias | no tema | faltam | no livro |');
  console.log('|---|---|---|---|---|---|');

  let diasNoAno = 0;

  /**
   * Quem já foi contado, para o total não somar a mesma página duas vezes.
   *
   * Um devocional aparece no topo de mais de um mês — "Cristo, espelhe a Sua
   * luz" serve a Janeiro, Março e Setembro. Somar as aparições dava 191 com
   * 170 no banco. No livro cada página ocupa **um** dia, então o que vale é a
   * contagem distinta.
   */
  const contados = new Set<string>();

  for (const t of temas) {
    const dias = diasDoMes(ano, t.mes);
    diasNoAno += dias;

    const consulta = await comoConsulta([t.tema, t.descricao].filter(Boolean).join('. '));

    // Quantos dos melhores do tema já estão escritos — até o número de dias,
    // que é o teto do que o mês comporta.
    const melhores = maisParecidos(consulta, acervo, dias);
    const prontos = melhores.filter((m) => escritas.has(m.id));
    for (const p of prontos) contados.add(p.id);

    const barra = '█'.repeat(prontos.length) + '░'.repeat(Math.max(0, dias - prontos.length));
    console.log(
      `| ${MESES[t.mes - 1]} | ${t.tema} | ${dias} | ${barra} ${prontos.length} | ` +
        `${dias - prontos.length} | ${t._count.paginas} |`,
    );
  }

  console.log('');
  logInfo(`${ano} precisa de ${diasNoAno} páginas — uma por dia`, 'devocional');
  logSuccess(`${total} devocionais no acervo, ${contados.size} aderentes a algum tema deste ano`, 'devocional');

  // A conta por mês soma mais que o total de propósito: o mesmo devocional
  // aparece no topo de vários temas, e a curadoria decide em qual mês ele fica.
  logInfo('a soma dos meses passa do total porque um devocional serve a mais de um tema', 'devocional');

  // E o acervo não é de uma edição só: são 700 pregações do Nélio, e o livro
  // sai todo ano. Devocional que não entra em 2027 entra em 2028.
  const restam = await connection.resenha.count({
    where: { pregadorId: pregador.id, devocional: null, conteudoLimpo: { not: '' }, dataPregacao: { not: null } },
  });
  logInfo(`${restam} pregações dele ainda sem devocional — material para as próximas edições`, 'devocional');
  logInfo('"no livro" é o que a curadoria já escolheu, não o que existe', 'devocional');
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
