import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isIntegrityError, logError, mapErrorToHttpResponse, ValidationError } from '../utils/logger';

/**
 * Traduz erro em resposta HTTP.
 *
 * Erro de validação do zod vira 400 com a lista de campos; os erros de domínio
 * já sabem o próprio status. Qualquer outra coisa é falha nossa: registra o
 * erro inteiro no log e devolve 500 sem detalhe, para não vazar caminho de
 * arquivo nem estrutura do banco para quem chamou.
 */
export function tratarErros(erro: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (erro instanceof ZodError) {
    const validacao = new ValidationError(
      'Dados inválidos',
      erro.issues.map((i) => ({ campo: i.path.join('.') || 'corpo', mensagem: i.message })),
    );
    const { status, response } = mapErrorToHttpResponse(validacao);
    res.status(status).json(response);
    return;
  }

  if (isIntegrityError(erro)) {
    const { status, response } = mapErrorToHttpResponse(erro);
    res.status(status).json(response);
    return;
  }

  logError((erro as Error).message, 'controller', (erro as Error).stack);
  res.status(500).json({
    status: 'erro',
    mensagem: 'Erro interno do servidor',
    codigo: 'INTERNAL_ERROR',
  });
}

/**
 * Encaminha erro de handler assíncrono para o tratador.
 *
 * O Express 5 já captura promessa rejeitada, mas isto mantém a intenção
 * explícita e evita depender do detalhe da versão.
 */
export function assincrono(
  handler: (req: Request, res: Response) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
