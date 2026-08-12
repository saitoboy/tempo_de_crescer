import { describe, expect, it } from 'vitest';
import { gerarHash, verificarSenha } from './senha';

describe('senha', () => {
  it('aceita a senha correta', () => {
    expect(verificarSenha('senha-secreta', gerarHash('senha-secreta'))).toBe(true);
  });

  it('rejeita a senha errada', () => {
    expect(verificarSenha('senha-errada', gerarHash('senha-secreta'))).toBe(false);
  });

  it('usa um salt diferente a cada hash', () => {
    expect(gerarHash('igual')).not.toBe(gerarHash('igual'));
  });

  it('rejeita hash malformado sem lançar', () => {
    expect(verificarSenha('x', 'lixo')).toBe(false);
    expect(verificarSenha('x', '')).toBe(false);
  });

  it('rejeita hash de tamanho errado sem lançar', () => {
    // timingSafeEqual lança se os buffers têm tamanhos diferentes
    expect(verificarSenha('x', 'abc:def')).toBe(false);
  });
});
