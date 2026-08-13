import { describe, expect, it } from 'vitest';
import { conferir, emitir } from './token';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const USUARIO = { sub: 'abc', email: 'a@b.com', papel: 'ADMIN' as const };

describe('token de sessão', () => {
  it('emite e confere', () => {
    const conteudo = conferir(emitir(USUARIO, SEGREDO, 1), SEGREDO);
    expect(conteudo).toMatchObject(USUARIO);
  });

  it('recusa token assinado com outro segredo', () => {
    expect(conferir(emitir(USUARIO, SEGREDO, 1), 'outro-segredo-com-mais-de-32-caracteres')).toBeNull();
  });

  it('recusa token adulterado', () => {
    const token = emitir(USUARIO, SEGREDO, 1);
    const [cabecalho, , assinatura] = token.split('.');
    const corpoFalso = Buffer.from(JSON.stringify({ ...USUARIO, papel: 'ADMIN', exp: 9e9 })).toString('base64url');
    expect(conferir(`${cabecalho}.${corpoFalso}.${assinatura}`, SEGREDO)).toBeNull();
  });

  it('recusa o ataque do "alg: none"', () => {
    // Trocar o cabeçalho para alg none e apagar a assinatura é o ataque
    // clássico contra quem confia no algoritmo declarado pelo token.
    const cabecalho = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const corpo = Buffer.from(JSON.stringify({ ...USUARIO, exp: 9e9 })).toString('base64url');
    expect(conferir(`${cabecalho}.${corpo}.`, SEGREDO)).toBeNull();
  });

  it('recusa token expirado', () => {
    expect(conferir(emitir(USUARIO, SEGREDO, -1), SEGREDO)).toBeNull();
  });

  it('recusa lixo', () => {
    expect(conferir('', SEGREDO)).toBeNull();
    expect(conferir('a.b', SEGREDO)).toBeNull();
    expect(conferir('a.b.c', SEGREDO)).toBeNull();
  });
});
