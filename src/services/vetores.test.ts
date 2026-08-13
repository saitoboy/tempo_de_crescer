import { describe, expect, it } from 'vitest';
import { emAfinidade, maisParecidos, semelhanca } from './vetores';

describe('semelhanca', () => {
  it('vetores iguais dão 1', () => {
    expect(semelhanca([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('vetores opostos dão -1', () => {
    expect(semelhanca([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('vetores perpendiculares dão 0', () => {
    expect(semelhanca([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('nunca passa de 1 nem fica abaixo de -1', () => {
    // Arredondamento pode empurrar o produto para fora da faixa, e a
    // porcentagem exibida não pode passar de 100.
    expect(semelhanca([1, 1], [1, 1])).toBeLessThanOrEqual(1);
  });

  it('devolve 0 para tamanhos diferentes ou vazio', () => {
    expect(semelhanca([1, 0], [1])).toBe(0);
    expect(semelhanca([], [])).toBe(0);
  });
});

describe('emAfinidade', () => {
  it('reescala o conjunto: o melhor vira 100, o pior vira 0', () => {
    // O cosseno deste modelo se agrupa entre 85% e 90%, e o número absoluto
    // não distinguiria nada.
    expect(emAfinidade([0.9, 0.87, 0.85])).toEqual([100, 40, 0]);
  });

  it('conjunto sem variação fica todo em 100', () => {
    expect(emAfinidade([0.87, 0.87])).toEqual([100, 100]);
  });

  it('conjunto vazio não quebra', () => {
    expect(emAfinidade([])).toEqual([]);
  });
});

describe('maisParecidos', () => {
  const acervo = [
    { id: 'igual', embedding: [1, 0, 0] },
    { id: 'meio', embedding: [0.7, 0.7, 0] },
    { id: 'oposto', embedding: [-1, 0, 0] },
  ];

  it('ordena do mais parecido para o menos', () => {
    expect(maisParecidos([1, 0, 0], acervo, 3).map((r) => r.id)).toEqual(['igual', 'meio', 'oposto']);
  });

  it('respeita o k', () => {
    expect(maisParecidos([1, 0, 0], acervo, 1)).toHaveLength(1);
  });

  it('ignora quem tem dimensão diferente, em vez de comparar errado', () => {
    const comIntruso = [...acervo, { id: 'sem vetor', embedding: [] }];
    expect(maisParecidos([1, 0, 0], comIntruso, 9).map((r) => r.id)).not.toContain('sem vetor');
  });
});
