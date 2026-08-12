import { schedule, validate } from 'node-cron';
import { config } from '../config';
import { logError, logInfo, logSuccess, logWarning } from '../utils/logger';
import { FUSO } from '../utils/timezone';
import { ingerirNovos } from './ingestao';

/**
 * Agendamento da ingestão incremental.
 *
 * A publicação é manual e a janela é larga: o culto de quarta à noite costuma
 * aparecer na quinta de manhã, e o de domingo pode sair até as 20h da segunda.
 *
 * Por isso o padrão é de 4 em 4 horas, e não um horário fixo. Uma passada
 * custa duas requisições ao sitemap e uma consulta ao banco; só baixa o que
 * ainda não está gravado. Insistir sai mais barato — e mais simples — do que
 * acertar o horário e ter de reagendar quando não encontra nada.
 *
 * ponytail: o agendamento vive dentro do processo da API. Se um dia a API
 * rodar em mais de uma instância, todas vão disparar a mesma ingestão — aí
 * vale mover para um worker separado ou travar por advisory lock no Postgres.
 */

const CONTEXTO = 'cron';

/** Impede que uma execução comece enquanto a anterior ainda não terminou. */
let rodando = false;

export async function executarIngestao(): Promise<void> {
  if (rodando) {
    logWarning('execução anterior ainda em curso, pulando', CONTEXTO);
    return;
  }

  rodando = true;
  try {
    const resultado = await ingerirNovos();

    if (resultado.novas === 0) {
      logInfo(`o blog não trouxe nada novo — ${resultado.noSitemap} resenhas já no banco`, CONTEXTO);
    } else {
      logSuccess(
        `${resultado.gravadas} resenhas novas guardadas (de ${resultado.novas} encontradas no blog)`,
        CONTEXTO,
      );
    }

    for (const falha of resultado.falhas) {
      logError(`falhou ${falha.url}: ${falha.erro}`, CONTEXTO);
    }
  } catch (e) {
    // Um erro aqui não pode derrubar o servidor: o blog pode estar fora do ar
    // ou o proxy recusando, e a execução seguinte tenta de novo.
    logError(`erro na ingestão: ${(e as Error).message}`, CONTEXTO);
  } finally {
    rodando = false;
  }
}

/**
 * Liga o agendamento. `CRON_INGESTAO=off` desliga — útil em desenvolvimento,
 * para não bater no blog a cada reinício do servidor.
 */
export function agendarIngestao(): string | null {
  const expressao = config.CRON_INGESTAO;

  if (expressao === 'off') return null;

  if (!validate(expressao)) {
    throw new Error(`CRON_INGESTAO inválido: "${expressao}"`);
  }

  schedule(expressao, executarIngestao, { timezone: FUSO });
  return expressao;
}
