import { describe, expect, it } from 'vitest';
import {
  comoCorrecaoDeFidelidade,
  estaNaEscritura,
  extrairCitacoes,
  normalizar,
} from './fidelidade';

/**
 * A ACF de verdade tem 31.106 versículos e vive no banco. Aqui bastam alguns,
 * normalizados como o serviço normaliza — o que se testa é a regra, não o
 * conteúdo da Bíblia.
 */
const BIBLIA = normalizar(
  [
    'Aquele que não conheceu pecado, ele o fez pecado por nós; para que nele fôssemos feitos justiça de Deus.',
    'Convém que eu faça as obras daquele que me enviou, enquanto é dia; a noite vem, quando ninguém pode trabalhar.',
    'Na casa de meu Pai há muitas moradas; se não fosse assim, eu vo-lo teria dito.',
    'E disse o servo: Senhor, feito é como mandaste, e ainda há lugar.',
    'Consumado é.',
  ].join(' '),
);

describe('extrairCitacoes', () => {
  it('pega o que está entre aspas', () => {
    const texto = 'Ele disse: "Convém que eu faça as obras daquele que me enviou".';
    expect(extrairCitacoes(texto)).toEqual(['Convém que eu faça as obras daquele que me enviou']);
  });

  it('ignora aspas curtas, que são ênfase e não citação', () => {
    // "meus irmãos" é vocativo do estilo, não Escritura. Tratar como citação
    // encheria o relatório de falso positivo e ninguém olharia mais.
    expect(extrairCitacoes('Falo a vocês, "meus irmãos", com firmeza.')).toEqual([]);
  });

  it('entende aspas curvas, que é o que os modelos costumam emitir', () => {
    const texto = 'Jesus falou: “Na casa de meu Pai há muitas moradas”.';
    expect(extrairCitacoes(texto)).toHaveLength(1);
  });

  it('texto sem aspas nenhuma não gera citação', () => {
    expect(extrairCitacoes('Jesus ensinou que o Pai recebe quem vem a Ele.')).toEqual([]);
  });
});

describe('estaNaEscritura', () => {
  it('aceita citação literal', () => {
    expect(
      estaNaEscritura('Aquele que não conheceu pecado, ele o fez pecado por nós', BIBLIA),
    ).toBe(true);
  });

  it('aceita citação com uma palavra trocada', () => {
    // O pregador cita de memória e o modelo troca uma conjunção. Reprovar isto
    // reprovaria citação honesta.
    expect(
      estaNaEscritura('Convém que eu faça as obras daquele que me enviou, enquanto era dia', BIBLIA),
    ).toBe(true);
  });

  it('RECUSA a frase inventada que motivou esta trava', () => {
    // Mistura de João 14:2 com Lucas 14:22, atribuída a Jesus entre aspas.
    // Soa bíblico, tem 0,936 de proximidade vetorial com o texto bom, e é falsa.
    expect(estaNaEscritura('Na casa do Pai ainda há lugar', BIBLIA)).toBe(false);
  });

  it('recusa frase de aparência bíblica que ninguém escreveu', () => {
    expect(estaNaEscritura('Deus ajuda quem cedo madruga, diz o Senhor', BIBLIA)).toBe(false);
  });

  it('não se importa com acento, caixa e pontuação', () => {
    expect(estaNaEscritura('CONSUMADO E', BIBLIA)).toBe(true);
  });
});

describe('comoCorrecaoDeFidelidade', () => {
  it('diz ao modelo exatamente o que ele inventou', () => {
    const texto = comoCorrecaoDeFidelidade([
      { trecho: 'Na casa do Pai ainda há lugar', motivo: 'nao-esta-na-escritura' },
    ]);

    expect(texto).toContain('Na casa do Pai ainda há lugar');
    expect(texto).toContain('NÃO está na Bíblia');
  });

  it('trata referência inexistente à parte', () => {
    const texto = comoCorrecaoDeFidelidade([
      { trecho: 'Hesitações 3:16', motivo: 'referencia-nao-existe' },
    ]);

    expect(texto).toContain('não existe');
  });
});
