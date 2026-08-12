import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Hash de senha com scrypt da stdlib do Node — sem dependência externa.
 * Formato armazenado: "salt:hash", ambos em hex.
 */

const TAMANHO_SALT = 16;
const TAMANHO_HASH = 64;

export function gerarHash(senha: string): string {
  const salt = randomBytes(TAMANHO_SALT).toString('hex');
  const hash = scryptSync(senha, salt, TAMANHO_HASH).toString('hex');
  return `${salt}:${hash}`;
}

export function verificarSenha(senha: string, armazenado: string): boolean {
  const [salt, hash] = armazenado.split(':');
  if (!salt || !hash) return false;

  const esperado = Buffer.from(hash, 'hex');
  if (esperado.length !== TAMANHO_HASH) return false;

  const calculado = scryptSync(senha, salt, TAMANHO_HASH);
  return timingSafeEqual(esperado, calculado);
}
