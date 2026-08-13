import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import type { Papel } from '../generated/prisma/enums';
import { conferir, type Conteudo } from '../services/token';
import { ForbiddenError, logWarning } from '../utils/logger';

/**
 * Quem está chamando, quando há token de sessão.
 *
 * O middleware `exigirPapel` preenche isto; as rotas leem sem precisar decodificar
 * o token de novo.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: Conteudo;
    }
  }
}

function semAutorizacao(res: Response, mensagem: string) {
  res.status(401).json({ status: 'erro', mensagem, codigo: 'NAO_AUTORIZADO' });
}

function extrairToken(req: Request): string {
  return req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
}

/**
 * Exige login e um dos papéis informados.
 *
 * ADMIN passa em tudo — é a regra da igreja, e evita ter de listar ADMIN em
 * cada rota.
 */
export function exigirPapel(...papeis: Papel[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const conteudo = conferir(extrairToken(req), config.JWT_SEGREDO);
    if (!conteudo) return semAutorizacao(res, 'Faça login para continuar');

    if (conteudo.papel !== 'ADMIN' && !papeis.includes(conteudo.papel)) {
      return next(
        new ForbiddenError(
          'Seu perfil não permite esta operação',
          [...papeis, 'ADMIN'],
          conteudo.papel,
        ),
      );
    }

    req.usuario = conteudo;
    next();
  };
}

/** Só quem escreve: corrigir resenha, cadastrar e fundir pregador. */
export const exigirAdmin = exigirPapel('ADMIN');

/**
 * Porteiro antigo, por token único no ambiente.
 *
 * Continua aceito para não quebrar o que já usa `API_TOKEN` — scripts, o
 * Postman de quem já integrou. Some quando o front da Fase 7 estiver de pé.
 *
 * ponytail: dois caminhos de autenticação é um a mais do que se quer manter.
 */
export function exigirToken(req: Request, res: Response, next: NextFunction) {
  const recebido = extrairToken(req);

  // Token de sessão vale aqui também: é o caminho novo.
  const sessao = conferir(recebido, config.JWT_SEGREDO);
  if (sessao) {
    if (sessao.papel !== 'ADMIN') {
      return next(
        new ForbiddenError('Seu perfil não permite escrever', ['ADMIN'], sessao.papel),
      );
    }
    req.usuario = sessao;
    return next();
  }

  const esperado = config.API_TOKEN;
  if (!esperado) {
    logWarning('API_TOKEN não configurado e token de sessão inválido', 'auth');
    return semAutorizacao(res, 'Token ausente ou inválido');
  }

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return semAutorizacao(res, 'Token ausente ou inválido');
  }

  next();
}
