import { z } from 'zod';
import connection from '../connection';
import { comoConsulta, maisParecidos, semRedundancia } from './vetores';

/**
 * Transforma a resenha de um culto em devocional para o livro.
 *
 * O texto é escrito pelo Claude Opus, chamado pelo CLI local — a assinatura em
 * vez da chave de API. Groq com llama foi testado e descartado: texto fraco.
 *
 * Duas regras que valem mais que a qualidade da prosa:
 *
 * 1. **O versículo nunca é escrito pelo modelo.** Ele indica a referência; o
 *    texto vem da tabela `Versiculo`, que tem a ACF inteira. Modelo citando
 *    Escritura de memória erra palavra, e num livro devocional isso é grave.
 * 2. **O devocional nasce da resenha, não do nada.** O que ele diz tem de ser
 *    o que foi pregado naquele culto, não teologia genérica sobre a passagem.
 */

/** Os blocos da página do livro — ver CONTEXTO/modelo-pagina.jpeg. */
export const respostaDoModelo = z.object({
  // Acima de ~34 o título quebra em duas linhas e empurra a página para fora.
  titulo: z.string().trim().min(3).max(48),
  /** Referência do versículo em destaque: "Salmos 23:1". */
  referencia: z.string().trim().min(3).max(60),
  /**
   * O teto foi medido na página A5 renderizada, não estimado: com os blocos
   * fixos ocupando 501px dos 695px úteis, sobram 194px para a reflexão, o que
   * dá cerca de 1.250 caracteres. O limite fica abaixo disso para o texto não
   * encostar no rodapé.
   */
  reflexao: z
    .string()
    .trim()
    .min(200)
    .max(1050)
    // A página do livro monta um bloco por parágrafo. Texto de 800 caracteres
    // num parágrafo só vira paredão no A5 — e acontecia: o modelo devolvia
    // ora 3, ora 2, ora 1. Como a retentativa é de graça pela API, exigir é
    // mais barato do que diagramar em volta do problema.
    .refine((t) => t.split(/\n\s*\n/).filter((p) => p.trim()).length >= 2, {
      message: 'precisa de pelo menos 2 parágrafos, separados por linha em branco',
    }),
  pontosAplicacao: z.array(z.string().trim().min(10)).min(3).max(4),
  oracao: z.string().trim().min(50),
});

export type RespostaDoModelo = z.infer<typeof respostaDoModelo>;

export type ResenhaParaDevocional = {
  id: string;
  titulo: string;
  conteudoLimpo: string;
  textoBase: string | null;
  pregador: string | null;
  doutrina: string | null;
  /** A passagem em ACF, para o modelo citar em vez de lembrar. */
  passagem?: string | null;
};

const ESTILO = `Você escreve devocionais no estilo de A.W. Tozer, em português do Brasil.

O que caracteriza esse estilo:
- Abre pelo peso teológico do texto, não por anedota nem por pergunta retórica.
- Fala com a igreja: "meus irmãos", "nossa vida", segunda pessoa do plural.
- Frases curtas e afirmativas. Exclamação usada de verdade, com moderação.
- Sustenta a afirmação com outra passagem bíblica, citada e referenciada.
- Não modera o que a Escritura afirma nem suaviza contraste doutrinário.
- Nada de linguagem corporativa, autoajuda ou motivacional.

Quatro erros que apareceram em textos anteriores e não podem se repetir:

1. NÃO comece mais de um parágrafo com "Meus irmãos". Usado três vezes
   seguidas vira ladainha. No máximo uma vez no devocional inteiro.
2. NÃO repita, dentro da reflexão, o versículo que você indicou em
   "referencia". Ele já aparece impresso em destaque logo acima, na página —
   citá-lo de novo o imprime duas vezes.
3. Escreva português correto e atual. Nada de imperativo arcaico inventado:
   "confessoai", "permitai" e "escárdia" NÃO existem. Na dúvida entre a forma
   antiga e a comum, use a comum.
4. NUNCA mande desprezar, menosprezar ou julgar pessoa alguma. Confrontar
   pecado é do estilo; mandar desprezar quem o pratica não é cristão.`;

/**
 * Um devocional nosso, já aprovado, como referência de alvo.
 *
 * Descrever estilo em adjetivos ("frases curtas", "peso teológico") funciona
 * com modelo forte, que já sabe o que aquilo significa. Modelo aberto de 20 a
 * 120 bilhões de parâmetros acerta muito mais vendo **um exemplo do produto**
 * do que lendo a descrição dele.
 *
 * Custa ~400 tokens de entrada. No CLI isso era caro; numa API gratuita é o
 * melhor negócio do prompt inteiro.
 *
 * Saiu de `Sementes` (Mateus 13:30), gerado pelo Opus e conferido. Se for
 * trocado um dia, trocar por outro **já revisado** — este bloco é o padrão de
 * qualidade, e um exemplo ruim rebaixa tudo que vier depois dele.
 */
const EXEMPLO = `{
  "titulo": "Duas sementes, dois destinos",
  "referencia": "Mateus 13:30",
  "reflexao": "Meus irmãos, o coração do homem é solo fértil. Tudo o que nele se lança germina. A questão nunca foi se a semente cresce — cresce sempre. A questão é qual semente. Cristo veio semear a boa semente: a Palavra que revela Deus e gera vida. Mas o inimigo não dorme. Ele semeia o joio na mente e no coração, e o joio cresce no meio do trigo, dentro do campo do Senhor.\\n\\nNão suavizemos isto. Jesus disse que o joio será atado em feixes e queimado no fogo (Mateus 13:40-42). Quem afirma que se pode viver com um pé no mundo e outro no Reino anuncia mensagem falsa. Deus é santo, e sem santidade ninguém verá o Senhor.\\n\\nA diferença está na raiz. Quem está em Cristo produz o fruto do Espírito; quem tem raiz no mundo produz apenas palha levada pelo vento (João 15:5). Regue a Palavra com oração. Ela não muda, e nenhuma palavra de Deus cai por terra.",
  "pontosAplicacao": [
    "Examine hoje o que tem sido semeado na sua mente.",
    "Afaste-se de quem murmura contra Deus e Seu povo.",
    "Medite na Palavra e pratique-a antes de dormir."
  ],
  "oracao": "Senhor, guarda a nossa mente e o nosso coração do joio que o inimigo lança sobre nós. Arraiga-nos em Cristo. Faze crescer em nós a Tua Palavra, até que produzamos o fruto do Teu Espírito. Amém."
}`;

/**
 * Monta o pedido.
 *
 * A resenha vai inteira: é dela que o devocional tem de nascer. O modelo não
 * escreve o versículo — só indica a referência, e o texto vem do banco.
 */
/**
 * Os devocionais nossos mais parecidos com esta pregação, como exemplo.
 *
 * Não é treino — nenhum peso muda. É contexto: em vez de um exemplo fixo, o
 * modelo vê o que **nós** já escrevemos sobre assunto próximo. Numa pregação
 * escatológica ele recebe devocionais escatológicos nossos; numa sobre a Ceia,
 * os da Ceia. É a diferença entre descrever o estilo e mostrar o alvo no
 * assunto certo.
 *
 * **`excluir` não é opcional na prática.** A resenha que está sendo escrita
 * precisa ficar de fora: se ela já tiver devocional — o caso da comparação de
 * modelos — a busca traria justamente a resposta, o modelo copiaria, e a
 * medida daria excelente por motivo errado.
 *
 * Só devocional `REVISADO` ou gerado pelo Opus entra. Exemplo ruim rebaixa
 * tudo que vier depois dele.
 */
export async function exemplosParecidos(
  resenhaId: string,
  quantos = 2,
): Promise<string[]> {
  const alvo = await connection.resenha.findUnique({
    where: { id: resenhaId },
    select: { embedding: true },
  });
  if (!alvo || alvo.embedding.length === 0) return [];

  const candidatos = await connection.resenha.findMany({
    where: { id: { not: resenhaId }, devocional: { isNot: null } },
    select: {
      id: true,
      embedding: true,
      devocional: {
        select: {
          titulo: true,
          referencia: true,
          reflexao: true,
          pontosAplicacao: true,
          oracao: true,
        },
      },
    },
  });

  const ranking = maisParecidos(alvo.embedding, candidatos, quantos);
  const porId = new Map(candidatos.map((c) => [c.id, c.devocional!]));

  return ranking.map((r) => {
    const d = porId.get(r.id)!;
    return JSON.stringify(
      {
        titulo: d.titulo,
        referencia: d.referencia,
        reflexao: d.reflexao,
        pontosAplicacao: d.pontosAplicacao,
        oracao: d.oracao,
      },
      null,
      2,
    );
  });
}

export function montarPrompt(
  resenha: ResenhaParaDevocional,
  correcao?: string,
  /** Exemplos escolhidos por semelhança. Vazio cai no exemplo fixo. */
  exemplos: string[] = [],
): string {
  const contexto = [
    `Título da pregação: ${resenha.titulo}`,
    resenha.textoBase ? `Texto base: ${resenha.textoBase}` : null,
    resenha.pregador ? `Pregador: ${resenha.pregador}` : null,
    resenha.doutrina ? `Doutrina predominante: ${resenha.doutrina}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${ESTILO}

Abaixo está a resenha de uma pregação da Igreja Batista do Parque Safira.
Escreva um devocional para a página de um livro, fiel ao que foi pregado —
não teologia genérica sobre a passagem, mas o que esta mensagem disse.

${contexto}

--- RESENHA ---
${resenha.conteudoLimpo}
--- FIM DA RESENHA ---
${
    resenha.passagem
      ? `
--- TEXTO BÍBLICO (Almeida Corrigida Fiel) ---
${resenha.passagem}
--- FIM DO TEXTO BÍBLICO ---

Ao citar a Escritura entre aspas, copie LITERALMENTE do texto acima. Se precisar
de outra passagem, cite sem aspas, como afirmação sua. NUNCA ponha entre aspas
palavra que a Bíblia não diz.
`
      : `
Ao citar a Escritura entre aspas, copie literalmente. Na dúvida, escreva sem
aspas, como afirmação sua. NUNCA ponha entre aspas palavra que a Bíblia não diz.
`
  }
Responda SOMENTE com JSON válido, sem cercas de código e sem comentário:

{
  "titulo": "título curto e forte, até 34 caracteres, para caber em UMA linha",
  "referencia": "a referência do versículo que resume a mensagem, ex: Salmos 23:1",
  "reflexao": "EXATAMENTE 3 parágrafos curtos, de 40 a 50 palavras CADA, separados por \\n\\n",
  "pontosAplicacao": ["exatamente 3 aplicações, uma linha curta cada, no imperativo"],
  "oracao": "oração curta, primeira pessoa do PLURAL, 180 a 260 caracteres"
}

Os limites de tamanho são rígidos: tudo isso precisa caber em UMA página A5
impressa, junto com o versículo, o QR code e um espaço para anotações. Texto
mais longo do que o pedido não cabe e será cortado.

A "referencia" deve ser um único versículo ou um trecho curto de um capítulo
só, e precisa existir na Bíblia. Não escreva o texto do versículo: apenas a
referência.

${
    exemplos.length > 0
      ? `${exemplos.length} devocionais nossos já aprovados, escolhidos por tratarem de assunto
próximo ao desta pregação. Siga o tom, o tamanho e a forma deles — o conteúdo,
não: cada um nasceu de outra pregação.

${exemplos.join('\n\n')}`
      : `Este é um devocional nosso já aprovado. Siga o tom, o tamanho e a forma dele —
o conteúdo, não: aquele nasceu de outra pregação.

${EXEMPLO}`
  }${correcao ? `\n\n${correcao}` : ''}`;
}

/**
 * Transforma a recusa da validação em instrução para a segunda tentativa.
 *
 * Repetir o mesmo prompt depois de uma falha por tamanho costuma produzir a
 * mesma falha: o modelo não sabe que errou. Dizer o que estourou, e em quanto,
 * é o que faz a retentativa valer os ~28k tokens que ela custa.
 */
export function comoCorrecao(erro: unknown): string {
  const problemas =
    erro instanceof z.ZodError
      ? (erro.issues as Array<{ path: PropertyKey[]; code: string; maximum?: number; minimum?: number }>)
      : [];

  const linhas = problemas.map((p) => {
    const campo = p.path.join('.');
    // Dizer "encurte" não funcionava: o modelo devolvia o mesmo tamanho. O que
    // funciona é mandar **cortar uma unidade inteira** — ele conta parágrafos,
    // não caracteres.
    if (p.code === 'too_big' && campo === 'reflexao') {
      return (
        `- A "reflexao" passou de ${p.maximum} caracteres. Escreva 3 parágrafos de` +
        ` no MÁXIMO 45 palavras cada. Corte frases inteiras, não palavras soltas.`
      );
    }
    if (p.code === 'too_big') return `- "${campo}" passou do limite de ${p.maximum} caracteres. Encurte de verdade.`;
    if (p.code === 'too_small') return `- "${campo}" ficou abaixo do mínimo de ${p.minimum}.`;
    return `- "${campo}" saiu fora do formato pedido.`;
  });

  if (linhas.length === 0) {
    return 'A resposta anterior não era JSON válido. Responda SOMENTE com o objeto JSON, sem cercas e sem comentário.';
  }

  return `ATENÇÃO — a tentativa anterior foi recusada:\n${linhas.join('\n')}\nCorrija exatamente isso e mantenha o resto.`;
}

/** O modelo às vezes embrulha o JSON em cercas, mesmo quando pedimos que não. */
export function extrairJson(saida: string): unknown {
  const semCercas = saida
    .replace(/^[\s\S]*?```(?:json)?\s*/m, (trecho) => (trecho.includes('```') ? '' : trecho))
    .replace(/```[\s\S]*$/m, '')
    .trim();

  const candidato = semCercas.startsWith('{') ? semCercas : saida.slice(saida.indexOf('{'));
  return JSON.parse(candidato);
}

/**
 * Resolve a referência em texto bíblico de verdade, vindo da ACF no banco.
 *
 * Aceita "Salmos 23:1" e "Salmos 23:1-3". Faixa vira um texto só, com os
 * versículos emendados — é como aparece impresso na página.
 */
export async function buscarVersiculo(referencia: string): Promise<string | null> {
  const m = referencia.match(/^\s*(.+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*-\s*(\d+))?\s*$/);
  if (!m) return null;

  const [, nomeLivro, capitulo, primeiro, ultimo] = m;
  const alvo = nomeLivro
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s/g, '');

  const livros = await connection.livroBiblico.findMany({ select: { id: true, nome: true } });
  const livro = livros.find(
    (l) =>
      l.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s/g, '') === alvo,
  );
  if (!livro) return null;

  const versiculos = await connection.versiculo.findMany({
    where: {
      livroId: livro.id,
      capitulo: Number(capitulo),
      numero: { gte: Number(primeiro), lte: Number(ultimo ?? primeiro) },
    },
    orderBy: { numero: 'asc' },
    select: { texto: true },
  });

  return versiculos.length > 0 ? versiculos.map((v) => v.texto).join(' ') : null;
}

/**
 * O que a fila devolve, virado no que o prompt precisa — já com a passagem
 * bíblica buscada.
 *
 * Existe para o script de geração e o de comparação não montarem isto cada um
 * do seu jeito: prompt diferente entre os dois faria a comparação medir a
 * diferença dos scripts, não a dos modelos.
 */
export async function comoPedido(item: {
  id: string;
  titulo: string;
  conteudoLimpo: string;
  textoBase: string | null;
  livro?: string | null;
  capitulo?: number | null;
  versiculos?: string | null;
  pregador: { nomeCanonico: string } | null;
  classificacoes: Array<{ doutrina: { nome: string } }>;
}): Promise<ResenhaParaDevocional> {
  return {
    id: item.id,
    titulo: item.titulo,
    conteudoLimpo: item.conteudoLimpo,
    textoBase: item.textoBase,
    pregador: item.pregador?.nomeCanonico ?? null,
    doutrina: item.classificacoes[0]?.doutrina.nome ?? null,
    passagem: await passagemEmAcf(item.livro ?? null, item.capitulo ?? null, item.versiculos ?? null),
  };
}

/**
 * Quanto a afinidade pode cair abaixo da melhor do acervo.
 *
 * Medido: a curva é **plana**. Em "Novos Recomeços" o primeiro dá 0,8955, o
 * vigésimo 0,8755 e o quadragésimo 0,8719 — do #20 ao #40 são 3,6‰. Não há
 * penhasco onde cortar; passadas as ~20 primeiras, o vetor não distingue mais
 * nada, e o que vem depois é enchimento com cara de resultado.
 *
 * 20‰ é onde ficam as ~20 primeiras de cada tema, que é quanto o acervo tem de
 * pregação realmente sobre cada assunto. Pedir mais que isso não traz material
 * melhor, traz Jó 42 num mês sobre recomeço.
 *
 * Relativo, e não absoluto, porque o topo varia por tema: "Novos Recomeços"
 * começa em 0,8955 e "Escatologia" em 0,8493. Um corte fixo esvaziaria um e
 * deixaria o outro intacto.
 */
const QUEDA_MAXIMA = 0.02;

/**
 * Teto de versículos para não afogar o prompt.
 *
 * Pregação sobre um capítulo inteiro existe; mandar 60 versículos gastaria mais
 * contexto do que a resenha e afogaria o que interessa.
 */
const MAXIMO_DE_VERSICULOS = 25;

/**
 * A passagem da pregação, em ACF, para o modelo citar em vez de lembrar.
 *
 * **Prevenir em vez de detectar.** Pedir que o modelo cite Escritura de memória
 * é pedir que invente: um modelo aberto escreveu que Jesus disse "Na casa do
 * Pai ainda há lugar", frase que não existe. E detectar depois não resolve — a
 * conferência literal não distingue invenção de citação em outra tradução, os
 * números se cruzam ("Na casa do Pai" pontuou 0,71; "Tudo posso naquele que me
 * fortalece", que é real, pontuou 0,67).
 *
 * Entregando o texto, o modelo não precisa lembrar de nada. É o mesmo motivo
 * pelo qual o versículo em destaque da página nunca sai do modelo, e sim desta
 * tabela.
 *
 * A ingestão já separou livro, capítulo e versículos de 1.380 das 1.404
 * resenhas, e os 57 nomes de livro batem com a ACF — por isso a busca é pelos
 * campos, não por regex no `textoBase`.
 */
export async function passagemEmAcf(
  livro: string | null,
  capitulo: number | null,
  versiculos: string | null,
): Promise<string | null> {
  if (!livro || !capitulo) return null;

  const registro = await connection.livroBiblico.findFirst({
    where: { nome: livro },
    select: { id: true, nome: true },
  });
  if (!registro) return null;

  const faixa = versiculos?.match(/^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/);
  const primeiro = faixa ? Number(faixa[1]) : 1;
  const ultimo = faixa ? Number(faixa[2] ?? faixa[1]) : primeiro + MAXIMO_DE_VERSICULOS - 1;

  const achados = await connection.versiculo.findMany({
    where: {
      livroId: registro.id,
      capitulo,
      numero: { gte: primeiro, lte: Math.min(ultimo, primeiro + MAXIMO_DE_VERSICULOS - 1) },
    },
    orderBy: { numero: 'asc' },
    select: { numero: true, texto: true },
  });

  if (achados.length === 0) return null;

  return achados.map((v) => `${registro.nome} ${capitulo}:${v.numero} ${v.texto}`).join('\n');
}

/**
 * As resenhas que ainda não viraram devocional. É a fila, e não um status.
 *
 * **Resenha sem data fica de fora.** No Postgres, `ORDER BY data DESC` põe os
 * NULL primeiro, e a fila estava servindo justamente as 297 sem data — que são
 * as piores candidatas: sem data não há culto, sem culto não há QR code, e a
 * página do livro sai sem os dois. Elas voltam à fila depois que a curadoria
 * manual preencher a data.
 *
 * A ordem decrescente também é intencional: o canal do YouTube só começou a
 * transmitir em 2020, então as pregações recentes são as que têm culto casado
 * e QR code. Começar pelas novas rende página completa desde o primeiro lote.
 */
export function filaDeGeracao(limite: number, pregadorId?: string | string[]) {
  return connection.resenha.findMany({
    where: { ...PENDENTES, ...soDe(pregadorId) },
    // `nulls: 'last'` é o ponto: sem ele o Postgres põe os NULL primeiro num
    // `DESC`, e as sem data — que não têm QR nem crédito — passariam na frente
    // das recentes, que têm os dois. Elas entram, mas por último.
    orderBy: [{ dataPregacao: { sort: 'desc', nulls: 'last' } }],
    take: limite,
    select: CAMPOS_DA_FILA,
  });
}

/**
 * Quem ainda não virou devocional e tem material para virar.
 *
 * **Resenha sem data entra.** Ficava de fora por engano meu: a página do livro
 * é datada pelo **dia do calendário** em que ela cai — "01 de Fevereiro" — e
 * não pela data da pregação, que aparece só como crédito no rodapé. Sem data,
 * a página perde o crédito e o QR code, e é só isso.
 *
 * O que motivou a exclusão foi outra coisa, e continua verdade: no Postgres,
 * `ORDER BY data DESC` põe os NULL **primeiro**, e a fila servia justamente as
 * 251 sem data antes de qualquer outra. Isso se resolve na ordenação, não
 * jogando o material fora.
 */
const PENDENTES = {
  devocional: null,
  conteudoLimpo: { not: '' },
} as const;

/**
 * O recorte por pregador, que aceita um nome ou vários.
 *
 * Um só é o caso do livro — ele é do Nélio. Vários é o acervo: gerar de uma
 * vez para os pastores e seminaristas da casa, sem rodar o script seis vezes e
 * sem abrir para os quarenta e quatro convidados que pregaram uma vez cada.
 *
 * Sem argumento não filtra nada, que é o que `--todos` usa.
 */
function soDe(pregadorId?: string | string[]) {
  if (!pregadorId) return {};
  return Array.isArray(pregadorId) ? { pregadorId: { in: pregadorId } } : { pregadorId };
}

const CAMPOS_DA_FILA = {
  id: true,
  titulo: true,
  conteudoLimpo: true,
  textoBase: true,
  // Separados pela ingestão, e é por eles que a passagem em ACF é buscada —
  // não por regex no `textoBase`, que tem grafia livre.
  livro: true,
  capitulo: true,
  versiculos: true,
  pregador: { select: { nomeCanonico: true } },
  classificacoes: {
    where: { papel: 'PRINCIPAL' as const },
    select: { doutrina: { select: { nome: true } } },
  },
} as const;

/**
 * A fila de um mês do livro: as resenhas cujo texto mais se parece com o tema.
 *
 * Existe porque gerar a fila inteira não é viável. Cada devocional custa ~28k
 * tokens de entrada, e a cota da assinatura rende cerca de 18 por janela — mil
 * resenhas levariam meses. Mas o livro não precisa de mil: precisa das doze
 * dúzias que o pastor vai montar. Gerar o que vai ser usado, e só isso.
 *
 * A ordenação é a mesma da curadoria (`porSemelhanca`), com o alvo invertido:
 * lá a busca é sobre quem **já tem** devocional, para escolher a página; aqui é
 * sobre quem **ainda não tem**, para escrevê-la.
 *
 * A comparação é sobre o vetor da resenha, não do devocional — que nem existe
 * ainda. É a pregação inteira que carrega o assunto.
 */
export async function filaDoTema(temaMesId: string, limite: number, pregadorId?: string | string[]) {
  const tema = await connection.temaMes.findUnique({
    where: { id: temaMesId },
    select: { tema: true, descricao: true },
  });
  if (!tema) throw new Error(`Tema ${temaMesId} não encontrado`);

  const consulta = await comoConsulta([tema.tema, tema.descricao].filter(Boolean).join('. '));

  // Só id e vetor: trazer o conteúdo de mil resenhas para ordenar seria
  // carregar megabytes de texto e descartar quase tudo.
  const candidatas = await connection.resenha.findMany({
    where: { ...PENDENTES, ...soDe(pregadorId) },
    select: { id: true, embedding: true },
  });

  // O que já virou devocional entra como assunto coberto: sem isso, um mês
  // repetiria a mensagem que o mês anterior já usou, e a fila — que só enxerga
  // quem não tem devocional — nunca perceberia.
  const jaEscritas = await connection.resenha.findMany({
    where: { devocional: { isNot: null } },
    select: { embedding: true },
  });

  // O ranking inteiro, não os `limite` primeiros: quem for descartado por
  // redundância precisa ter quem o substitua logo abaixo.
  const ranking = maisParecidos(consulta, candidatas, candidatas.length);

  // O piso é medido contra o MELHOR DO ACERVO, incluindo o que já foi escrito.
  //
  // Contra o melhor dos que sobraram não funcionaria: depois de escrever as
  // vinte primeiras, a régua se recalibraria pelas sobras e deixaria tudo
  // passar de novo — que é exatamente o defeito. Rodando Janeiro duas vezes,
  // a segunda escreveu Jó 42, Ezequiel 22 e Naum 1 para "Novos Recomeços",
  // e o relatório de cobertura andou 3 casas com 20 textos escritos.
  const todas = await connection.resenha.findMany({
    where: {
      conteudoLimpo: { not: '' },
      dataPregacao: { not: null },
      ...soDe(pregadorId),
    },
    select: { id: true, embedding: true },
  });
  const melhorDoAcervo = maisParecidos(consulta, todas, 1)[0]?.semelhanca ?? 0;

  const dentroDoPiso = ranking.filter((r) => melhorDoAcervo - r.semelhanca <= QUEDA_MAXIMA);

  const escolhidos = semRedundancia(
    dentroDoPiso,
    new Map(candidatas.map((c) => [c.id, c.embedding])),
    limite,
    jaEscritas.map((r) => r.embedding).filter((v) => v.length > 0),
  );

  const resenhas = await connection.resenha.findMany({
    where: { id: { in: escolhidos.map((r) => r.id) } },
    select: CAMPOS_DA_FILA,
  });

  // O `IN` volta em ordem de banco; a de afinidade é a que importa.
  const porId = new Map(resenhas.map((r) => [r.id, r]));
  return {
    tema: tema.tema,
    fila: escolhidos.map((r) => porId.get(r.id)!).filter(Boolean),
  };
}

export async function guardarDevocional(
  resenhaId: string,
  resposta: RespostaDoModelo,
  modelo: string,
  /**
   * Sobrescreve o devocional que já existe para esta resenha.
   *
   * Falso por padrão, e não é preciosismo: a fila normal só traz resenha **sem**
   * devocional, então criar é o caminho certo, e um upsert silencioso ali
   * apagaria trabalho na primeira vez que a fila trouxesse algo repetido por
   * engano. Só a regeração deliberada pede isto.
   */
  sobrescrever = false,
) {
  const dados = {
    titulo: resposta.titulo,
    referencia: resposta.referencia,
    // Da ACF no banco, nunca do modelo.
    versiculo: await buscarVersiculo(resposta.referencia),
    reflexao: resposta.reflexao,
    pontosAplicacao: resposta.pontosAplicacao,
    oracao: resposta.oracao,
    modelo,
  };

  if (!sobrescrever) return connection.devocional.create({ data: { resenhaId, ...dados } });

  return connection.devocional.upsert({
    where: { resenhaId },
    update: { ...dados, geradoEm: new Date() },
    create: { resenhaId, ...dados },
  });
}
