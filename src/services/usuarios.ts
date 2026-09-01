import connection from '../connection';

/**
 * O que a API mostra de um usuário.
 *
 * `senhaHash` fica de fora de propósito. Não é segredo recuperável — é scrypt —
 * mas devolver hash convida a ataque offline de dicionário sobre a senha de um
 * pastor.
 */
export const CAMPOS_DO_USUARIO = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
} as const;

/** Fica aqui, e não na rota, para o `conferir:contrato` poder chamar. */
export function listarUsuarios() {
  return connection.usuario.findMany({ orderBy: { nome: 'asc' }, select: CAMPOS_DO_USUARIO });
}
