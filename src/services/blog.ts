/**
 * Leitura do blog da IBPS: https://pregacoesibps.blogspot.com
 *
 * A enumeração sai do sitemap.xml, que é a única fonte que bate com o widget
 * de arquivo do blog (1409 posts). O feed JSON do Blogger devolve só 1285 —
 * não serve para ingestão.
 *
 * O conteúdo sai da página renderizada, que já vem em UTF-8 correto. O
 * mojibake dos JSONs em legacy/ era defeito do scraper antigo, não do blog.
 */

const SITEMAP = 'https://pregacoesibps.blogspot.com/sitemap.xml';

export type PostBruto = {
  url: string;
  titulo: string;
  /** Data de publicação como o Blogger exibe, em ISO (YYYY-MM-DD). */
  publicadoEm: string;
  /** O post-body, ainda em HTML. */
  html: string;
  /** O post-body convertido em texto. */
  texto: string;
};

/**
 * Converte um fragmento de HTML do post em texto.
 *
 * O blog tem tags no meio das palavras, resquício de edição no editor do
 * Blogger. Por isso as tags inline somem SEM virar espaço: trocar por espaço
 * produz "R esenha" e datas como "1 9/10/2025". Só os blocos viram quebra de
 * linha.
 */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(br|p|div|li|tr|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)
    .join('\n');
}

/** Recorta o post-body do HTML da página. O template usa aspas simples. */
export function extrairCorpo(html: string): string | undefined {
  const inicio = html.search(/<div[^>]+class=['"][^'"]*post-body[^'"]*['"]/i);
  if (inicio === -1) return undefined;

  const depois = html.slice(inicio);
  const fim = depois.search(/<div[^>]+class=['"][^'"]*post-footer/i);

  return fim === -1 ? depois : depois.slice(0, fim);
}

/**
 * Data de publicação, do atributo title do <abbr class='published'>.
 *
 * Devolve só a parte da data, sem converter fuso: o blog está em -08:00 e
 * converter para o horário de Brasília mudaria o dia de posts publicados à
 * noite. A data exibida pelo blog é a que vale.
 */
export function extrairPublicadoEm(html: string): string | undefined {
  const m = html.match(/<abbr[^>]+class=['"]published['"][^>]+title=['"](\d{4}-\d{2}-\d{2})/i);
  return m?.[1];
}

export function extrairTitulo(html: string): string {
  const og = html.match(/<meta[^>]+property=['"]og:title['"][^>]*>/i)?.[0];
  const conteudo = og?.match(/content=['"]([^'"]*)['"]/i)?.[1];
  return (conteudo ?? '').trim();
}

/** Lista as URLs de todos os posts. O sitemap raiz aponta para sub-sitemaps. */
export async function listarUrls(): Promise<string[]> {
  const locs = async (url: string) => {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`sitemap ${url}: HTTP ${resposta.status}`);
    const xml = await resposta.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  };

  const raiz = await locs(SITEMAP);
  const urls = new Set<string>();

  for (const entrada of raiz) {
    if (/sitemap/i.test(entrada)) {
      for (const url of await locs(entrada)) urls.add(url);
    } else {
      urls.add(entrada);
    }
  }

  return [...urls];
}

export async function baixarPost(url: string): Promise<PostBruto> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`post ${url}: HTTP ${resposta.status}`);

  const pagina = await resposta.text();
  const corpo = extrairCorpo(pagina);
  if (!corpo) throw new Error(`post ${url}: post-body não encontrado`);

  const publicadoEm = extrairPublicadoEm(pagina);
  if (!publicadoEm) throw new Error(`post ${url}: data de publicação não encontrada`);

  return {
    url,
    titulo: extrairTitulo(pagina),
    publicadoEm,
    html: corpo,
    texto: htmlParaTexto(corpo),
  };
}
