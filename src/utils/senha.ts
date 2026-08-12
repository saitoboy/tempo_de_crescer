import assert from 'assert';
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

if (require.main === module) {
  const hash = gerarHash('senha-secreta');
  assert.ok(verificarSenha('senha-secreta', hash), 'senha correta deve passar');
  assert.ok(!verificarSenha('senha-errada', hash), 'senha errada deve falhar');
  assert.notStrictEqual(gerarHash('igual'), gerarHash('igual'), 'salt deve variar');
  assert.ok(!verificarSenha('x', 'lixo'), 'hash malformado deve falhar sem lançar');
  assert.ok(!verificarSenha('x', 'abc:def'), 'hash de tamanho errado deve falhar sem lançar');

  console.log('✓ senha.ts ok');
}
