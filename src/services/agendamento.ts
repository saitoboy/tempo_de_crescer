import { schedule, validate } from 'node-cron';
import { config } from '../config';
import { logError, logInfo, logSuccess, logWarning } from '../utils/logger';
import { FUSO } from '../utils/timezone';
import { importarCuradoria } from '../seeds/curadoria';
import { importarDevocionais } from '../seeds/devocionais';
import { acharPregador, escreverPendentes, relatarGasto } from './escrita';
import { ingerirNovos } from './ingestao';
import { provedores } from './provedores';

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

      await carregarOQueDependeDasResenhas();
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
 * Os devocionais e o livro, que só casam depois que as resenhas existem.
 *
 * **É o que faz um deploy novo nascer com o acervo, e não vazio.** O seed roda
 * na partida do contêiner, antes do servidor, e nessa hora o banco não tem
 * resenha nenhuma: a ingestão só acontece depois, em segundo plano. Como a
 * importação casa devocional com resenha **pelo slug**, um banco recém-criado
 * terminava o seed com os 1.049 devocionais e as 365 páginas do livro todos
 * recusados por "sem resenha correspondente" — e produção subia com o acervo
 * baixado e nenhum devocional.
 *
 * Rodar de novo aqui resolve porque as duas importações são idempotentes e não
 * destrutivas: devocional que já existe não é tocado, mês que já tem páginas é
 * preservado. Em banco cheio isto não cria nada.
 *
 * Só é chamado quando a ingestão gravou resenha nova — sem isso não há o que
 * casar, e a passada de rotina não paga o custo à toa.
 */
async function carregarOQueDependeDasResenhas(): Promise<void> {
  try {
    const devocionais = await importarDevocionais();
    const livro = await importarCuradoria();

    if (devocionais.criados > 0 || livro.criadas > 0) {
      logSuccess(
        `${devocionais.criados} devocionais e ${livro.criadas} páginas do livro casaram com as resenhas novas`,
        CONTEXTO,
      );
    }
  } catch (e) {
    // Mesma regra da ingestão: não derruba o servidor. A próxima passada com
    // resenha nova tenta de novo, e o seed manual sempre resolve.
    logError(`erro ao casar devocionais e livro: ${(e as Error).message}`, CONTEXTO);
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

// ──────────────────────────────────────────────────────────────────────────────
// ESCRITA DOS DEVOCIONAIS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Produção passou a escrever devocional.
 *
 * Não conseguia: o CLI do Claude autentica com a sessão da máquina de quem
 * escreve, e dentro do contêiner não há login nenhum. Uma chave de API não tem
 * esse problema — por isso `GROQ_API_KEYS` mudou o que é possível aqui, e não
 * só o custo.
 *
 * **O lote é pequeno de propósito.** A igreja produz três cultos por semana, e
 * a ingestão traz isso todo dia; escrever cinco por execução mantém o acervo em
 * dia com folga. Encher os 1.300 pendentes automaticamente seria gastar cota
 * escrevendo texto que nenhum mês do livro vai usar — e o mês do livro se monta
 * pelo script, com a curadoria junto.
 *
 * O que sai daqui nasce em `status: GERADO`. Publicar continua sendo do pastor.
 */
let escrevendo = false;

export async function executarEscrita(): Promise<void> {
  if (escrevendo) {
    logWarning('escrita anterior ainda em curso, pulando', CONTEXTO);
    return;
  }

  escrevendo = true;
  try {
    const pregador = await acharPregador(config.PREGADOR_DO_LIVRO);
    const resultado = await escreverPendentes(config.DEVOCIONAIS_POR_EXECUCAO, pregador.id);

    if (resultado.escritos === 0 && resultado.falhas.length === 0) {
      logInfo('nenhuma resenha pendente de devocional', CONTEXTO);
    } else {
      logSuccess(`${resultado.escritos} devocionais escritos`, CONTEXTO);
      relatarGasto(resultado);
    }

    for (const falha of resultado.falhas) logError(falha, CONTEXTO);
  } catch (e) {
    // Chave esgotada, provedor fora, pregador ausente do cadastro: nada disso
    // pode derrubar o servidor. A execução seguinte tenta de novo.
    logError(`erro na escrita: ${(e as Error).message}`, CONTEXTO);
  } finally {
    escrevendo = false;
  }
}

/**
 * Liga o agendamento da escrita. Desligado por padrão — escrever sozinho é
 * decisão de quem opera, não comportamento implícito de subir o servidor.
 *
 * Sem chave de provedor não adianta agendar: avisa e não agenda, em vez de
 * falhar de hora em hora no log.
 */
export async function agendarEscrita(): Promise<string | null> {
  const expressao = config.CRON_DEVOCIONAIS;

  if (expressao === 'off') return null;

  if (!validate(expressao)) {
    throw new Error(`CRON_DEVOCIONAIS inválido: "${expressao}"`);
  }

  if ((await provedores()).length === 0) {
    logWarning('CRON_DEVOCIONAIS ligado sem GROQ_API_KEYS — escrita não agendada', CONTEXTO);
    return null;
  }

  schedule(expressao, executarEscrita, { timezone: FUSO });
  return expressao;
}
