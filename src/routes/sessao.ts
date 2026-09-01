import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import connection from '../connection';
import { exigirPapel } from '../middlewares/autenticacao';
import { assincrono } from '../middlewares/erros';
import { emitir } from '../services/token';
import { logInfo, logWarning } from '../utils/logger';
import { gerarHash, verificarSenha } from '../utils/senha';

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

export const trocaDeSenha = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8, 'mínimo de 8 caracteres').max(200),
});

/**
 * Troca da própria senha.
 *
 * Exige a senha atual mesmo já havendo sessão válida: token roubado ou máquina
 * deixada aberta não pode virar posse permanente da conta.
 */
rotasSessao.patch(
  '/senha',
  exigirPapel('LIDER', 'PASTOR'),
  assincrono(async (req, res) => {
    const { senhaAtual, novaSenha } = trocaDeSenha.parse(req.body);

    const usuario = await connection.usuario.findUnique({ where: { id: req.usuario!.sub } });
    if (!usuario || !verificarSenha(senhaAtual, usuario.senhaHash)) {
      logWarning(`troca de senha recusada para ${req.usuario!.email}`, 'auth');
      res.status(401).json({
        status: 'erro',
        mensagem: 'Senha atual incorreta',
        codigo: 'NAO_AUTORIZADO',
      });
      return;
    }

    await connection.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash: gerarHash(novaSenha) },
    });

    logInfo(`senha trocada por ${usuario.email}`, 'auth');
    res.json({ status: 'ok' });
  }),
);
