import connection from '../connection';
import { comoDocumento, textoParaVetor } from '../services/vetores';
import { logSuccess, progresso } from '../utils/logger';

/**
 * Calcula o vetor semântico das resenhas que ainda não têm.
 *
 * Idempotente: roda de novo e só processa o que falta. É por isso que pode
 * entrar no arranque do contêiner sem virar desperdício — num banco já
 * vetorizado não faz nada.
 */
export async function vetorizarResenhas(lote = 200): Promise<number> {
  const total = await connection.resenha.count({ where: { embedding: { isEmpty: true } } });
  if (total === 0) return 0;

  const barra = progresso('vetores', total, 'classificacao');
  let feitos = 0;

  // Em lotes para não carregar 1.409 textos inteiros na memória de uma vez.
  while (feitos < total) {
    const resenhas = await connection.resenha.findMany({
      where: { embedding: { isEmpty: true } },
      take: lote,
      select: { id: true, titulo: true, textoBase: true, conteudoLimpo: true },
    });
    if (resenhas.length === 0) break;

    for (const r of resenhas) {
      await connection.resenha.update({
        where: { id: r.id },
        data: { embedding: await comoDocumento(textoParaVetor(r)) },
      });
      barra.atualizar(++feitos);
    }
  }

  barra.concluir(`${feitos} resenhas vetorizadas`);
  return feitos;
}

export async function relatarVetores() {
  const [comVetor, total] = await Promise.all([
    connection.resenha.count({ where: { embedding: { isEmpty: false } } }),
    connection.resenha.count(),
  ]);
  logSuccess(`${comVetor} de ${total} resenhas com vetor`, 'classificacao');
}
