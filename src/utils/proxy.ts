import { ProxyAgent, setGlobalDispatcher } from 'undici';

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

/**
 * Faz todo o `fetch` do processo sair pelo proxy corporativo, se houver um
 * configurado. Chamar uma vez, no início de qualquer script que use a rede.
 *
 * Não dá para usar a flag `--use-env-proxy` do Node: ela lê o ambiente no
 * boot, antes do dotenv carregar o .env. Por isso o dispatcher é montado aqui.
 */
export function aplicarProxy(): string | undefined {
  const url = urlDoProxy();
  if (!url) return undefined;

  setGlobalDispatcher(new ProxyAgent(url));
  return url.replace(/:[^:@]*@/, ':***@');
}
