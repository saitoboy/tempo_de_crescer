import 'dotenv/config';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { baixarPost, listarUrls, type PostBruto } from '../services/blog';
import { aplicarProxy } from '../utils/proxy';

/**
 * Baixa todos os posts do blog para um cache em disco.
 *
 * Existe para não bater no blog a cada iteração do parser: 1409 páginas é
 * grosseria e é lento. O cache é gitignored; rodar de novo só busca o que
 * ainda não está lá.
 */

const PASTA = '.cache_blog';
const ARQUIVO = join(PASTA, 'posts.json');

// ponytail: 6 em paralelo é educado com o blog. Se um dia incomodar, baixa.
const PARALELAS = 6;

async function emLotes<T, R>(itens: T[], tamanho: number, fn: (item: T) => Promise<R>) {
  const resultados: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultados.push(...(await Promise.all(itens.slice(i, i + tamanho).map(fn))));
    process.stdout.write(`\r  ${Math.min(i + tamanho, itens.length)}/${itens.length}`);
  }
  console.log('');
  return resultados;
}

async function main() {
  const proxy = aplicarProxy();
  if (proxy) console.log(`via proxy ${proxy}`);

  mkdirSync(PASTA, { recursive: true });

  const cache: Record<string, PostBruto> = existsSync(ARQUIVO)
    ? JSON.parse(readFileSync(ARQUIVO, 'utf8'))
    : {};

  console.log('Lendo sitemap...');
  const urls = await listarUrls();
  console.log(`  ${urls.length} posts no sitemap`);

  const faltando = urls.filter((url) => !cache[url]);
  console.log(`  ${Object.keys(cache).length} em cache, ${faltando.length} a baixar`);

  if (faltando.length > 0) {
    const falhas: Array<{ url: string; erro: string }> = [];

    await emLotes(faltando, PARALELAS, async (url) => {
      try {
        cache[url] = await baixarPost(url);
      } catch (e) {
        falhas.push({ url, erro: (e as Error).message });
      }
    });

    writeFileSync(ARQUIVO, JSON.stringify(cache));

    if (falhas.length > 0) {
      console.log(`\n${falhas.length} falharam:`);
      falhas.slice(0, 20).forEach((f) => console.log(`  ${f.erro}`));
    }
  }

  console.log(`\n✓ ${Object.keys(cache).length} posts em ${ARQUIVO}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
