import connection from '../connection';
import { baixarPost, listarUrls, type PostBruto } from './blog';
import { parsearResenha } from './parserResenha';
import { chave, resolverPregador, type PregadorConhecido } from './pregadores';

/**
 * Grava posts do blog no banco.
 *
 * Usado em dois momentos: na carga inicial do acervo, que lê do cache em disco,
 * e na ingestão incremental, que busca só o que ainda não está no banco. A
 * lógica de gravação é a mesma nos dois — só muda de onde vêm os posts.
 */

export type Contagem = {
  gravadas: number;
  semData: number;
  semTurno: number;
  semPregador: number;
  semReferencia: number;
  pregadoresNovos: number;
  anosCorrigidos: number;
};

export function novaContagem(): Contagem {
  return {
    gravadas: 0,
    semData: 0,
    semTurno: 0,
    semPregador: 0,
    semReferencia: 0,
    pregadoresNovos: 0,
    anosCorrigidos: 0,
  };
}

/**
 * O que o gravador precisa saber e que não vale reconsultar a cada post:
 * os livros da Bíblia e o cadastro de pregadores.
 */
export type Contexto = {
  livros: string[];
  conhecidos: PregadorConhecido[];
};

export async function carregarContexto(): Promise<Contexto> {
  const [livros, conhecidos] = await Promise.all([
    connection.livroBiblico.findMany({ select: { nome: true } }),
    connection.pregador.findMany({ select: { id: true, nomeCanonico: true, aliases: true } }),
  ]);
  return { livros: livros.map((l) => l.nome), conhecidos };
}

/**
 * Slug estável e único, derivado do caminho inteiro da URL.
 *
 * Só o nome do arquivo não serve: a igreja prega o mesmo texto em anos
 * diferentes e o Blogger repete o slug. "joao-81-11" aparece em 2017, 2020,
 * 2021 e 2024 — são 73 colisões no acervo.
 */
export function slugDaUrl(url: string): string {
  return new URL(url).pathname
    .replace(/^\//, '')
    .replace(/\.html$/, '')
    .replace(/\//g, '-');
}

function comoData(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Grava um post. Idempotente pela URL — rodar de novo atualiza, não duplica. */
export async function gravarPost(
  post: PostBruto,
  contexto: Contexto,
  contagem: Contagem,
): Promise<void> {
  const dados = parsearResenha(
    { titulo: post.titulo, texto: post.texto, publicadoEm: post.publicadoEm },
    contexto.livros,
  );

  // Pregador desconhecido entra como convidado. A fusão de grafias duplicadas
  // é feita pelo seed, que conhece os nomes canônicos confirmados pela igreja.
  let pregadorId: string | null = null;
  if (dados.pregadorBruto) {
    let pregador = resolverPregador(dados.pregadorBruto, contexto.conhecidos);

    if (!pregador) {
      pregador = await connection.pregador.create({
        data: {
          nomeCanonico: dados.pregadorBruto,
          tipo: 'CONVIDADO',
          aliases: [chave(dados.pregadorBruto)],
        },
        select: { id: true, nomeCanonico: true, aliases: true },
      });
      contexto.conhecidos.push(pregador);
      contagem.pregadoresNovos++;
    }
    pregadorId = pregador.id;
  } else {
    contagem.semPregador++;
  }

  // Culto só quando data E turno são conhecidos. O Postgres trata NULL como
  // distinto num índice único, então aceitar turno null criaria um culto novo
  // a cada resenha em vez de reaproveitar o existente.
  let cultoId: string | null = null;
  if (dados.dataPregacao && dados.turno) {
    const data = comoData(dados.dataPregacao);
    const culto = await connection.culto.upsert({
      where: { data_turno_natureza: { data, turno: dados.turno, natureza: dados.natureza } },
      update: {},
      create: { data, turno: dados.turno, natureza: dados.natureza },
      select: { id: true },
    });
    cultoId = culto.id;
  }

  if (!dados.dataPregacao) contagem.semData++;
  if (!dados.turno) contagem.semTurno++;
  if (!dados.livro) contagem.semReferencia++;
  if (dados.anoCorrigido) contagem.anosCorrigidos++;

  const campos = {
    titulo: post.titulo,
    dataPregacao: dados.dataPregacao ? comoData(dados.dataPregacao) : null,
    origemData: dados.dataPregacao ? ('TEXTO' as const) : null,
    publicadoEm: comoData(post.publicadoEm),
    ano: Number((dados.dataPregacao ?? post.publicadoEm).slice(0, 4)),
    conteudoBruto: post.html,
    conteudoLimpo: post.texto,
    cultoId,
    pregadorId,
    pregadorBruto: dados.pregadorBruto,
    pregadorOrigem: dados.pregadorBruto ? ('ASSINATURA' as const) : null,
    redator: dados.redator,
    textoBase: dados.textoBase,
    livro: dados.livro,
    capitulo: dados.capitulo,
    versiculos: dados.versiculos,
  };

  await connection.resenha.upsert({
    where: { urlBlog: post.url },
    update: campos,
    create: { ...campos, urlBlog: post.url, slug: slugDaUrl(post.url) },
  });

  contagem.gravadas++;
}

/** Quais URLs do sitemap ainda não estão no banco. */
export function urlsNovas(doSitemap: string[], jaNoBanco: string[]): string[] {
  const conhecidas = new Set(jaNoBanco);
  return doSitemap.filter((url) => !conhecidas.has(url));
}

export type ResultadoIngestao = Contagem & {
  noSitemap: number;
  novas: number;
  falhas: Array<{ url: string; erro: string }>;
};

/**
 * Busca no blog o que ainda não está no banco e grava.
 *
 * O blog publica depois do culto, com atraso de 0 a 5 dias, então rodar isto
 * todo dia dá conta. Não baixa o que já está no banco.
 */
export async function ingerirNovos(): Promise<ResultadoIngestao> {
  const [doSitemap, existentes] = await Promise.all([
    listarUrls(),
    connection.resenha.findMany({ select: { urlBlog: true } }),
  ]);

  const novas = urlsNovas(doSitemap, existentes.map((r) => r.urlBlog));

  const contagem = novaContagem();
  const falhas: Array<{ url: string; erro: string }> = [];

  if (novas.length > 0) {
    const contexto = await carregarContexto();

    for (const url of novas) {
      try {
        await gravarPost(await baixarPost(url), contexto, contagem);
      } catch (e) {
        falhas.push({ url, erro: (e as Error).message });
      }
    }
  }

  return { ...contagem, noSitemap: doSitemap.length, novas: novas.length, falhas };
}
