import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cifrar, decifrar, finalDe, podeCifrar } from './cifra';

const ORIGINAL = process.env.CHAVES_SEGREDO;

beforeEach(() => {
  process.env.CHAVES_SEGREDO = 'segredo-de-teste-com-tamanho-suficiente';
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CHAVES_SEGREDO;
  else process.env.CHAVES_SEGREDO = ORIGINAL;
});

describe('cifra', () => {
  const chave = 'gsk_0000inventadaParaOTeste0000inventada0000';

  it('volta ao original', () => {
    expect(decifrar(cifrar(chave))).toBe(chave);
  });

  it('a mesma chave cifrada duas vezes dá resultados diferentes', () => {
    // IV aleatório: quem olhar a tabela não descobre nem que duas linhas
    // guardam o mesmo valor.
    expect(cifrar(chave)).not.toBe(cifrar(chave));
  });

  it('recusa conteúdo adulterado', () => {
    // É o ponto do GCM: sem autenticação, um byte trocado daria lixo em
    // silêncio e o rodízio tentaria uma chave corrompida sem saber por quê.
    const guardado = cifrar(chave);
    const [iv, tag, conteudo] = guardado.split(':');
    const mexido = [iv, tag, Buffer.from('outra coisa').toString('base64')].join(':');

    expect(() => decifrar(mexido)).toThrow();
  });

  it('recusa formato que não seja iv:tag:conteudo', () => {
    expect(() => decifrar('coisa-solta')).toThrow(/formato inesperado/);
  });

  it('avisa quando o segredo mudou, em vez do erro cru do node', () => {
    const guardado = cifrar(chave);
    process.env.CHAVES_SEGREDO = 'outro-segredo-completamente-diferente';

    expect(() => decifrar(guardado)).toThrow(/CHAVES_SEGREDO provavelmente mudou/);
  });

  it('exige segredo de tamanho mínimo', () => {
    process.env.CHAVES_SEGREDO = 'curto';
    expect(podeCifrar()).toBe(false);
    expect(() => cifrar(chave)).toThrow(/CHAVES_SEGREDO/);
  });

  it('sem segredo nenhum, não finge que dá', () => {
    delete process.env.CHAVES_SEGREDO;
    expect(podeCifrar()).toBe(false);
  });

  it('o final identifica sem revelar', () => {
    expect(finalDe(chave)).toBe('0000');
    expect(finalDe(chave)).not.toContain('gsk_');
  });
});
