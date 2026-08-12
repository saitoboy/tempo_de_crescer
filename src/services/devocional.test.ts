import { describe, expect, it } from 'vitest';
import { extrairJson, montarPrompt, respostaDoModelo } from './devocional';

const RESENHA = {
  id: 'x',
  titulo: 'Deus é nosso Pastor',
  conteudoLimpo: 'Davi sabia o que era confiar em Deus em meio às adversidades.',
  textoBase: 'Salmos 23:1',
  pregador: 'Nélio Monteiro',
  doutrina: 'Doutrina de Deus',
};

describe('montarPrompt', () => {
  it('leva a resenha inteira, que é de onde o devocional nasce', () => {
    expect(montarPrompt(RESENHA)).toContain(RESENHA.conteudoLimpo);
  });

  it('informa o que se sabe da pregação', () => {
    const p = montarPrompt(RESENHA);
    expect(p).toContain('Salmos 23:1');
    expect(p).toContain('Nélio Monteiro');
    expect(p).toContain('Doutrina de Deus');
  });

  it('não quebra quando falta pregador ou texto base', () => {
    const p = montarPrompt({ ...RESENHA, textoBase: null, pregador: null, doutrina: null });
    expect(p).toContain(RESENHA.conteudoLimpo);
    expect(p).not.toContain('Pregador:');
  });

  it('pede a referência, nunca o texto do versículo', () => {
    // Modelo citando Escritura de memória erra palavra, e num livro é grave.
    expect(montarPrompt(RESENHA)).toContain('Não escreva o texto do versículo');
  });
});

describe('extrairJson', () => {
  it('lê JSON puro', () => {
    expect(extrairJson('{"titulo":"A"}')).toEqual({ titulo: 'A' });
  });

  it('lê JSON embrulhado em cercas de código', () => {
    expect(extrairJson('```json\n{"titulo":"A"}\n```')).toEqual({ titulo: 'A' });
  });

  it('lê JSON com conversa antes', () => {
    expect(extrairJson('Aqui está:\n{"titulo":"A"}')).toEqual({ titulo: 'A' });
  });
});

describe('respostaDoModelo', () => {
  const valida = {
    titulo: 'Deus é nosso Pastor',
    referencia: 'Salmos 23:1',
    reflexao: 'x'.repeat(300),
    pontosAplicacao: ['Confie em Deus como seu Pastor.', 'Reconheça o cuidado dele.', 'Busque a presença dele.'],
    oracao: 'y'.repeat(80),
  };

  it('aceita uma resposta completa', () => {
    expect(respostaDoModelo.parse(valida)).toMatchObject({ titulo: 'Deus é nosso Pastor' });
  });

  it('recusa reflexão curta demais para a página', () => {
    expect(() => respostaDoModelo.parse({ ...valida, reflexao: 'curto' })).toThrow();
  });

  it('exige de 3 a 5 pontos de aplicação, como no modelo da página', () => {
    expect(() => respostaDoModelo.parse({ ...valida, pontosAplicacao: ['só um'] })).toThrow();
    expect(() =>
      respostaDoModelo.parse({ ...valida, pontosAplicacao: Array(6).fill('aplicação prática') }),
    ).toThrow();
  });
});
