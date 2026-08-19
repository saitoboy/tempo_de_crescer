import connection from '../connection';

/**
 * O devocional não pode pôr palavra na boca de Deus.
 *
 * Um modelo aberto escreveu, sobre Lucas 14, que Jesus "fala com autoridade:
 * *Na casa do Pai ainda há lugar*". A frase não existe na Escritura — é uma
 * mistura de João 14:2 com Lucas 14:22, entre aspas, atribuída a Jesus. A
 * proximidade vetorial daquele texto com o do Opus deu 0,936: **o vetor não
 * enxerga invenção doutrinária**, porque mede sentido parecido, e mentira bem
 * escrita se parece muito com verdade bem escrita.
 *
 * Por isso a conferência aqui é **literal**, não semântica. A pergunta não é
 * "isto soa bíblico", é "isto está escrito". A ACF inteira já está no banco.
 *
 * Vale para todo modelo, inclusive o Opus. Fidelidade bíblica acima de
 * performance técnica é o primeiro princípio do projeto, e princípio que só
 * vale para os outros não é princípio.
 */

/**
 * Aspas curtas são ênfase ("meus irmãos"), não citação.
 *
 * Cinco palavras é onde, nos devocionais que já temos, a aspa deixa de ser
 * destaque e passa a ser Escritura citada.
 */
const MINIMO_DE_PALAVRAS = 5;

/**
 * Quanto da citação precisa bater para valer.
 *
 * Não é 100% de propósito: o pregador cita de memória, o modelo troca uma
 * conjunção, e a ACF tem grafia antiga. Exigir literalidade absoluta reprovaria
 * citação honesta. Abaixo disto, porém, já não é citação — é paráfrase entre
 * aspas, que no livro impresso é a mesma mentira.
 */
const MINIMO_DE_ACERTO = 0.8;

export type Suspeita = {
  trecho: string;
  motivo: 'nao-esta-na-escritura' | 'referencia-nao-existe';
};

/** Sem acento, sem pontuação, sem caixa: como comparar dois textos bíblicos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A Bíblia inteira como um texto só, normalizado, carregado uma vez.
 *
 * São ~4 MB. Um `indexOf` sobre isso custa milissegundos, e evita 31.106
 * comparações por citação. Os versículos são emendados por espaço de propósito:
 * citação que atravessa a fronteira de dois versículos continua sendo achada.
 */
let escritura: string | null = null;

export async function carregarEscritura(): Promise<string> {
  if (escritura) return escritura;

  const versiculos = await connection.versiculo.findMany({
    orderBy: [{ livroId: 'asc' }, { capitulo: 'asc' }, { numero: 'asc' }],
    select: { texto: true },
  });

  escritura = normalizar(versiculos.map((v) => v.texto).join(' '));
  return escritura;
}

/** Só para os testes: desfaz o cache entre casos. */
export function esquecerEscritura(): void {
  escritura = null;
}

/** O que aparece entre aspas — de qualquer um dos formatos que os modelos usam. */
export function extrairCitacoes(texto: string): string[] {
  // Em escapes, não nas aspas literais: um arquivo que já contém aspas curvas
  // dentro de uma classe de caracteres é fácil de corromper numa edição, e o
  // erro fica invisível — a regex continua válida e passa a não casar nada.
  const ABRE = '"“«‘';
  const FECHA = '"”»’';
  const padrao = new RegExp(`[${ABRE}]([^${ABRE}${FECHA}]{10,400})[${FECHA}]`, 'g');

  return [...texto.matchAll(padrao)]
    .map((m) => m[1].trim())
    .filter((a) => a.split(/\s+/).length >= MINIMO_DE_PALAVRAS);
}

/**
 * Quantas palavras seguidas bastam para localizar o trecho na Bíblia.
 *
 * Três, não quatro. Parece pouco — "e disse o" aparece às centenas — mas a
 * âncora só **localiza**; quem aprova é a sobreposição de 80% na janela. Com
 * quatro, citação curta com uma palavra inserida não achava âncora nenhuma:
 * "Ainda que ele esteja morto, viverá" (João 11:25, a ACF não tem o "ele")
 * ficava sem nenhum quarteto em comum e era reprovada à toa. Baixar para três
 * derrubou os falsos positivos de 14 para 8 nos devocionais já escritos, sem
 * deixar passar a frase inventada que motivou esta trava.
 */
const ANCORA = 3;

/**
 * A citação está na Escritura?
 *
 * **Não é comparação contígua.** A primeira versão disto procurava o maior
 * trecho seguido e reprovava o gabarito do Opus: ele citou 2 Coríntios 5:21
 * como "Aquele que não conheceu pecado, **ele o** fez pecado por nós", e a ACF
 * diz "Àquele que não conheceu pecado, **o** fez pecado por nós". Uma palavra
 * inserida no meio parte a sequência em duas e derruba o acerto para metade.
 * Citação real quase sempre tem uma inserção, uma omissão ou uma troca dessas.
 *
 * O que vale é **quanto do vocabulário da citação está no lugar certo da
 * Bíblia**: uma âncora curta localiza a passagem, e a conferência é a fração
 * das palavras da citação presentes naquele pedaço. Inserir "ele" numa citação
 * de vinte palavras derruba pouco; inventar a frase inteira não encontra
 * janela que a sustente.
 */
/**
 * Onde a citação melhor se encaixa na Escritura, e quanto dela bate ali.
 *
 * Devolver o número, e não só sim/não, é o que permite separar **inventou** de
 * **citou por outra tradução** — que são erros de natureza diferente e merecem
 * tratamento diferente. E devolver o trecho da ACF encontrado é o que permite
 * pôr os dois lado a lado para o pastor conferir sem abrir a Bíblia.
 */
export function medirCitacao(
  citacao: string,
  biblia: string,
): { acerto: number; naAcf: string | null } {
  const alvo = normalizar(citacao);
  if (alvo.length === 0) return { acerto: 1, naAcf: null };
  if (biblia.includes(alvo)) return { acerto: 1, naAcf: citacao };

  const palavras = alvo.split(' ');
  if (palavras.length < ANCORA) return { acerto: 0, naAcf: null };

  let melhor = 0;
  let ondeMelhor: string | null = null;

  for (let i = 0; i + ANCORA <= palavras.length; i++) {
    const ancora = palavras.slice(i, i + ANCORA).join(' ');

    let posicao = biblia.indexOf(ancora);
    while (posicao !== -1) {
      const inicio = Math.max(0, posicao - alvo.length);
      const trecho = biblia.slice(inicio, posicao + alvo.length * 2);
      const acerto = palavras.filter((p) => trecho.includes(p)).length / palavras.length;

      if (acerto > melhor) {
        melhor = acerto;
        // Só o suficiente para o revisor reconhecer a passagem.
        ondeMelhor = biblia.slice(Math.max(0, posicao - 60), posicao + alvo.length + 60);
      }
      if (melhor === 1) return { acerto: 1, naAcf: ondeMelhor };

      posicao = biblia.indexOf(ancora, posicao + 1);
    }
  }

  return { acerto: melhor, naAcf: ondeMelhor };
}

export function estaNaEscritura(citacao: string, biblia: string): boolean {
  // Reticências marcam texto pulado de propósito — "Fostes resgatados... pelo
  // precioso sangue". Os dois lados existem na Escritura, longe um do outro, e
  // conferir a frase emendada não acharia nunca. Cada pedaço vale por si.
  const pedacos = citacao
    .split(/\.{2,}|…/)
    .map((p) => p.trim())
    .filter((p) => normalizar(p).split(' ').length >= ANCORA);

  if (pedacos.length > 1) {
    return pedacos.every((p) => estaNaEscritura(p, biblia));
  }

  const alvo = normalizar(citacao);
  if (alvo.length === 0) return true;
  if (biblia.includes(alvo)) return true;

  const palavras = alvo.split(' ');
  if (palavras.length < ANCORA) return biblia.includes(alvo);

  // Cada âncora possível aponta um lugar candidato. Basta uma delas render
  // acerto suficiente: a citação pode começar no meio de um versículo.
  for (let i = 0; i + ANCORA <= palavras.length; i++) {
    const ancora = palavras.slice(i, i + ANCORA).join(' ');

    let posicao = biblia.indexOf(ancora);
    while (posicao !== -1) {
      // Janela generosa em volta: a citação pode atravessar versículos, e a
      // ACF costuma ser mais longa que a paráfrase.
      const inicio = Math.max(0, posicao - alvo.length);
      const trecho = biblia.slice(inicio, posicao + alvo.length * 2);
      const presentes = palavras.filter((p) => trecho.includes(p)).length;

      if (presentes / palavras.length >= MINIMO_DE_ACERTO) return true;

      posicao = biblia.indexOf(ancora, posicao + 1);
    }
  }

  return false;
}

/**
 * Confere um devocional inteiro.
 *
 * Devolve o que **não** confere. Lista vazia é aprovação.
 *
 * O que isto não pega, e é honesto dizer: paráfrase sem aspas ("Jesus ensinou
 * que quem crê nunca morrerá") não é citação e não é conferida; e citação real
 * atribuída ao livro errado passa, porque a busca é na Escritura toda. O
 * primeiro caso é opinião do pregador, legítima. O segundo depende de conferir
 * a citação contra a referência, e vale fazer quando aparecer.
 */
export async function conferirFidelidade(partes: {
  reflexao: string;
  oracao?: string | null;
  referencia?: string | null;
  versiculoResolvido?: boolean;
}): Promise<Suspeita[]> {
  const biblia = await carregarEscritura();
  const suspeitas: Suspeita[] = [];

  const texto = [partes.reflexao, partes.oracao].filter(Boolean).join('\n');
  for (const citacao of extrairCitacoes(texto)) {
    if (!estaNaEscritura(citacao, biblia)) {
      suspeitas.push({ trecho: citacao, motivo: 'nao-esta-na-escritura' });
    }
  }

  // Referência que não resolve na ACF deixa a página sem o versículo em
  // destaque — o bloco existe no livro e sairia vazio.
  if (partes.referencia && partes.versiculoResolvido === false) {
    suspeitas.push({ trecho: partes.referencia, motivo: 'referencia-nao-existe' });
  }

  return suspeitas;
}

/** A recusa em forma de instrução, para a retentativa saber o que corrigir. */
export function comoCorrecaoDeFidelidade(suspeitas: Suspeita[]): string {
  const linhas = suspeitas.map((s) =>
    s.motivo === 'nao-esta-na-escritura'
      ? `- Você escreveu entre aspas: "${s.trecho}". Isso NÃO está na Bíblia. Cite apenas texto bíblico real, ou escreva sem aspas como afirmação sua.`
      : `- A referência "${s.trecho}" não existe. Use uma referência real, no formato "Livro capítulo:versículo".`,
  );

  return [
    'ATENÇÃO — a tentativa anterior inventou Escritura:',
    ...linhas,
    'Nunca ponha entre aspas palavra que a Bíblia não diz.',
  ].join('\n');
}
