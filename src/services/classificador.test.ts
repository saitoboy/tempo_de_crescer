import { describe, expect, it } from 'vitest';
import {
  calcularDensidades,
  calcularEstatisticas,
  classificar,
  DOUTRINAS,
  type Densidades,
} from './classificador';
import { conferirExclusividade } from './marcadores';

const CRISTO = 4;
const SALVACAO = 5;
const ESPIRITO = 6;
const ULTIMAS = 8;

describe('vocabulário', () => {
  it('nenhuma expressão pertence a duas doutrinas', () => {
    // No classificador antigo "vida eterna" estava na Salvação e nas Últimas
    // Coisas, e contava dobrado.
    expect(conferirExclusividade()).toEqual([]);
  });
});

describe('calcularDensidades', () => {
  it('divide pelo tamanho, para textos de tamanhos diferentes serem comparáveis', () => {
    const curto = calcularDensidades('', 'a cruz de cristo salva');
    const longo = calcularDensidades('', `a cruz de cristo salva ${'palavra '.repeat(200)}`);
    expect(curto[CRISTO]).toBeGreaterThan(longo[CRISTO]);
  });

  it('dá mais peso ao que está no título', () => {
    const noTitulo = calcularDensidades('A cruz de Cristo', 'texto qualquer sem marcador');
    const noCorpo = calcularDensidades('Tema qualquer', 'a cruz de cristo aparece aqui');
    expect(noTitulo[CRISTO]).toBeGreaterThan(noCorpo[CRISTO]);
  });

  it('ignora acento e caixa', () => {
    expect(calcularDensidades('', 'RESSURREIÇÃO DE CRISTO')[CRISTO]).toBeGreaterThan(0);
  });

  it('conta ocorrências repetidas', () => {
    const uma = calcularDensidades('', 'novo nascimento');
    const tres = calcularDensidades('', 'novo nascimento novo nascimento novo nascimento');
    expect(tres[SALVACAO]).toBeGreaterThan(uma[SALVACAO]);
  });

  describe('desambiguação', () => {
    // As ambíguas não pertencem a doutrina nenhuma: quem decide é o contexto.
    // No classificador antigo essas regras existiam e nunca eram chamadas.

    it('"vida eterna" com contexto de novo nascimento vai para a Salvação', () => {
      // Caso real: João 3:1-10 era classificado como escatologia.
      const d = calcularDensidades('', 'quem crer tera a vida eterna, e preciso nascer de novo');
      expect(d[SALVACAO]).toBeGreaterThan(0);
      expect(d[ULTIMAS]).toBe(0);
    });

    it('"vida eterna" com contexto de juízo vai para as Últimas Coisas', () => {
      const d = calcularDensidades('', 'apos o juizo, os justos herdam a vida eterna na eternidade');
      expect(d[ULTIMAS]).toBeGreaterThan(0);
    });

    it('"graça" com contexto soteriológico vai para a Salvação', () => {
      const d = calcularDensidades('', 'somos justificados pela graca, e nao por obras');
      expect(d[SALVACAO]).toBeGreaterThan(0);
    });

    it('"graça" com contexto de atributo divino vai para a Doutrina de Deus', () => {
      const d = calcularDensidades('', 'a graca faz parte do carater de deus, do que ele e');
      expect(d[2]).toBeGreaterThan(0);
    });

    it('ambígua sem contexto que decida é descartada', () => {
      // Melhor perder o sinal do que atribuí-lo à doutrina errada.
      const d = calcularDensidades('', 'ele falou sobre a vida eterna naquele dia');
      expect(d[SALVACAO]).toBe(0);
      expect(d[ULTIMAS]).toBe(0);
    });
  });
});

describe('classificar', () => {
  /** Corpus onde todo texto fala muito de Cristo — como o real. */
  function corpusQueSempreFalaDeCristo(): Densidades[] {
    return Array.from({ length: 40 }, () =>
      calcularDensidades('', 'jesus cristo salvador jesus cristo nosso senhor jesus'),
    );
  }

  it('citar Jesus o tempo todo NÃO faz a pregação ser sobre cristologia', () => {
    // O caso que motivou toda a abordagem.
    const corpus = corpusQueSempreFalaDeCristo();
    const estatisticas = calcularEstatisticas(corpus);

    const maisDoMesmo = calcularDensidades('', 'jesus cristo salvador jesus cristo nosso senhor jesus');
    const resultado = classificar(maisDoMesmo, estatisticas);

    expect(Math.abs(resultado.zscores[CRISTO])).toBeLessThan(1);
    expect(resultado.principal).not.toBe(CRISTO);
  });

  it('mas falar de cristologia acima da linha de base, sim', () => {
    const corpus = corpusQueSempreFalaDeCristo();
    corpus.push(calcularDensidades('A encarnação', 'encarnacao cruz de cristo expiacao ressurreicao de cristo'));
    const estatisticas = calcularEstatisticas(corpus);

    const sobreCristo = calcularDensidades(
      'A encarnação',
      'encarnacao cruz de cristo expiacao ressurreicao de cristo mediador',
    );
    expect(classificar(sobreCristo, estatisticas).principal).toBe(CRISTO);
  });

  it('marca como indefinido quando nada se destaca', () => {
    const corpus = Array.from({ length: 20 }, () => calcularDensidades('', 'texto comum sem marcador'));
    const estatisticas = calcularEstatisticas(corpus);
    const resultado = classificar(calcularDensidades('', 'texto comum sem marcador'), estatisticas);

    expect(resultado.indefinido).toBe(true);
    expect(resultado.principal).toBeNull();
  });

  it('não devolve mais de dois secundários', () => {
    const corpus = Array.from({ length: 30 }, () => calcularDensidades('', 'texto neutro'));
    corpus.push(
      calcularDensidades('', 'cruz de cristo justificacao pela fe espirito santo corpo de cristo juizo final'),
    );
    const estatisticas = calcularEstatisticas(corpus);

    const denso = calcularDensidades(
      '',
      'cruz de cristo justificacao pela fe espirito santo corpo de cristo juizo final',
    );
    expect(classificar(denso, estatisticas).secundarios.length).toBeLessThanOrEqual(2);
  });

  it('o secundário nunca repete o principal', () => {
    const corpus = Array.from({ length: 20 }, () => calcularDensidades('', 'texto neutro'));
    corpus.push(calcularDensidades('', 'juizo final segunda vinda novos ceus e nova terra'));
    const estatisticas = calcularEstatisticas(corpus);

    const r = classificar(
      calcularDensidades('', 'juizo final segunda vinda novos ceus e nova terra'),
      estatisticas,
    );
    expect(r.secundarios).not.toContain(r.principal);
    expect(r.principal).toBe(ULTIMAS);
  });

  it('corpus sem variação dá z zero, não lixo de arredondamento', () => {
    // Somar centenas de valores iguais deixa um resíduo de ponto flutuante.
    // Sem guarda, dividir por esse resíduo produzia z de ±1 tirado do nada.
    const identicos = Array.from({ length: 200 }, () =>
      calcularDensidades('', 'jesus cristo salvador nosso senhor'),
    );
    const estatisticas = calcularEstatisticas(identicos);

    const r = classificar(calcularDensidades('', 'jesus cristo salvador nosso senhor'), estatisticas);
    for (const d of DOUTRINAS) {
      expect(Number.isFinite(r.zscores[d])).toBe(true);
      expect(r.zscores[d]).toBe(0);
    }
    expect(r.indefinido).toBe(true);
  });
});
