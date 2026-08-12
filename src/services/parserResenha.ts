import type { NaturezaEvento, Turno } from '../generated/prisma/enums';

/**
 * Extrai os campos estruturados de uma resenha do blog.
 *
 * Tudo aqui é função pura sobre texto — o que permite testar cada regra
 * contra os casos reais que a motivaram, sem banco e sem rede.
 *
 * Princípio: nunca inventar. Campo que o texto não afirma volta null e a
 * resenha entra na fila de revisão manual.
 */

export type ResenhaParseada = {
  /** Data do encontro em ISO (YYYY-MM-DD). null quando o texto não diz. */
  dataPregacao: string | null;
  /** true quando o ano escrito estava errado e foi corrigido pelo dia da semana. */
  anoCorrigido: boolean;
  turno: Turno | null;
  natureza: NaturezaEvento;
  /** Assinatura crua, antes de resolver o alias. */
  pregadorBruto: string | null;
  /** Quem redigiu a resenha. Recebe crédito de redação no livro. */
  redator: string | null;
  textoBase: string | null;
  livro: string | null;
  capitulo: number | null;
  versiculos: string | null;
};

/** Quantas linhas do começo e do fim formam o "cabeçalho" para procurar marcadores. */
const LINHAS_BORDA = 4;
/** Quantas linhas do fim podem conter a assinatura do pregador. */
const LINHAS_ASSINATURA = 10;

const DOMINGO = 0;
const QUARTA = 3;

function semAcento(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** As primeiras e últimas linhas, onde ficam data, turno e natureza. */
export function bordas(texto: string): string {
  const linhas = texto.split('\n').filter(Boolean);
  return semAcento([...linhas.slice(0, LINHAS_BORDA), ...linhas.slice(-LINHAS_BORDA)].join(' | '));
}

function diaDaSemana(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function paraIso(dia: number, mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Data do encontro, escrita no próprio texto.
 *
 * Corrige erro de ano quando — e só quando — o dia da semana resultante bate
 * com o dia que o cabeçalho afirma. É o caso das viradas de ano: quatro posts
 * de janeiro escrevem o ano anterior. Sem essa confirmação, a data escrita fica
 * como está: 43 posts de 2016 carregam datas de 2012 a 2015 e são legítimos,
 * a igreja digitou sermões antigos e publicou em lote.
 */
export function extrairData(
  texto: string,
  publicadoEm: string,
): { iso: string; anoCorrigido: boolean } | null {
  const m = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;

  const [, d, mes, ano] = m.map(Number) as unknown as [unknown, number, number, number];
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;

  const iso = paraIso(d, mes, ano);
  const diferenca = (Date.parse(publicadoEm) - Date.parse(iso)) / 86_400_000;

  if (Math.abs(diferenca) <= 300) return { iso, anoCorrigido: false };

  // Ano suspeito. Só corrige se o cabeçalho confirmar o dia da semana.
  const anoPublicacao = Number(publicadoEm.slice(0, 4));
  const candidato = paraIso(d, mes, anoPublicacao);
  const marcadores = bordas(texto);
  const dia = diaDaSemana(candidato);

  const confirma =
    (/quarta/.test(marcadores) && dia === QUARTA) || (/domingo/.test(marcadores) && dia === DOMINGO);

  return confirma ? { iso: candidato, anoCorrigido: true } : { iso, anoCorrigido: false };
}

/**
 * Turno do encontro.
 *
 * O texto tem prioridade. Quando ele cala, vale a regra do calendário: não
 * existe culto de manhã na quarta-feira, então quarta sem marcador é NOITE.
 * Essa regra sozinha resolve 295 posts.
 */
export function extrairTurno(texto: string, dataIso: string | null): Turno | null {
  const marcadores = bordas(texto);

  if (/manha/.test(marcadores)) return 'DIA';
  if (/noite/.test(marcadores)) return 'NOITE';
  if (dataIso && diaDaSemana(dataIso) === QUARTA) return 'NOITE';

  return null;
}

export function extrairNatureza(texto: string): NaturezaEvento {
  const marcadores = bordas(texto);

  if (/funebre|sepultamento/.test(marcadores)) return 'FUNEBRE';
  if (/\bebd\b|escola biblica/.test(marcadores)) return 'EBD';
  if (/vigilia/.test(marcadores)) return 'VIGILIA';
  if (/da virada|consagracao|batismo|casamento|posse pastoral/.test(marcadores)) return 'CELEBRACAO';
  if (/conferencia|congresso|seminario/.test(marcadores)) return 'CONFERENCIA';
  if (/reflexao|estudo biblico/.test(marcadores)) return 'ESTUDO';

  return 'CULTO';
}

/** Quem escreve e edita as resenhas — nunca é o pregador. */
const REDATORAS = /\(?\s*editad[oa]\s+por[^)\n]*\)?|transcrit[oa]\s+por[^)\n]*|resenha\s+por[^)\n]*/gi;

/**
 * Em culto fúnebre a pessoa citada é o homenageado, não quem pregou:
 * "Culto Fúnebre do irmão Souza" cadastrava o falecido como pregador.
 */
const HOMENAGEADOS = /f[úu]nebre\s+d[oa]\s+(?:irm[ãa]o?\s+|pastora?\s+)?[A-ZÀ-Ý][\wÀ-ÿ]*(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]*)?/gi;

/**
 * Títulos por extenso e abreviados.
 *
 * As abreviações EXIGEM o ponto: "Sem." e "Pra." também são palavras comuns em
 * português ("sem Cristo", "pra você") e sem o ponto inventariam pregador.
 */
const TITULOS = [
  'Pastor(?:a)?',
  'Seminarista',
  'Mission[áa]ri[oa]',
  'Reverendo',
  'Di[áa]cono',
  'Irm[ãa]o?',
  'Ministrante',
  'Pr\\.',
  'Pra\\.',
  'Sem\\.',
  'Miss\\.',
  'Rev\\.',
  'Di[áa]c\\.',
].join('|');

/**
 * Palavras que a resenha usa para apresentar quem pregou, sem título:
 * "Mensagem: Guilherme Saito". Sem isto essa assinatura passa batida.
 */
const INTRODUTORES = 'Mensagem|Ministrad[oa]|Prega(?:ção|cao)|Palavra';

/** Partículas que ligam partes de um nome: "Guilherme de Souza Saito". */
const PARTICULAS = ['de', 'da', 'do', 'das', 'dos', 'e'];

const PALAVRA_NOME = '[A-ZÀ-Ý][\\wÀ-ÿ]*';
const NOME = `${PALAVRA_NOME}(?:\\s+(?:${PARTICULAS.join('|')})\\s+${PALAVRA_NOME}|\\s+${PALAVRA_NOME}){0,3}`;

/**
 * Palavras que aparecem coladas na assinatura mas não fazem parte do nome:
 * a sigla da igreja e o resto do rodapé. Sem isto o acervo ganha pregadores
 * chamados "Jailson IBPS", "Gabriel Igreja" e "Daniel Culto".
 */
const NAO_E_NOME = new Set([
  // sigla e nome da igreja, incluindo o erro de digitação "IPBS"
  'ibps', 'ipbs', 'pib', 'igreja', 'batista', 'parque', 'safira', 'primeira',
  // rodapé da resenha
  'culto', 'cultos', 'pregacao', 'mensagem', 'resenha', 'ministrado', 'ministrada',
  'transmissao', 'endereco', 'neste', 'atraves', 'junta', 'missoes', 'nacionais',
  // turno grudado no fim da assinatura: "Pastor Nélio Monteiro Noite de 28/12"
  'noite', 'manha', 'tarde', 'dia', 'domingo', 'quarta', 'quartafeira',
  // títulos, para não vazarem para dentro do nome
  'pastor', 'pastora', 'seminarista', 'missionario', 'missionaria', 'irmao', 'irma',
  // palavras do texto devocional que nunca são nome de pregador
  'deus', 'jesus', 'cristo', 'senhor', 'evangelho', 'palavra', 'biblia', 'espirito',
]);

/**
 * Descarta o que veio grudado depois do nome.
 *
 * Mantém só as palavras iniciais que começam com maiúscula e não estão na lista
 * de rodapé. A checagem de maiúscula é necessária porque a flag `i` do regex
 * deixa passar palavra minúscula ("Pastor Nélio na igreja" virava "Nélio na").
 */
function limparNome(bruto: string): string | null {
  const bruta = bruto.split(/\s+/).map((p) => p.replace(/[.,;:]+$/, ''));
  const palavras: string[] = [];

  for (let i = 0; i < bruta.length; i++) {
    const palavra = bruta[i];

    // Partícula só continua o nome se vier outra palavra capitalizada depois:
    // "Guilherme de Souza" continua, "Nélio na igreja" para.
    if (PARTICULAS.includes(palavra.toLowerCase())) {
      const proxima = bruta[i + 1];
      if (proxima && /^[A-ZÀ-Ý]/.test(proxima) && !NAO_E_NOME.has(semAcento(proxima))) {
        palavras.push(palavra.toLowerCase());
        continue;
      }
      break;
    }

    if (!/^[A-ZÀ-Ý]/.test(palavra)) break;
    if (NAO_E_NOME.has(semAcento(palavra))) break;
    palavras.push(palavra);
  }

  // Nome não termina em partícula.
  while (palavras.length > 0 && PARTICULAS.includes(palavras.at(-1)!.toLowerCase())) {
    palavras.pop();
  }

  const nome = palavras.join(' ').trim();
  return nome.length > 1 ? nome : null;
}

/**
 * Assinatura do pregador, no fim da resenha.
 *
 * As últimas linhas são juntadas numa só antes de casar: o nome quebra entre
 * linhas com frequência ("Pastor Nélio\nMonteiro"). A frase da redatora sai
 * primeiro, senão "Editado por Elizabete Lacerda Paulo" viraria pregadora.
 *
 * Devolve a última ocorrência: em "Ministrado pelo Pastor X ... Pastor Y", a
 * assinatura é a do fim.
 */
export function extrairPregador(texto: string): string | null {
  const linhas = texto.split('\n').filter(Boolean);
  const fim = linhas
    .slice(-LINHAS_ASSINATURA)
    .join(' ')
    .replace(REDATORAS, ' ')
    .replace(HOMENAGEADOS, ' ');

  // A flag `i` é necessária porque o blog escreve "PASTOR NÉLIO MONTEIRO" em
  // caixa alta, mas ela anula a exigência de inicial maiúscula em NOME. Por
  // isso a capitalização é conferida depois, no texto original.
  // Dois jeitos de assinar: com título ("Pastor Nélio Monteiro") ou apresentado
  // por um introdutor ("Mensagem: Guilherme Saito"). O título, quando existe,
  // é opcional depois do introdutor.
  const padroes = [
    new RegExp(`(?:${TITULOS})\\s+(${NOME})`, 'gi'),
    new RegExp(`(?:${INTRODUTORES})\\s*(?::|\\s+(?:por|pelo|pela|do|da|de))\\s*(?:(?:${TITULOS})\\s+)?(${NOME})`, 'gi'),
  ];

  const encontrados = padroes
    .flatMap((padrao) => [...fim.matchAll(padrao)])
    .map((m) => ({ posicao: m.index, nome: limparNome(m[1]) }))
    .filter((achado): achado is { posicao: number; nome: string } => achado.nome !== null)
    .sort((a, b) => a.posicao - b.posicao);

  return encontrados.at(-1)?.nome ?? null;
}

/**
 * Quem redigiu a resenha.
 *
 * Uma pessoa só em todo o acervo, assinando de três formas. Ela recebe crédito
 * de redação no livro, por isso o nome é guardado em vez de descartado junto
 * com a frase de edição.
 */
export function extrairRedator(texto: string): string | null {
  const linhas = texto.split('\n').filter(Boolean);
  const fim = semAcento(linhas.slice(-LINHAS_ASSINATURA).join(' '));

  const creditada = /(?:editad[oa]|transcrit[oa]|redacao|digitad[oa])\s+(?:por|pela|pelo)/.test(fim);
  if (!creditada && !/\bbeth\b|elizabete/.test(fim)) return null;

  return /\bbeth\b|elizabete/.test(fim) ? 'Elizabete Lacerda Paulo' : null;
}

const LIVROS_ORDINAIS = '(?:[1-3]|I{1,3})\\s*';
const NOME_LIVRO = `(?:${LIVROS_ORDINAIS})?[A-ZÀ-Ý][a-zà-ÿ]+(?:\\s+[a-zà-ÿ]+)?`;

/**
 * Referência bíblica, tirada do título.
 *
 * O título quase sempre termina nela: "Desafios para o novo ano - Lucas 2:41-52".
 * Em 2016 o título costuma ser só a referência: "João 3:3".
 *
 * `livrosConhecidos` vem da tabela LivroBiblico, para não aceitar qualquer
 * palavra seguida de números como se fosse livro da Bíblia.
 */
export function extrairReferencia(
  titulo: string,
  livrosConhecidos: string[],
): { textoBase: string | null; livro: string | null; capitulo: number | null; versiculos: string | null } {
  const vazio = { textoBase: null, livro: null, capitulo: null, versiculos: null };

  const m = titulo.match(new RegExp(`(${NOME_LIVRO})\\s*(\\d+)\\s*[:.]\\s*(\\d+(?:\\s*-\\s*\\d+)?)`));
  if (!m) return vazio;

  const bruto = m[1].replace(/\s+/g, ' ').trim();
  const alvo = semAcento(bruto).replace(/\s/g, '');
  const livro = livrosConhecidos.find((conhecido) => semAcento(conhecido).replace(/\s/g, '') === alvo);
  if (!livro) return vazio;

  const versiculos = m[3].replace(/\s/g, '');
  return {
    textoBase: `${livro} ${m[2]}:${versiculos}`,
    livro,
    capitulo: Number(m[2]),
    versiculos,
  };
}

export function parsearResenha(
  entrada: { titulo: string; texto: string; publicadoEm: string },
  livrosConhecidos: string[],
): ResenhaParseada {
  const data = extrairData(entrada.texto, entrada.publicadoEm);
  const referencia = extrairReferencia(entrada.titulo, livrosConhecidos);

  return {
    dataPregacao: data?.iso ?? null,
    anoCorrigido: data?.anoCorrigido ?? false,
    turno: extrairTurno(entrada.texto, data?.iso ?? null),
    natureza: extrairNatureza(entrada.texto),
    pregadorBruto: extrairPregador(entrada.texto),
    redator: extrairRedator(entrada.texto),
    ...referencia,
  };
}
