import { schedule, validate } from 'node-cron';
import { FUSO } from '../utils/timezone';
import { ingerirNovos } from './ingestao';

/**
 * Agendamento da ingestão incremental.
 *
 * Os cultos são quarta à noite, domingo de manhã e domingo à noite, e o blog
 * publica de 0 a 5 dias depois. Uma passada por dia dá conta de tudo e não
 * incomoda o blog: a busca só baixa o que ainda não está no banco.
 *
 * ponytail: o agendamento vive dentro do processo da API. Se um dia a API
 * rodar em mais de uma instância, todas vão disparar a mesma ingestão — aí
 * vale mover para um worker separado ou travar por advisory lock no Postgres.
 */

const PADRAO = '0 7 * * *';

/** Impede que uma execução comece enquanto a anterior ainda não terminou. */
let rodando = false;

export async function executarIngestao(): Promise<void> {
  if (rodando) {
    console.log('[ingestão] execução anterior ainda em curso, pulando');
    return;
  }

  rodando = true;
  try {
    const resultado = await ingerirNovos();

    if (resultado.novas === 0) {
      console.log(`[ingestão] nada novo (${resultado.noSitemap} posts no sitemap)`);
    } else {
      console.log(`[ingestão] ${resultado.gravadas} resenhas novas de ${resultado.novas} encontradas`);
    }

    for (const falha of resultado.falhas) {
      console.error(`[ingestão] falhou ${falha.url}: ${falha.erro}`);
    }
  } catch (e) {
    // Um erro aqui não pode derrubar o servidor: o blog pode estar fora do ar
    // ou o proxy recusando, e amanhã a execução seguinte tenta de novo.
    console.error(`[ingestão] erro: ${(e as Error).message}`);
  } finally {
    rodando = false;
  }
}

/**
 * Liga o agendamento. `CRON_INGESTAO=off` desliga — útil em desenvolvimento,
 * para não bater no blog a cada reinício do servidor.
 */
export function agendarIngestao(): string | null {
  const expressao = process.env.CRON_INGESTAO ?? PADRAO;

  if (expressao === 'off') return null;

  if (!validate(expressao)) {
    throw new Error(`CRON_INGESTAO inválido: "${expressao}"`);
  }

  schedule(expressao, executarIngestao, { timezone: FUSO });
  return expressao;
}
