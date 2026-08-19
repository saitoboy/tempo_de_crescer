import { describe, expect, it } from 'vitest';
import { correcaoDeDevocional } from './revisaoDeDevocional';

/**
 * A correção humana passa pelas mesmas regras da geração.
 *
 * Não é rigor por rigor: os limites são a página A5 impressa. Texto que estoura
 * o espaço quebra a diagramação venha de onde vier, e uma régua que afrouxa
 * conforme quem escreve não é régua.
 */
describe('correcaoDeDevocional', () => {
  const doisParagrafos = `${'x'.repeat(300)}\n\n${'y'.repeat(300)}`;

  it('aceita corrigir um campo só', () => {
    expect(correcaoDeDevocional.safeParse({ titulo: 'Novo título' }).success).toBe(true);
  });

  it('recusa corpo vazio', () => {
    expect(correcaoDeDevocional.safeParse({}).success).toBe(false);
  });

  it('recusa corpo que só traz manterStatus', () => {
    // Sem campo nenhum para corrigir, a chamada não tem o que fazer — e passar
    // daria a impressão de ter salvado algo.
    expect(correcaoDeDevocional.safeParse({ manterStatus: true }).success).toBe(false);
  });

  it('recusa reflexão maior que a página', () => {
    expect(correcaoDeDevocional.safeParse({ reflexao: 'x'.repeat(1200) }).success).toBe(false);
  });

  it('recusa reflexão num parágrafo só', () => {
    expect(correcaoDeDevocional.safeParse({ reflexao: 'x'.repeat(800) }).success).toBe(false);
  });

  it('aceita reflexão dentro das regras', () => {
    expect(correcaoDeDevocional.safeParse({ reflexao: doisParagrafos }).success).toBe(true);
  });

  it('recusa título que não caberia em uma linha', () => {
    expect(correcaoDeDevocional.safeParse({ titulo: 'T'.repeat(60) }).success).toBe(false);
  });

  it('aceita manterStatus junto de uma correção', () => {
    const r = correcaoDeDevocional.safeParse({ titulo: 'Ajuste', manterStatus: true });
    expect(r.success).toBe(true);
  });
});
