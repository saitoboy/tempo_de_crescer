/**
 * Fixa o fuso do processo em São Paulo.
 *
 * Importar ANTES de qualquer outro módulo que crie Date — o servidor pode
 * rodar em máquina configurada em UTC, e aí um culto de domingo à noite
 * viraria segunda-feira.
 *
 * As datas de calendário (Culto.data, Resenha.dataPregacao) são @db.Date no
 * Postgres justamente para não dependerem disso. Este ajuste vale para logs,
 * timestamps e para derivar dia da semana.
 */

export const FUSO = 'America/Sao_Paulo';

process.env.TZ = process.env.TZ || FUSO;
