import { describe, expect, it } from 'vitest';
import { slugDaUrl, urlsNovas } from './ingestao';

const BLOG = 'https://pregacoesibps.blogspot.com';

describe('urlsNovas', () => {
  it('devolve só o que ainda não está no banco', () => {
    const sitemap = [`${BLOG}/a.html`, `${BLOG}/b.html`, `${BLOG}/c.html`];
    expect(urlsNovas(sitemap, [`${BLOG}/a.html`])).toEqual([`${BLOG}/b.html`, `${BLOG}/c.html`]);
  });

  it('devolve vazio quando o banco já tem tudo', () => {
    const sitemap = [`${BLOG}/a.html`];
    expect(urlsNovas(sitemap, [`${BLOG}/a.html`, `${BLOG}/velha.html`])).toEqual([]);
  });

  it('devolve tudo quando o banco está vazio', () => {
    const sitemap = [`${BLOG}/a.html`, `${BLOG}/b.html`];
    expect(urlsNovas(sitemap, [])).toEqual(sitemap);
  });
});

describe('slugDaUrl', () => {
  it('inclui ano e mês, porque o nome do arquivo se repete', () => {
    // "joao-81-11" aparece em 2017, 2020, 2021 e 2024: a igreja prega o mesmo
    // texto em anos diferentes. São 73 colisões no acervo.
    expect(slugDaUrl(`${BLOG}/2024/09/joao-81-11.html`)).toBe('2024-09-joao-81-11');
    expect(slugDaUrl(`${BLOG}/2017/01/joao-81-11.html`)).toBe('2017-01-joao-81-11');
  });

  it('gera slugs diferentes para o mesmo título em meses diferentes', () => {
    const a = slugDaUrl(`${BLOG}/2025/11/homens-que-andaram-com-deus.html`);
    const b = slugDaUrl(`${BLOG}/2025/12/homens-que-andaram-com-deus.html`);
    expect(a).not.toBe(b);
  });
});
