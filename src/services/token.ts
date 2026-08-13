import { createHmac, timingSafeEqual } from 'crypto';
import type { Papel } from '../generated/prisma/enums';

/**
 * JWT assinado com HMAC-SHA256, usando só a stdlib.
 *
 * Uma biblioteca de JWT traria verificação de algoritmo, `jku`, `kid` e uma
 * dúzia de coisas que este projeto não usa — e cada uma já foi vetor de falha
 * em algum CVE. Aqui só existe um algoritmo, ele é fixo no código, e o token
 * é emitido e conferido pelo mesmo servidor.
 */

export type Conteudo = {
  /** id do usuário */
  sub: string;
  email: string;
  papel: Papel;
  /** expiração, em segundos desde a época */
  exp: number;
};

const CABECALHO = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

function base64Url(texto: string): string {
  return Buffer.from(texto, 'utf8').toString('base64url');
}

function assinar(dados: string, segredo: string): string {
  return createHmac('sha256', segredo).update(dados).digest('base64url');
}

export function emitir(conteudo: Omit<Conteudo, 'exp'>, segredo: string, duracaoHoras: number): string {
  const exp = Math.floor(Date.now() / 1000) + duracaoHoras * 3600;
  const corpo = base64Url(JSON.stringify({ ...conteudo, exp }));
  const dados = `${CABECALHO}.${corpo}`;
  return `${dados}.${assinar(dados, segredo)}`;
}

/**
 * Confere assinatura e validade.
 *
 * Devolve null para qualquer problema — token malformado, assinatura errada ou
 * expirado. Quem chama não precisa saber qual: a resposta é sempre 401.
 */
export function conferir(token: string, segredo: string): Conteudo | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [cabecalho, corpo, assinatura] = partes;

  // O algoritmo é fixo: aceitar o que vem no cabeçalho é como o ataque do
  // "alg: none" funciona.
  if (cabecalho !== CABECALHO) return null;

  const esperada = Buffer.from(assinar(`${cabecalho}.${corpo}`, segredo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;

  try {
    const conteudo = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Conteudo;
    if (typeof conteudo.exp !== 'number' || conteudo.exp < Date.now() / 1000) return null;
    return conteudo;
  } catch {
    return null;
  }
}
