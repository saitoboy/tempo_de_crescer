import connection from '../connection';

/**
 * As perguntas que originaram o projeto: o que a igreja tem ensinado ao longo
 * do tempo, quem ensinou o quê, e quais partes da Escritura já subiram ao
 * púlpito.
 *
 * Duas regras valem para tudo aqui:
 *
 * 1. **Só o tema PRINCIPAL conta** nas distribuições. Contar secundários
 *    também faria a soma passar do total de pregações e a leitura ficaria
 *    errada.
 * 2. **A análise temporal usa apenas data de origem `TEXTO`.** Data corrigida
 *    à mão ou confirmada pelo YouTube é confiável, mas as 297 sem data nenhuma
 *    ficariam de fora de qualquer jeito — e misturar origens numa série
 *    histórica esconde o quanto dela é firme.
 */

export async function distribuicaoPorDoutrina() {
  const doutrinas = await connection.doutrina.findMany({
    orderBy: { numero: 'asc' },
    select: {
      numero: true,
      nome: true,
      perguntaCentral: true,
      _count: { select: { classificacoes: { where: { papel: 'PRINCIPAL' } } } },
    },
  });

  const total = doutrinas.reduce((soma, d) => soma + d._count.classificacoes, 0);

  return {
    total,
    doutrinas: doutrinas.map((d) => ({
      numero: d.numero,
      nome: d.nome,
      perguntaCentral: d.perguntaCentral,
      pregacoes: d._count.classificacoes,
      percentual: total > 0 ? Number(((100 * d._count.classificacoes) / total).toFixed(1)) : 0,
    })),
  };
}

/** Como a ênfase doutrinária se moveu ano a ano. */
export async function evolucaoPorAno() {
  const linhas = await connection.$queryRaw<
    Array<{ ano: number; doutrina: string; numero: number; total: bigint }>
  >`
    SELECT r.ano, d.nome AS doutrina, d.numero, COUNT(*) AS total
    FROM classificacao c
    JOIN resenha r ON r.id = c."resenhaId"
    JOIN doutrina d ON d.id = c."doutrinaId"
    WHERE c.papel = 'PRINCIPAL' AND r."origemData" = 'TEXTO'
    GROUP BY r.ano, d.nome, d.numero
    ORDER BY r.ano, d.numero`;

  const porAno = new Map<number, Record<string, number>>();
  for (const linha of linhas) {
    const ano = porAno.get(linha.ano) ?? {};
    ano[linha.doutrina] = Number(linha.total);
    porAno.set(linha.ano, ano);
  }

  return [...porAno.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ano, doutrinas]) => ({
      ano,
      total: Object.values(doutrinas).reduce((a, b) => a + b, 0),
      doutrinas,
    }));
}

/** O que cada pregador enfatiza. */
export async function perfilDosPregadores(minimoPregacoes = 5) {
  const linhas = await connection.$queryRaw<
    Array<{ pregador: string; tipo: string; doutrina: string; total: bigint }>
  >`
    SELECT p."nomeCanonico" AS pregador, p.tipo, d.nome AS doutrina, COUNT(*) AS total
    FROM classificacao c
    JOIN resenha r ON r.id = c."resenhaId"
    JOIN pregador p ON p.id = r."pregadorId"
    JOIN doutrina d ON d.id = c."doutrinaId"
    WHERE c.papel = 'PRINCIPAL'
    GROUP BY p."nomeCanonico", p.tipo, d.nome`;

  const porPregador = new Map<string, { tipo: string; doutrinas: Record<string, number> }>();
  for (const linha of linhas) {
    const atual = porPregador.get(linha.pregador) ?? { tipo: linha.tipo, doutrinas: {} };
    atual.doutrinas[linha.doutrina] = Number(linha.total);
    porPregador.set(linha.pregador, atual);
  }

  return [...porPregador.entries()]
    .map(([pregador, { tipo, doutrinas }]) => {
      const total = Object.values(doutrinas).reduce((a, b) => a + b, 0);
      const [enfase] = Object.entries(doutrinas).sort((a, b) => b[1] - a[1]);
      return {
        pregador,
        tipo,
        total,
        // A doutrina que mais aparece como tema principal deste pregador.
        enfase: enfase?.[0] ?? null,
        doutrinas,
      };
    })
    .filter((p) => p.total >= minimoPregacoes)
    .sort((a, b) => b.total - a.total);
}

/**
 * Cobertura bíblica: o que já foi pregado e o que nunca subiu ao púlpito.
 *
 * A pergunta interessante não é qual livro aparece mais — é qual **nunca**
 * apareceu. Por isso os 66 vêm sempre, inclusive com zero.
 */
export async function coberturaBiblica() {
  const [livros, pregados] = await Promise.all([
    connection.livroBiblico.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, nome: true, abbrev: true, testamento: true },
    }),
    connection.resenha.groupBy({
      by: ['livro'],
      where: { livro: { not: null } },
      _count: true,
    }),
  ]);

  const contagem = new Map(pregados.map((p) => [p.livro!, p._count]));

  const detalhe = livros.map((l) => ({
    ordem: l.id,
    nome: l.nome,
    abbrev: l.abbrev,
    testamento: l.testamento,
    pregacoes: contagem.get(l.nome) ?? 0,
  }));

  const cobertos = detalhe.filter((l) => l.pregacoes > 0);

  return {
    livrosCobertos: cobertos.length,
    livrosTotais: livros.length,
    percentual: Number(((100 * cobertos.length) / livros.length).toFixed(1)),
    nuncaPregados: detalhe.filter((l) => l.pregacoes === 0).map((l) => l.nome),
    maisPregados: [...cobertos].sort((a, b) => b.pregacoes - a.pregacoes).slice(0, 10),
    livros: detalhe,
  };
}

/** Números da capa: o que existe no acervo agora. */
export async function panorama() {
  const [resenhas, cultos, comVideo, pregadores, devocionais, classificadas, semPregador, semData] =
    await Promise.all([
      connection.resenha.count(),
      connection.culto.count(),
      connection.culto.count({ where: { youtubeVideoId: { not: null } } }),
      connection.pregador.count(),
      connection.devocional.count(),
      connection.resenha.count({ where: { classificacoes: { some: { papel: 'PRINCIPAL' } } } }),
      connection.resenha.count({ where: { pregadorId: null } }),
      connection.resenha.count({ where: { dataPregacao: null } }),
    ]);

  const anos = await connection.resenha.aggregate({ _min: { ano: true }, _max: { ano: true } });

  return {
    resenhas,
    cultos,
    cultosComVideo: comVideo,
    pregadores,
    devocionais,
    classificadas,
    periodo: { de: anos._min.ano, ate: anos._max.ano },
    revisaoPendente: { semPregador, semData },
  };
}
