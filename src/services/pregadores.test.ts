import { describe, expect, it } from 'vitest';
import { chave, resolverPregador, type PregadorConhecido } from './pregadores';

const CADASTRO: PregadorConhecido[] = [
  { id: '1', nomeCanonico: 'Nélio Monteiro', aliases: ['nelio monteiro', 'nélio monteiro', 'nelio', 'nélio'] },
  { id: '2', nomeCanonico: 'Ryan Souza', aliases: ['ryan sousa', 'ryan souza', 'ryan'] },
  { id: '3', nomeCanonico: 'Fernando Arêdes', aliases: ['fernando arede', 'fernando arêde'] },
];

describe('chave', () => {
  it('ignora acento, caixa e pontuação', () => {
    expect(chave('Nélio Monteiro')).toBe(chave('NELIO MONTEIRO'));
    expect(chave('Nélio Monteiro.')).toBe('nelio monteiro');
  });

  it('junta espaços repetidos', () => {
    expect(chave('  Ryan   Souza  ')).toBe('ryan souza');
  });
});

describe('resolverPregador', () => {
  it('casa pelo nome canônico, com ou sem acento', () => {
    expect(resolverPregador('Nélio Monteiro', CADASTRO)?.id).toBe('1');
    expect(resolverPregador('NELIO MONTEIRO', CADASTRO)?.id).toBe('1');
  });

  it('casa pelos apelidos', () => {
    expect(resolverPregador('Nélio', CADASTRO)?.id).toBe('1');
    expect(resolverPregador('nelio', CADASTRO)?.id).toBe('1');
  });

  it('une as grafias que o blog usa para a mesma pessoa', () => {
    // O blog escreve "Sousa" e "Souza"; o cadastro guarda uma só.
    expect(resolverPregador('Ryan Sousa', CADASTRO)?.nomeCanonico).toBe('Ryan Souza');
    expect(resolverPregador('Ryan Souza', CADASTRO)?.nomeCanonico).toBe('Ryan Souza');
  });

  it('resolve nome que o blog escreve errado', () => {
    // O correto é "Arêdes"; o blog escreveu "Arede" e "Arêde".
    expect(resolverPregador('Fernando Arede', CADASTRO)?.nomeCanonico).toBe('Fernando Arêdes');
    expect(resolverPregador('Fernando Arêde', CADASTRO)?.nomeCanonico).toBe('Fernando Arêdes');
  });

  it('devolve null para quem não está no cadastro', () => {
    // Quem chama decide se cadastra — nunca inventa por conta própria.
    expect(resolverPregador('Fulano da Silva', CADASTRO)).toBeNull();
    expect(resolverPregador('Nelio Montero', CADASTRO)).toBeNull();
  });

  it('devolve null para nome vazio ou só pontuação', () => {
    expect(resolverPregador('', CADASTRO)).toBeNull();
    expect(resolverPregador('...', CADASTRO)).toBeNull();
  });
});
