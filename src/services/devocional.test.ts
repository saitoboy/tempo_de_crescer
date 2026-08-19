import { describe, expect, it } from 'vitest';
import { comoCorrecao, extrairJson, montarPrompt, respostaDoModelo } from './devocional';

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
    // Dois parágrafos: a página monta um bloco por parágrafo, e o esquema
    // recusa reflexão num bloco só.
    reflexao: `${'x'.repeat(150)}\n\n${'y'.repeat(150)}`,
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

describe('comoCorrecao', () => {
  const longa = {
    titulo: 'Deus é nosso Pastor',
    referencia: 'Salmos 23:1',
    reflexao: 'x'.repeat(1400),
    pontosAplicacao: ['confie no Senhor hoje', 'ore pela sua casa', 'leia o Salmo inteiro'],
    oracao: 'Senhor, ensina-nos a confiar em ti todos os dias da nossa vida. Amém.',
  };

  it('diz qual campo estourou e qual era o limite', () => {
    const erro = respostaDoModelo.safeParse(longa).error;
    const texto = comoCorrecao(erro);

    expect(texto).toContain('reflexao');
    expect(texto).toContain('1050');
  });

  it('erro que não é do Zod vira instrução de formato', () => {
    expect(comoCorrecao(new Error('Unexpected token'))).toContain('JSON');
  });

  it('a correção entra no prompt da segunda tentativa', () => {
    const erro = respostaDoModelo.safeParse(longa).error;
    const prompt = montarPrompt(RESENHA, comoCorrecao(erro));

    expect(prompt).toContain('tentativa anterior foi recusada');
    // O pedido original continua lá: a correção acrescenta, não substitui.
    expect(prompt).toContain('pontosAplicacao');
  });

  it('sem correção, o prompt fica igual ao de sempre', () => {
    expect(montarPrompt(RESENHA)).not.toContain('tentativa anterior');
  });
});

describe('reflexão em parágrafos', () => {
  const base = {
    titulo: 'Deus é nosso Pastor',
    referencia: 'Salmos 23:1',
    pontosAplicacao: ['Confie no Senhor hoje.', 'Ore pela sua casa.', 'Leia o Salmo inteiro.'],
    oracao: 'y'.repeat(80),
  };

  it('recusa um parágrafo só, que na página A5 vira paredão', () => {
    const num = respostaDoModelo.safeParse({ ...base, reflexao: 'x'.repeat(800) });
    expect(num.success).toBe(false);
  });

  it('aceita dois parágrafos', () => {
    const dois = `${'x'.repeat(300)}\n\n${'y'.repeat(300)}`;
    expect(respostaDoModelo.safeParse({ ...base, reflexao: dois }).success).toBe(true);
  });

  it('aceita separador com espaço na linha em branco', () => {
    // O modelo às vezes devolve "\n \n" em vez de "\n\n"; é o mesmo parágrafo.
    const frouxo = `${'x'.repeat(300)}\n \n${'y'.repeat(300)}`;
    expect(respostaDoModelo.safeParse({ ...base, reflexao: frouxo }).success).toBe(true);
  });
});
