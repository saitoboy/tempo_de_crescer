/**
 * Vocabulário teológico por doutrina.
 *
 * Portado de `legacy/src/services/thematic_classifier.py`, que era conteúdo
 * curado à mão, e ampliado com os conceitos dos 57 capítulos de Grudem.
 *
 * Três defeitos do original foram corrigidos:
 *
 * 1. `"vida eterna"` estava em duas doutrinas ao mesmo tempo e contava dobrado.
 *    Agora cada expressão pertence a uma só — ver `conferirExclusividade`.
 * 2. As regras de desambiguação estavam declaradas e nunca eram aplicadas.
 *    Agora `AMBIGUAS` decide para onde vai "santificação" e "graça".
 * 3. Palavras onipresentes ("jesus", "deus", "fé") inflavam a contagem. Não
 *    são removidas — o z-score do classificador as anula sozinho, porque a
 *    média delas no corpus é alta. Ficam com peso baixo.
 */

/** Quanto vale cada tipo de marcador. Expressão específica vale mais. */
export const PESOS = { alta: 3, media: 1.5, baixa: 0.5 } as const;

export type Peso = keyof typeof PESOS;

/** numero da doutrina (1 a 8) -> expressões, por especificidade */
export const MARCADORES: Record<number, Record<Peso, string[]>> = {
  // 1 — Doutrina da Palavra de Deus
  1: {
    alta: [
      'autoridade das escrituras', 'suficiencia da palavra', 'inerrancia',
      'sola scriptura', 'pregacao expositiva', 'canon das escrituras',
      'clareza das escrituras', 'necessidade das escrituras', 'revelacao especial',
      'toda escritura e inspirada', 'palavra revelada',
    ],
    media: [
      'palavra de deus', 'assim diz o senhor', 'esta escrito',
      'segundo as escrituras', 'as escrituras dizem', 'texto biblico',
    ],
    baixa: ['biblia', 'escritura', 'escrito'],
  },

  // 2 — Doutrina de Deus
  2: {
    alta: [
      'santidade de deus', 'soberania de deus', 'atributos de deus',
      'onipotencia', 'onisciencia', 'onipresenca', 'imutabilidade',
      'trindade', 'tres pessoas', 'deus criador', 'providencia divina',
      'nada foge do controle', 'natureza divina', 'gloria de deus',
    ],
    media: [
      'deus todo-poderoso', 'santo dos santos', 'criador do ceu',
      'a vontade de deus', 'proposito de deus', 'no principio criou',
    ],
    baixa: ['criador', 'altissimo', 'soberano'],
  },

  // 3 — Doutrina do Homem
  3: {
    alta: [
      'imagem de deus', 'natureza pecaminosa', 'depravacao total',
      'queda do homem', 'pecado original', 'todos pecaram',
      'condicao humana', 'alianca com deus', 'idolatria do coracao',
    ],
    media: [
      'coracao do homem', 'inclinacao ao pecado', 'somos pecadores',
      'fragilidade humana', 'consciencia',
    ],
    baixa: ['pecado', 'pecador', 'carne', 'transgressao'],
  },

  // 4 — Doutrina de Cristo
  4: {
    alta: [
      'encarnacao', 'cruz de cristo', 'sangue de cristo', 'cordeiro de deus',
      'ressurreicao de cristo', 'morte substitutiva', 'obra redentora',
      'expiacao', 'senhorio de cristo', 'mediador', 'verdadeiro deus e verdadeiro homem',
      'ascensao', 'profeta sacerdote e rei', 'segunda pessoa da trindade',
    ],
    media: [
      'cristo morreu por', 'jesus e o senhor', 'filho de deus',
      'morte e ressurreicao', 'no calvario',
    ],
    baixa: ['jesus', 'cristo', 'salvador', 'messias'],
  },

  // 5 — Doutrina da Salvação
  5: {
    alta: [
      'justificacao pela fe', 'novo nascimento', 'nascer de novo',
      'salvos pela graca', 'arrependimento e fe', 'graca salvadora',
      'santificacao progressiva', 'sola fide', 'sola gratia',
      'eleicao', 'predestinacao', 'chamado eficaz', 'regeneracao',
      'adocao', 'perseveranca dos santos', 'glorificacao',
      'uniao com cristo', 'graca comum', 'conversao',
    ],
    media: [
      'perdao de pecados', 'reconciliacao com deus', 'justificado',
      'aceitar a jesus', 'entregar a vida',
    ],
    // "graca" não entra aqui: é ambígua e resolvida por contexto.
    baixa: ['salvacao', 'redencao', 'salvo'],
  },

  // 6 — Doutrina do Espírito Santo
  6: {
    alta: [
      'espirito santo', 'batismo no espirito', 'cheios do espirito',
      'fruto do espirito', 'dons espirituais', 'vida no espirito',
      'plenitude do espirito', 'convence do pecado', 'selo do espirito',
      'dom de profecia', 'guiados pelo espirito',
    ],
    media: ['consolador', 'poder do espirito', 'unção do espirito'],
    baixa: ['espirito', 'uncao'],
  },

  // 7 — Doutrina da Igreja
  7: {
    alta: [
      'corpo de cristo', 'noiva de cristo', 'comunhao dos santos',
      'edificar a igreja', 'missao da igreja', 'disciplina eclesiastica',
      'governo da igreja', 'ceia do senhor', 'santa ceia', 'batismo nas aguas',
      'meios de graca', 'vida comunitaria', 'membros do corpo',
    ],
    media: [
      'familia de deus', 'povo de deus', 'como igreja',
      'nossa igreja', 'irmaos em cristo', 'adoracao',
    ],
    baixa: ['igreja', 'comunidade', 'congregacao'],
  },

  // 8 — Doutrina das Últimas Coisas
  8: {
    alta: [
      'segunda vinda', 'volta de cristo', 'volta de jesus', 'juizo final',
      'ressurreicao dos mortos', 'novos ceus e nova terra', 'nova criacao',
      'milenio', 'arrebatamento', 'esperanca gloriosa', 'estado intermediario',
      'castigo eterno',
    ],
    media: ['maranata', 'dia do senhor', 'aguardamos a volta', 'patria nos ceus'],
    baixa: ['eternidade', 'ceu', 'esperanca', 'inferno'],
  },
};

/**
 * Expressões que aparecem em mais de uma doutrina e precisam de desambiguação.
 *
 * A regra é simples: vence a doutrina cujo contexto também aparece por perto.
 * Sem nenhum contexto, a expressão é ignorada — melhor perder o sinal do que
 * atribuí-lo à doutrina errada.
 *
 * Isto existia no classificador antigo e nunca era chamado.
 */
export const AMBIGUAS: Array<{
  expressao: string;
  destinos: Array<{ doutrina: number; contexto: string[] }>;
}> = [
  {
    // Santificação é obra do Espírito (6) e etapa da salvação (5).
    expressao: 'santificacao',
    destinos: [
      { doutrina: 6, contexto: ['espirito santo', 'pelo espirito', 'espirito opera'] },
      { doutrina: 5, contexto: ['justificacao', 'progressiva', 'fruto da salvacao', 'obra da graca'] },
    ],
  },
  {
    // Graça é atributo de Deus (2) e meio da salvação (5).
    expressao: 'graca',
    destinos: [
      { doutrina: 5, contexto: ['salvos pela graca', 'justificados', 'mediante a graca', 'fe'] },
      { doutrina: 2, contexto: ['atributo', 'carater de deus', 'natureza de deus'] },
    ],
  },
  {
    // "Vida eterna" é a posse presente de quem creu (5) e o destino final (8).
    // Sem esta regra, João 3 — o texto do novo nascimento — era classificado
    // como escatologia, porque "vida eterna" só valia para as Últimas Coisas.
    expressao: 'vida eterna',
    destinos: [
      {
        doutrina: 5,
        contexto: ['nascer de novo', 'novo nascimento', 'crer', 'creio', 'fe', 'salvo', 'regeneracao'],
      },
      {
        doutrina: 8,
        contexto: ['ressurreicao dos mortos', 'juizo', 'volta de cristo', 'segunda vinda', 'eternidade', 'novos ceus'],
      },
    ],
  },
  {
    // Fé é a resposta que salva (5) e a confiança que sustenta o crente (3).
    expressao: 'fe',
    destinos: [
      { doutrina: 5, contexto: ['justificacao', 'arrependimento', 'salvos', 'crer em cristo'] },
      { doutrina: 3, contexto: ['provacao', 'dificuldade', 'confiar em deus'] },
    ],
  },
];

/**
 * Garante que nenhuma expressão esteja em duas doutrinas.
 *
 * No classificador antigo, "vida eterna" estava na Salvação e nas Últimas
 * Coisas, e contava para as duas. Um teste chama isto.
 */
export function conferirExclusividade(): string[] {
  const onde = new Map<string, number[]>();

  for (const [numero, pesos] of Object.entries(MARCADORES)) {
    for (const lista of Object.values(pesos)) {
      for (const expressao of lista) {
        onde.set(expressao, [...(onde.get(expressao) ?? []), Number(numero)]);
      }
    }
  }

  return [...onde.entries()]
    .filter(([, doutrinas]) => doutrinas.length > 1)
    .map(([expressao, doutrinas]) => `"${expressao}" em ${doutrinas.join(' e ')}`);
}
