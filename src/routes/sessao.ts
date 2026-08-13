import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import connection from '../connection';
import { exigirPapel } from '../middlewares/autenticacao';
import { assincrono } from '../middlewares/erros';
import { emitir } from '../services/token';
import { logInfo, logWarning } from '../utils/logger';
import { verificarSenha } from '../utils/senha';

export const rotasSessao = Router();

export const credenciais = z.object({
  email: z.email(),
  senha: z.string().min(1),
});

/**
 * Login.
 *
 * A resposta é a mesma para e-mail inexistente, senha errada e conta inativa:
 * dizer qual dos três falhou entrega ao atacante quais e-mails existem.
 */
rotasSessao.post(
  '/login',
  assincrono(async (req, res) => {
    const { email, senha } = credenciais.parse(req.body);

    const usuario = await connection.usuario.findUnique({ where: { email } });
    const senhaConfere = usuario ? verificarSenha(senha, usuario.senhaHash) : false;

    if (!usuario || !usuario.ativo || !senhaConfere) {
      logWarning(`login recusado para ${email}`, 'auth');
      res.status(401).json({
        status: 'erro',
        mensagem: 'E-mail ou senha inválidos',
        codigo: 'NAO_AUTORIZADO',
      });
      return;
    }

    logInfo(`login de ${email} (${usuario.papel})`, 'auth');

    res.json({
      token: emitir(
        { sub: usuario.id, email: usuario.email, papel: usuario.papel },
        config.JWT_SEGREDO,
        config.JWT_HORAS,
      ),
      expiraEmHoras: config.JWT_HORAS,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    });
  }),
);

/** Quem sou eu — o front usa para saber o que mostrar. */
rotasSessao.get(
  '/eu',
  exigirPapel('LIDER', 'PASTOR'),
  assincrono(async (req, res) => {
    const usuario = await connection.usuario.findUnique({
      where: { id: req.usuario!.sub },
      select: { id: true, nome: true, email: true, papel: true, ativo: true },
    });
    res.json(usuario);
  }),
);
