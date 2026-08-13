import '../utils/timezone';
import 'dotenv/config';
import connection from '../connection';
import {
  calcularDensidades,
  calcularEstatisticas,
  classificar,
  DOUTRINAS,
} from '../services/classificador';
import { logError, logInfo, logSuccess, logWarning, progresso } from '../utils/logger';

/**
 * Classifica todas as resenhas contra a linha de base do corpus.
 *
 * É um passo de lote por necessidade, não por preguiça: o z-score de uma
 * pregação depende da média e do desvio de TODAS as outras. Não dá para
 * classificar uma resenha sozinha na ingestão.
 */
async function main() {
  const resenhas = await connection.resenha.findMany({
    select: { id: true, titulo: true, conteudoLimpo: true },
  });
  logInfo(`${resenhas.length} resenhas para medir`, 'classificacao');

  // Primeira passada: densidade de cada uma.
  const barra = progresso('densidades', resenhas.length, 'classificacao');
  const densidades = resenhas.map((r, i) => {
    barra.atualizar(i + 1);
    return calcularDensidades(r.titulo, r.conteudoLimpo);
  });
  barra.concluir('densidades calculadas');

  // Segunda: a linha de base do corpus.
  const estatisticas = calcularEstatisticas(densidades);
  const doutrinas = await connection.doutrina.findMany({ select: { id: true, numero: true, nome: true } });
  const porNumero = new Map(doutrinas.map((d) => [d.numero, d]));

  logInfo('linha de base do corpus:', 'classificacao',
    Object.fromEntries(DOUTRINAS.map((d) => [
      porNumero.get(d)!.nome,
      { media: estatisticas[d].media.toExponential(2), desvio: estatisticas[d].desvio.toExponential(2) },
    ])));

  // Terceira: classificar e gravar.
  const contagem = { classificadas: 0, indefinidas: 0 };
  const porDoutrina = new Map<number, number>();

  const gravando = progresso('classificações', resenhas.length, 'classificacao');
  for (const [i, resenha] of resenhas.entries()) {
    const resultado = classificar(densidades[i], estatisticas);

    await connection.classificacao.deleteMany({ where: { resenhaId: resenha.id } });

    if (resultado.indefinido) {
      contagem.indefinidas++;
    } else {
      const papeis = [
        { numero: resultado.principal!, papel: 'PRINCIPAL' as const },
        ...resultado.secundarios.map((n) => ({ numero: n, papel: 'SECUNDARIO' as const })),
      ];

      await connection.classificacao.createMany({
        data: papeis.map(({ numero, papel }) => ({
          resenhaId: resenha.id,
          doutrinaId: porNumero.get(numero)!.id,
          papel,
          zscore: Number(resultado.zscores[numero].toFixed(4)),
          densidade: Number(resultado.densidades[numero].toFixed(8)),
        })),
      });

      porDoutrina.set(resultado.principal!, (porDoutrina.get(resultado.principal!) ?? 0) + 1);
      contagem.classificadas++;
    }

    await connection.resenha.update({
      where: { id: resenha.id },
      data: { status: resultado.indefinido ? 'INGERIDA' : 'CLASSIFICADA' },
    });

    gravando.atualizar(i + 1);
  }
  gravando.concluir(`${contagem.classificadas} resenhas classificadas`);

  logSuccess('tema principal por doutrina:', 'classificacao',
    Object.fromEntries(
      [...porDoutrina.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([numero, total]) => [porNumero.get(numero)!.nome, total]),
    ));

  if (contagem.indefinidas > 0) {
    logWarning(`${contagem.indefinidas} ficaram indefinidas e vão para revisão`, 'classificacao');
  }
}

main()
  .catch((e) => {
    logError((e as Error).message, 'classificacao');
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
