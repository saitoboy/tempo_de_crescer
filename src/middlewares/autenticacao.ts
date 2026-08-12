import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { logWarning } from '../utils/logger';

/**
 * Protege as rotas de escrita.
 *
 * A leitura fica aberta: o conteúdo já é público no blog da igreja. A escrita
 * não pode ficar — um PATCH sem porteiro num host público deixa qualquer um
 * reescrever o acervo.
 *
 * ponytail: um token único no ambiente, não login de verdade. Basta para a
 * curadoria manual desta fase. O login por usuário e senha, com os papéis
 * ADMIN, PASTOR e LIDER que já estão no schema, entra na Fase 7 junto com o
 * front — e substitui este middleware.
 */
export function exigirToken(req: Request, res: Response, next: NextFunction) {
  const esperado = config.API_TOKEN;

  if (!esperado) {
    logWarning('API_TOKEN não configurado, escrita bloqueada', 'auth');
    res.status(503).json({
      status: 'erro',
      mensagem: 'Escrita indisponível: API_TOKEN não configurado no servidor',
      codigo: 'SEM_TOKEN_CONFIGURADO',
    });
    return;
  }

  const recebido = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  if (!confere(recebido, esperado)) {
    res.status(401).json({
      status: 'erro',
      mensagem: 'Token ausente ou inválido',
      codigo: 'NAO_AUTORIZADO',
    });
    return;
  }

  next();
}

/** Comparação de tempo constante, para não vazar o token por cronometragem. */
function confere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // timingSafeEqual exige o mesmo tamanho; comparar antes já entrega a
  // diferença, mas o tamanho do token não é o segredo.
  return a.length === b.length && timingSafeEqual(a, b);
}
