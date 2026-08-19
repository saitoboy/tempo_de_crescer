import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Cifra simétrica para segredo guardado no banco.
 *
 * Existe por causa das chaves de API dos provedores. Elas precisam ficar no
 * banco — a cota diária da Groq obriga a trocar e acrescentar chave com
 * frequência, e fazer isso pelo `.env` custa um redeploy a cada vez — mas
 * segredo em texto puro numa coluna é senha vazada no primeiro dump.
 *
 * **AES-256-GCM**, e não CBC: o GCM autentica junto com a cifra. Sem isso, um
 * byte trocado na coluna produziria lixo decifrado em silêncio, e o rodízio
 * tentaria uma chave corrompida sem saber por quê.
 *
 * O IV é aleatório a cada gravação, então a mesma chave cifrada duas vezes dá
 * resultados diferentes — quem olhar a tabela não descobre nem que duas linhas
 * guardam o mesmo valor.
 */

const ALGORITMO = 'aes-256-gcm';

/**
 * A chave de 32 bytes, derivada do segredo do ambiente.
 *
 * SHA-256 do texto configurado: aceita segredo de qualquer tamanho sem exigir
 * que alguém gere exatamente 32 bytes à mão. Não é derivação de senha com
 * custo — não precisa ser, porque isto não protege contra tentativa e erro de
 * humano, e sim contra leitura direta do banco.
 */
function chaveMestra(): Buffer {
  const segredo = process.env.CHAVES_SEGREDO;

  if (!segredo || segredo.length < 16) {
    throw new Error(
      'CHAVES_SEGREDO ausente ou curto demais (mínimo 16 caracteres). ' +
        'É o que cifra as chaves de API guardadas no banco — sem ele, elas não podem ser lidas nem gravadas.',
    );
  }

  return createHash('sha256').update(segredo).digest();
}

/** Diz se dá para mexer em chave guardada, sem estourar. */
export function podeCifrar(): boolean {
  const segredo = process.env.CHAVES_SEGREDO;
  return Boolean(segredo && segredo.length >= 16);
}

/** Guarda como `iv:tag:conteudo`, tudo em base64. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv(ALGORITMO, chaveMestra(), iv);

  const conteudo = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);

  return [iv.toString('base64'), cifrador.getAuthTag().toString('base64'), conteudo.toString('base64')].join(':');
}

/**
 * Devolve o texto original.
 *
 * Erro aqui quase sempre significa `CHAVES_SEGREDO` diferente do que cifrou —
 * trocar o segredo torna ilegível tudo que já estava guardado. A mensagem diz
 * isso, porque "Unsupported state or unable to authenticate data" não diz.
 */
export function decifrar(guardado: string): string {
  const [iv, tag, conteudo] = guardado.split(':');

  if (!iv || !tag || !conteudo) {
    throw new Error('Segredo guardado em formato inesperado — esperava iv:tag:conteudo');
  }

  try {
    const decifrador = createDecipheriv(ALGORITMO, chaveMestra(), Buffer.from(iv, 'base64'));
    decifrador.setAuthTag(Buffer.from(tag, 'base64'));

    return Buffer.concat([
      decifrador.update(Buffer.from(conteudo, 'base64')),
      decifrador.final(),
    ]).toString('utf8');
  } catch {
    throw new Error(
      'Não foi possível decifrar. O CHAVES_SEGREDO provavelmente mudou desde que esta chave foi gravada — ' +
        'trocar o segredo torna ilegível tudo que já estava guardado.',
    );
  }
}

/** Os quatro últimos caracteres, para a tela identificar sem revelar. */
export function finalDe(chave: string): string {
  return chave.slice(-4);
}
