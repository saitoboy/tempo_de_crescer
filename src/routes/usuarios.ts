import { randomBytes } from 'crypto';
import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import connection from '../connection';
import { assincrono } from '../middlewares/erros';
import { logInfo, NotFoundError, ValidationError } from '../utils/logger';
import { CAMPOS_DO_USUARIO as CAMPOS, listarUsuarios } from '../services/usuarios';
import { gerarHash } from '../utils/senha';

/**
 * Cadastro de quem entra na API.
 *
 * Montado sob `exigirPapel()` no index — só ADMIN chega aqui. Por isso as rotas
 * não repetem o porteiro, e `req.usuario` está sempre preenchido: o caminho do
 * `API_TOKEN` do ambiente não passa por este roteador, e sem sessão não haveria
 * como saber quem é "você" nas travas abaixo.
 */
export const rotasUsuarios = Router();

const SENHA = z.string().min(8, 'mínimo de 8 caracteres').max(200);

export const novoUsuario = z.object({
  nome: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  senha: SENHA,
  papel: z.enum(['ADMIN', 'PASTOR', 'LIDER']).default('LIDER'),
});

export const alteracaoUsuario = z
  .object({
    nome: z.string().trim().min(2).max(80),
    papel: z.enum(['ADMIN', 'PASTOR', 'LIDER']),
    ativo: z.boolean(),
  })
  .partial();

/** Sem `senha`, o servidor sorteia uma e devolve — é o caso de "esqueci a minha". */
export const redefinicaoDeSenha = z.object({ senha: SENHA.optional() });

const idNaRota = z.object({ id: z.uuid() });

/**
 * Ninguém mexe no próprio papel nem se desativa.
 *
 * Sem isto, o único ADMIN se rebaixa a LIDER por engano e o sistema fica sem
 * ninguém que possa desfazer — a recuperação seria por SQL na mão em produção.
 * Como a trava vale para todos, sempre resta ao menos um ADMIN ativo.
 */
function recusarAutoSabotagem(req: Request, id: string, acao: string) {
  if (req.usuario?.sub === id) {
    throw new ValidationError(`Você não pode ${acao} a própria conta`, [
      { campo: 'id', mensagem: 'peça a outro administrador' },
    ]);
  }
}

async function exigirUsuario(id: string) {
  const alvo = await connection.usuario.findUnique({ where: { id }, select: { id: true } });
  if (!alvo) throw new NotFoundError('Usuário não encontrado');
}

rotasUsuarios.get(
  '/',
  assincrono(async (_req, res) => {
    res.json(await listarUsuarios());
  }),
);

rotasUsuarios.post(
  '/',
  assincrono(async (req, res) => {
    const dados = novoUsuario.parse(req.body);

    // O @unique do banco também barraria, mas o erro do Prisma sairia como 500
    // genérico; aqui o front recebe o campo que está errado.
    const repetido = await connection.usuario.findUnique({
      where: { email: dados.email },
      select: { id: true },
    });
    if (repetido) {
      throw new ValidationError('Já existe um usuário com este e-mail', [
        { campo: 'email', mensagem: 'e-mail já cadastrado' },
      ]);
    }

    const criado = await connection.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        papel: dados.papel,
        senhaHash: gerarHash(dados.senha),
      },
      select: CAMPOS,
    });

    logInfo(`usuário criado: ${criado.email} (${criado.papel})`, 'auth');
    res.status(201).json(criado);
  }),
);

/** Nome, papel e ativo. A senha tem rota própria, para não trocar sem querer. */
rotasUsuarios.patch(
  '/:id',
  assincrono(async (req, res) => {
    const { id } = idNaRota.parse(req.params);
    const dados = alteracaoUsuario.parse(req.body);

    if (dados.papel !== undefined || dados.ativo !== undefined) {
      recusarAutoSabotagem(req, id, 'alterar o papel ou desativar');
    }
    await exigirUsuario(id);

    res.json(await connection.usuario.update({ where: { id }, data: dados, select: CAMPOS }));
  }),
);

/**
 * Reset de senha por administrador.
 *
 * A senha sorteada aparece uma única vez, na resposta — não fica gravada em
 * lugar nenhum em texto claro. Quem reseta anota e entrega à pessoa.
 */
rotasUsuarios.post(
  '/:id/senha',
  assincrono(async (req, res) => {
    const { id } = idNaRota.parse(req.params);
    const { senha } = redefinicaoDeSenha.parse(req.body ?? {});

    await exigirUsuario(id);

    const sorteada = senha ? undefined : randomBytes(9).toString('base64url');
    await connection.usuario.update({
      where: { id },
      data: { senhaHash: gerarHash(senha ?? sorteada!) },
    });

    logInfo(`senha redefinida para o usuário ${id}`, 'auth');
    res.json({ status: 'ok', senha: sorteada });
  }),
);

rotasUsuarios.delete(
  '/:id',
  assincrono(async (req, res) => {
    const { id } = idNaRota.parse(req.params);
    recusarAutoSabotagem(req, id, 'excluir');

    const { count } = await connection.usuario.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundError('Usuário não encontrado');

    logInfo(`usuário ${id} excluído`, 'auth');
    res.json({ status: 'ok' });
  }),
);
