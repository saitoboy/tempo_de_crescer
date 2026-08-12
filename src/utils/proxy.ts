import assert from 'assert';

/**
 * Monta a URL do proxy corporativo a partir das variáveis em componentes.
 *
 * O .env guarda PROXY_HOST/PORT/USER/PASS separados de propósito: a senha pode
 * conter "@", ":" ou "/", que quebram a URL se colados direto. Aqui cada parte
 * é escapada antes de entrar na string.
 */
export function urlDoProxy(): string | undefined {
  const host = process.env.PROXY_HOST;
  if (!host) return undefined;

  const porta = process.env.PROXY_PORT || '3128';
  const usuario = process.env.PROXY_USER;
  const senha = process.env.PROXY_PASS;

  const credenciais = usuario
    ? `${encodeURIComponent(usuario)}:${encodeURIComponent(senha ?? '')}@`
    : '';

  return `http://${credenciais}${host}:${porta}`;
}

if (require.main === module) {
  const original = { ...process.env };
  const definir = (vars: Record<string, string | undefined>) => {
    for (const chave of ['PROXY_HOST', 'PROXY_PORT', 'PROXY_USER', 'PROXY_PASS']) {
      delete process.env[chave];
    }
    Object.assign(process.env, vars);
  };

  definir({});
  assert.strictEqual(urlDoProxy(), undefined, 'sem PROXY_HOST não há proxy');

  definir({ PROXY_HOST: '10.10.30.9' });
  assert.strictEqual(urlDoProxy(), 'http://10.10.30.9:3128', 'porta padrão 3128');

  definir({
    PROXY_HOST: '10.10.30.9',
    PROXY_PORT: '3128',
    PROXY_USER: 'guilherme.saito',
    PROXY_PASS: '@159357gS',
  });
  assert.strictEqual(
    urlDoProxy(),
    'http://guilherme.saito:%40159357gS@10.10.30.9:3128',
    'o "@" da senha precisa virar %40, senão a URL quebra',
  );
  assert.doesNotThrow(() => new URL(urlDoProxy()!), 'resultado tem de ser URL válida');

  definir({ PROXY_HOST: 'proxy', PROXY_USER: 'u', PROXY_PASS: 'a:b/c@d' });
  assert.strictEqual(new URL(urlDoProxy()!).password, 'a%3Ab%2Fc%40d');

  process.env = original;
  console.log('✓ proxy.ts ok');
}
