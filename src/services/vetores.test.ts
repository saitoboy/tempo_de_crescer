import { describe, expect, it } from 'vitest';
import { emAfinidade, maisParecidos, semelhanca, semRedundancia } from './vetores';

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

describe('semRedundancia', () => {
  /**
   * Três "pregações sobre Ceia" quase idênticas e duas de outros assuntos.
   * O limiar de 0,9 aqui é só do teste; o de produção é 0,92, medido no corpus.
   */
  const ceiaA = [1, 0, 0];
  const ceiaB = [0.99, 0.14, 0];
  const ceiaC = [0.98, 0.2, 0];
  const batismo = [0, 1, 0];
  const missoes = [0, 0, 1];

  const vetores = new Map([
    ['ceiaA', ceiaA],
    ['ceiaB', ceiaB],
    ['ceiaC', ceiaC],
    ['batismo', batismo],
    ['missoes', missoes],
  ]);

  const ranking = [
    { id: 'ceiaA', semelhanca: 0.94 },
    { id: 'ceiaB', semelhanca: 0.93 },
    { id: 'ceiaC', semelhanca: 0.92 },
    { id: 'batismo', semelhanca: 0.9 },
    { id: 'missoes', semelhanca: 0.88 },
  ];

  it('guarda só o melhor de cada grupo parecido', () => {
    const escolhidos = semRedundancia(ranking, vetores, 5, [], 0.9);
    expect(escolhidos.map((e) => e.id)).toEqual(['ceiaA', 'batismo', 'missoes']);
  });

  it('preserva a ordem de afinidade com o tema', () => {
    const escolhidos = semRedundancia(ranking, vetores, 5, [], 0.9);
    const notas = escolhidos.map((e) => e.semelhanca);
    expect([...notas].sort((a, b) => b - a)).toEqual(notas);
  });

  it('para no limite pedido', () => {
    expect(semRedundancia(ranking, vetores, 2, [], 0.9)).toHaveLength(2);
  });

  it('descarta o que já virou devocional em outro mês', () => {
    const escolhidos = semRedundancia(ranking, vetores, 5, [ceiaA], 0.9);
    expect(escolhidos.map((e) => e.id)).toEqual(['batismo', 'missoes']);
  });

  it('sem limiar atingido, devolve o ranking inteiro', () => {
    const escolhidos = semRedundancia(ranking, vetores, 5, [], 0.999);
    expect(escolhidos).toHaveLength(5);
  });

  it('candidato sem vetor é pulado, não comparado errado', () => {
    const comIntruso = [...ranking, { id: 'sem vetor', semelhanca: 0.5 }];
    const escolhidos = semRedundancia(comIntruso, vetores, 9, [], 0.999);
    expect(escolhidos.map((e) => e.id)).not.toContain('sem vetor');
  });
});
