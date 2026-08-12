import { describe, expect, it } from 'vitest';
import {
  extrairData,
  extrairNatureza,
  extrairPregador,
  extrairRedator,
  extrairReferencia,
  extrairTurno,
} from './parserResenha';

const LIVROS = ['Gênesis', 'Êxodo', 'Salmos', 'Isaías', 'Mateus', 'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', '1 Coríntios', 'Colossenses', '2 Timóteo', 'Hebreus', 'Apocalipse'];

describe('extrairData', () => {
  it('lê a data escrita no texto', () => {
    const texto = 'Resenha do Culto da noite de Domingo\n28/12/2025\n"Desafios para o novo ano"';
    expect(extrairData(texto, '2025-12-29')).toEqual({ iso: '2025-12-28', anoCorrigido: false });
  });

  it('corrige o ano quando o dia da semana confirma', () => {
    // Caso real: escreveram 2025 em janeiro de 2026. 07/01/2026 é quarta.
    const texto = 'Resenha do Culto de quarta-feira\n07/01/2025\n"Apocalipse - Pérgamo somos nós"';
    expect(extrairData(texto, '2026-01-08')).toEqual({ iso: '2026-01-07', anoCorrigido: true });
  });

  it('corrige quando o erro é de dois anos e o domingo confirma', () => {
    // Caso real: escreveram 2024, publicado em 2022. 01/05/2022 é domingo.
    const texto = 'Resenha do Culto da noite de domingo\n01/05/2024\n"A Graça Salvadora de Deus."';
    expect(extrairData(texto, '2022-05-01')).toEqual({ iso: '2022-05-01', anoCorrigido: true });
  });

  it('NÃO corrige sem cabeçalho que confirme o dia', () => {
    // Sem "quarta" nem "domingo" no cabeçalho não há como validar: mantém.
    const texto = 'João: 14. 6. Respondeu-lhe Jesus\n22/05/2016\nEu sou o caminho';
    expect(extrairData(texto, '2017-05-22')).toEqual({ iso: '2016-05-22', anoCorrigido: false });
  });

  it('NÃO mexe nas resenhas antigas digitadas depois', () => {
    // 43 posts de 2016 carregam datas de 2012 a 2015 e são legítimos.
    const texto = 'Resenha do Culto da noite de domingo\n01/07/2012\nA verdadeira Felicidade';
    expect(extrairData(texto, '2016-08-21')).toEqual({ iso: '2012-07-01', anoCorrigido: false });
  });

  it('devolve null quando o texto não traz data', () => {
    expect(extrairData('Resenha do Culto\nTrata-se de um salmo profético.', '2016-11-23')).toBeNull();
  });

  it('ignora número que não é data válida', () => {
    expect(extrairData('leia 45/13/2020 ali', '2020-01-01')).toBeNull();
  });
});

describe('extrairTurno', () => {
  it('lê manhã como DIA e noite como NOITE', () => {
    expect(extrairTurno('Resenha do Culto da manhã de Domingo\ntexto', null)).toBe('DIA');
    expect(extrairTurno('Resenha do Culto da noite de Domingo\ntexto', null)).toBe('NOITE');
  });

  it('quarta sem marcador é NOITE: não existe culto de manhã na quarta', () => {
    // Essa regra sozinha resolve 295 posts do acervo.
    expect(extrairTurno('Resenha do Culto\ntexto', '2026-01-07')).toBe('NOITE');
  });

  it('o texto tem prioridade sobre a regra do calendário', () => {
    expect(extrairTurno('Resenha do Culto da manhã\ntexto', '2026-01-07')).toBe('DIA');
  });

  it('domingo sem marcador fica indefinido', () => {
    expect(extrairTurno('Resenha do Culto\ntexto', '2025-12-28')).toBeNull();
  });

  it('sem data e sem marcador fica indefinido', () => {
    expect(extrairTurno('Cristo, o Sacerdote Real\ntexto', null)).toBeNull();
  });
});

describe('extrairNatureza', () => {
  it.each([
    ['EBD da Manhã de Domingo\ntexto', 'EBD'],
    ['Resenha da Vigília de Ano Novo\ntexto', 'VIGILIA'],
    ['Resenha do Culto da Virada\ntexto', 'CELEBRACAO'],
    ['Resenha do Culto de Consagração Pastoral\ntexto', 'CELEBRACAO'],
    ['Conferência da Família\ntexto', 'CONFERENCIA'],
    ['Culto Fúnebre do irmão Souza\ntexto', 'FUNEBRE'],
    ['Resenha do Culto da noite de Domingo\ntexto', 'CULTO'],
  ])('classifica %s', (texto, esperado) => {
    expect(extrairNatureza(texto)).toBe(esperado);
  });
});

describe('extrairPregador', () => {
  it('lê a assinatura do fim', () => {
    expect(extrairPregador('corpo da mensagem\nPastor Nélio Monteiro\nIBPS')).toBe('Nélio Monteiro');
  });

  it('junta o nome quebrado entre linhas', () => {
    // Caso real e frequente no blog.
    expect(extrairPregador('corpo\nPastor Nélio\nMonteiro\nIBPS')).toBe('Nélio Monteiro');
  });

  it('NÃO confunde a redatora com o pregador', () => {
    const texto = 'corpo\nMensagem do Pastor Nélio Monteiro\nEditado por Elizabete Lacerda Paulo\nIBPS';
    expect(extrairPregador(texto)).toBe('Nélio Monteiro');
  });

  it('entende os outros títulos usados', () => {
    expect(extrairPregador('corpo\nSeminarista Gabriel Monteiro\nIBPS')).toBe('Gabriel Monteiro');
    expect(extrairPregador('corpo\nIrmão Daniel Monteiro\nIBPS')).toBe('Daniel Monteiro');
    expect(extrairPregador('corpo\nMissionária Jaine Feliciano.\nIBPS')).toBe('Jaine Feliciano');
  });

  it('lê "Ministrado pelo Pastor X"', () => {
    expect(extrairPregador('corpo\nMinistrado pelo Pastor Silvio Farias\nIBPS')).toBe('Silvio Farias');
  });

  it('tira a pontuação final', () => {
    expect(extrairPregador('corpo\nPastor Nélio Monteiro.\nIBPS')).toBe('Nélio Monteiro');
  });

  it('devolve null quando não há assinatura', () => {
    // 82 resenhas estão nessa situação e vão para a fila de PATCH.
    expect(extrairPregador('corpo da mensagem\nsem assinatura nenhuma')).toBeNull();
  });

  it('não confunde palavra comum com abreviação de título', () => {
    // "sem" e "pra" são palavras; só valem como título com o ponto.
    expect(extrairPregador('corpo\nninguém se salva sem Cristo')).toBeNull();
    expect(extrairPregador('corpo\nisso é pra Deus, não pra nós')).toBeNull();
  });

  it('lê assinatura em caixa alta', () => {
    expect(extrairPregador('corpo\nPASTOR NÉLIO MONTEIRO\nIBPS')).toBe('NÉLIO MONTEIRO');
  });

  it('não cola a sigla da igreja no nome', () => {
    // Sem isto o acervo ganha um pregador chamado "Jailson IBPS".
    expect(extrairPregador('corpo\nPastor Jailson IBPS')).toBe('Jailson');
    expect(extrairPregador('corpo\nPastor Áquila PIB')).toBe('Áquila');
    expect(extrairPregador('corpo\nPastor Gabriel Igreja Batista do Parque Safira')).toBe('Gabriel');
    expect(extrairPregador('corpo\nIrmão Daniel Culto da noite')).toBe('Daniel');
  });

  it('não engole preposição depois do nome', () => {
    expect(extrairPregador('corpo\nMinistrado pelo Pastor Nélio na igreja')).toBe('Nélio');
  });

  it('não deixa o título vazar para dentro do nome', () => {
    expect(extrairPregador('corpo\nMensagem do Seminarista Daniel Monteiro')).toBe('Daniel Monteiro');
  });

  it('lê assinatura apresentada sem título', () => {
    // Caso real de 04/09/2022: "Mensagem: Guilherme Saito", sem "Pastor" nem "Irmão".
    expect(extrairPregador('corpo\nMensagem: Guilherme Saito')).toBe('Guilherme Saito');
    expect(extrairPregador('corpo\nMinistrado por Fernando Arêde')).toBe('Fernando Arêde');
  });

  it('mantém as partículas de nomes compostos', () => {
    expect(extrairPregador('corpo\nIrmão Guilherme de Souza Saito')).toBe('Guilherme de Souza Saito');
    expect(extrairPregador('corpo\nPastor João da Silva')).toBe('João da Silva');
  });

  it('não termina o nome numa partícula', () => {
    expect(extrairPregador('corpo\nPastor Nélio de manhã')).toBe('Nélio');
  });

  it('não gruda o turno no fim do nome', () => {
    // Caso real: 7 resenhas viraram um pregador chamado "Nélio Monteiro Noite".
    expect(extrairPregador('corpo\nPastor Nélio Monteiro\nNoite de 28/12/2016')).toBe('Nélio Monteiro');
    expect(extrairPregador('corpo\nPastor Nélio Monteiro Manhã de Domingo')).toBe('Nélio Monteiro');
  });

  it('em culto fúnebre, o homenageado não é o pregador', () => {
    // Caso real de 20/01/2017: o irmão Souza era o falecido, e foi cadastrado
    // como pregador da própria cerimônia.
    const texto = 'corpo\nIgreja Batista do Parque Safira\nCulto Fúnebre do irmão Souza\n20/01/2017';
    expect(extrairPregador(texto)).toBeNull();
  });

  it('não aceita palavra do texto devocional como pregador', () => {
    expect(extrairPregador('corpo\nMensagem de Deus para você')).toBeNull();
    expect(extrairPregador('corpo\nMinistrado pela Palavra de Deus')).toBeNull();
  });
});

describe('extrairRedator', () => {
  it('reconhece as três formas com que ela assina', () => {
    expect(extrairRedator('corpo\nEditado por Elizabete Lacerda Paulo\nIBPS')).toBe('Elizabete Lacerda Paulo');
    expect(extrairRedator('corpo\nEditada por Elizabete Lacerda\nIBPS')).toBe('Elizabete Lacerda Paulo');
    expect(extrairRedator('corpo\nBeth\nIgreja Batista do Parque Safira')).toBe('Elizabete Lacerda Paulo');
  });

  it('devolve null quando não há crédito de redação', () => {
    expect(extrairRedator('corpo\nPastor Nélio Monteiro\nIBPS')).toBeNull();
  });
});

describe('extrairReferencia', () => {
  it('lê a referência do fim do título', () => {
    expect(extrairReferencia('Desafios para o novo ano - Lucas 2:41-52', LIVROS)).toEqual({
      textoBase: 'Lucas 2:41-52',
      livro: 'Lucas',
      capitulo: 2,
      versiculos: '41-52',
    });
  });

  it('lê título que é só a referência, como em 2016', () => {
    expect(extrairReferencia('João 3:3', LIVROS)).toMatchObject({ livro: 'João', capitulo: 3, versiculos: '3' });
  });

  it('entende livro com número na frente', () => {
    expect(extrairReferencia('1 Coríntios 11:20-26', LIVROS)).toMatchObject({ livro: '1 Coríntios', capitulo: 11 });
  });

  it('casa mesmo sem acento ou com caixa diferente', () => {
    expect(extrairReferencia('Genesis 5:21', LIVROS)).toMatchObject({ livro: 'Gênesis' });
  });

  it('recusa palavra que não é livro da Bíblia', () => {
    // Sem essa checagem, "Reunião 3:16" viraria referência bíblica.
    expect(extrairReferencia('Reunião 3:16', LIVROS)).toMatchObject({ livro: null, textoBase: null });
  });

  it('devolve vazio quando o título não tem referência', () => {
    expect(extrairReferencia('Espelho, espelho meu', LIVROS)).toMatchObject({ livro: null });
  });
});
