import { describe, expect, it } from 'vitest';
import { emSaoPaulo, extrairPregadorDoTitulo } from './youtube';

describe('extrairPregadorDoTitulo', () => {
  it('lê o nome depois do "I" separador', () => {
    // O separador é um "I" maiúsculo isolado, não uma barra vertical.
    expect(extrairPregadorDoTitulo('SEMENTES I Pr. Nélio Monteiro')).toBe('Nélio Monteiro');
  });

  it('aceita espaço sobrando antes do separador', () => {
    expect(extrairPregadorDoTitulo('AINDA HÁ LUGAR  I Pr. Nélio Monteiro')).toBe('Nélio Monteiro');
  });

  it('lê título sem tratamento eclesiástico', () => {
    expect(extrairPregadorDoTitulo('PASSAPORTE PARA O CÉU I Daniel Monteiro')).toBe('Daniel Monteiro');
  });

  it('não se perde quando o título tem data', () => {
    expect(extrairPregadorDoTitulo('CULTO 02-08-2026 I Pr. Nélio Monteiro')).toBe('Nélio Monteiro');
  });

  it('devolve null quando não há separador', () => {
    expect(extrairPregadorDoTitulo('CULTO DE DOMINGO')).toBeNull();
  });

  it('não confunde a letra I dentro de palavra', () => {
    expect(extrairPregadorDoTitulo('IGREJA IMPACTADA')).toBeNull();
  });
});

describe('emSaoPaulo', () => {
  it('converte o horário UTC para o fuso de Brasília', () => {
    // 2026-08-09T22:24Z é 19:24 em São Paulo, ainda domingo.
    expect(emSaoPaulo('2026-08-09T22:24:29Z')).toEqual({ data: '2026-08-09', hora: 19 });
  });

  it('não deixa o culto de domingo à noite virar segunda', () => {
    // Sem converter, 2026-08-10T01:00Z pareceria segunda-feira.
    expect(emSaoPaulo('2026-08-10T01:00:00Z').data).toBe('2026-08-09');
  });

  it('reconhece o culto da manhã', () => {
    expect(emSaoPaulo('2026-08-09T12:41:15Z')).toEqual({ data: '2026-08-09', hora: 9 });
  });
});
