import '../utils/timezone';
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import connection from '../connection';
import type { PostBruto } from '../services/blog';
import { parsearResenha } from '../services/parserResenha';
import { chave, resolverPregador, type PregadorConhecido } from '../services/pregadores';

/**
 * Carrega o acervo do blog no banco: 1409 posts, de 2012 a 2026.
 *
 * Lê do cache criado por `src/scripts/baixarPosts.ts`. Idempotente — roda de
 * novo sem duplicar, porque a chave é a URL do post.
 *
 * Princípio: nada é inventado. Resenha sem data no texto fica com dataPregacao
 * null e sem vínculo com Culto; resenha sem assinatura fica sem pregador. As
 * duas situações entram na fila de revisão manual.
 */

const CACHE = join('.cache_blog', 'posts.json');

/**
 * Slug estável e único, derivado do caminho inteiro da URL.
 *
 * Só o nome do arquivo não serve: a igreja prega o mesmo texto em anos
 * diferentes e o Blogger repete o slug. "joao-81-11" aparece em 2017, 2020,
 * 2021 e 2024 — são 73 colisões no acervo. Com ano e mês na frente, os 1409
 * ficam únicos.
 */
export function slugDaUrl(url: string): string {
  return new URL(url).pathname
    .replace(/^\//, '')
    .replace(/\.html$/, '')
    .replace(/\//g, '-');
}

async function main() {
  if (!existsSync(CACHE)) {
    throw new Error(`Cache ausente. Rode: npx tsx src/scripts/baixarPosts.ts`);
  }

  const posts: PostBruto[] = Object.values(JSON.parse(readFileSync(CACHE, 'utf8')));
  const livros = (await connection.livroBiblico.findMany()).map((l) => l.nome);

  let conhecidos: PregadorConhecido[] = await connection.pregador.findMany({
    select: { id: true, nomeCanonico: true, aliases: true },
  });

  const contagem = {
    resenhas: 0,
    cultos: 0,
    semData: 0,
    semTurno: 0,
    semPregador: 0,
    semReferencia: 0,
    pregadoresNovos: 0,
    anosCorrigidos: 0,
  };

  for (const post of posts) {
    const dados = parsearResenha(
      { titulo: post.titulo, texto: post.texto, publicadoEm: post.publicadoEm },
      livros,
    );

    // Pregador: resolve contra o cadastro; se for gente nova, cadastra como
    // visitante. A curadoria de apelidos duplicados fica para o PATCH manual.
    let pregadorId: string | null = null;
    if (dados.pregadorBruto) {
      let pregador = resolverPregador(dados.pregadorBruto, conhecidos);

      if (!pregador) {
        const criado = await connection.pregador.create({
          data: {
            nomeCanonico: dados.pregadorBruto,
            tipo: 'CONVIDADO',
            aliases: [chave(dados.pregadorBruto)],
          },
          select: { id: true, nomeCanonico: true, aliases: true },
        });
        conhecidos = [...conhecidos, criado];
        pregador = criado;
        contagem.pregadoresNovos++;
      }
      pregadorId = pregador.id;
    } else {
      contagem.semPregador++;
    }

    // Culto: só quando data E turno são conhecidos. O Postgres trata NULLs como
    // distintos num índice único, então permitir turno null aqui criaria um
    // Culto novo a cada resenha sem turno, em vez de reaproveitar.
    let cultoId: string | null = null;
    if (dados.dataPregacao && dados.turno) {
      const data = new Date(`${dados.dataPregacao}T00:00:00Z`);
      const culto = await connection.culto.upsert({
        where: {
          data_turno_natureza: { data, turno: dados.turno, natureza: dados.natureza },
        },
        update: {},
        create: { data, turno: dados.turno, natureza: dados.natureza },
        select: { id: true, criadoEm: true, atualizadoEm: true },
      });
      cultoId = culto.id;
    }

    if (!dados.dataPregacao) contagem.semData++;
    if (!dados.turno) contagem.semTurno++;
    if (!dados.livro) contagem.semReferencia++;
    if (dados.anoCorrigido) contagem.anosCorrigidos++;

    const dataPregacao = dados.dataPregacao ? new Date(`${dados.dataPregacao}T00:00:00Z`) : null;
    const publicadoEm = new Date(`${post.publicadoEm}T00:00:00Z`);

    const campos = {
      titulo: post.titulo,
      dataPregacao,
      origemData: dados.dataPregacao ? ('TEXTO' as const) : null,
      publicadoEm,
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

    contagem.resenhas++;
    if (contagem.resenhas % 100 === 0) {
      process.stdout.write(`\r  ${contagem.resenhas}/${posts.length}`);
    }
  }

  // Convidados que ficaram sem nenhuma resenha são sobra de uma carga anterior:
  // ou o nome era lixo que o parser aprendeu a rejeitar, ou virou alias de um
  // pregador do cadastro. Pastores e seminaristas do seed ficam, mesmo sem
  // resenha ainda.
  const orfaos = await connection.pregador.deleteMany({
    where: { tipo: 'CONVIDADO', resenhas: { none: {} } },
  });

  contagem.cultos = await connection.culto.count();

  console.log(`\n\n✓ ${contagem.resenhas} resenhas`);
  console.log(`  ${contagem.cultos} cultos`);
  console.log(`  ${contagem.pregadoresNovos} pregadores novos cadastrados`);
  console.log(`  ${orfaos.count} convidados sem resenha removidos`);
  console.log(`  ${contagem.anosCorrigidos} anos corrigidos pelo dia da semana`);
  console.log(`\n  incompletos, para revisão manual:`);
  console.log(`    sem data      ${contagem.semData}`);
  console.log(`    sem turno     ${contagem.semTurno}`);
  console.log(`    sem pregador  ${contagem.semPregador}`);
  console.log(`    sem referência bíblica ${contagem.semReferencia}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
