import { afterEach, describe, expect, it } from 'vitest';
import { urlDoProxy } from './proxy';

const CHAVES = ['PROXY_HOST', 'PROXY_PORT', 'PROXY_USER', 'PROXY_PASS'] as const;

function definir(vars: Partial<Record<(typeof CHAVES)[number], string>>) {
  for (const chave of CHAVES) delete process.env[chave];
  Object.assign(process.env, vars);
}

afterEach(() => definir({}));

describe('urlDoProxy', () => {
  it('devolve undefined sem PROXY_HOST', () => {
    definir({});
    expect(urlDoProxy()).toBeUndefined();
  });

  it('usa 3128 como porta padrão', () => {
    definir({ PROXY_HOST: '10.10.30.9' });
    expect(urlDoProxy()).toBe('http://10.10.30.9:3128');
  });

  it('escapa o "@" da senha, que senão quebra a URL', () => {
    definir({
      PROXY_HOST: '10.10.30.9',
      PROXY_PORT: '3128',
      PROXY_USER: 'guilherme.saito',
      PROXY_PASS: '@159357gS',
    });
    expect(urlDoProxy()).toBe('http://guilherme.saito:%40159357gS@10.10.30.9:3128');
    expect(() => new URL(urlDoProxy()!)).not.toThrow();
  });

  it('escapa os outros caracteres que quebram a URL', () => {
    definir({ PROXY_HOST: 'proxy', PROXY_USER: 'u', PROXY_PASS: 'a:b/c@d' });
    expect(new URL(urlDoProxy()!).password).toBe('a%3Ab%2Fc%40d');
  });

  it('omite as credenciais quando não há usuário', () => {
    definir({ PROXY_HOST: 'proxy', PROXY_PASS: 'ignorada' });
    expect(urlDoProxy()).toBe('http://proxy:3128');
  });
});
