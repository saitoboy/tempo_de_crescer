import 'dotenv/config';
import connection from '../connection';
import { aplicarProxy } from '../utils/proxy';

/**
 * Importa a Bíblia Almeida Corrigida Fiel (ACF) para o banco.
 *
 * Fonte: https://github.com/thiagobodruk/biblia (json/acf.json)
 * O arquivo não é versionado aqui — é baixado na hora, para não redistribuir
 * o texto junto com o código.
 *
 * Idempotente: apaga e recarrega. São 66 livros e 31.106 versículos.
 */

const FONTE = 'https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/acf.json';

/// Os 39 primeiros livros do cânon são o Antigo Testamento.
const ULTIMO_LIVRO_ANTIGO = 39;

/// createMany em lotes: 31 mil linhas de uma vez estoura o limite de
/// parâmetros do Postgres.
const TAMANHO_LOTE = 2000;

type LivroAcf = {
  abbrev: string;
  name: string;
  chapters: string[][];
};

async function baixarAcf(): Promise<LivroAcf[]> {
  const proxy = aplicarProxy();
  if (proxy) console.log(`  via proxy ${proxy}`);

  const resposta = await fetch(FONTE);
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar a ACF: HTTP ${resposta.status}`);
  }

  // O arquivo vem com BOM, que quebra o JSON.parse.
  const bruto = (await resposta.text()).replace(/^﻿/, '');
  const livros = JSON.parse(bruto) as LivroAcf[];

  if (livros.length !== 66) {
    throw new Error(`Esperava 66 livros, vieram ${livros.length}`);
  }
  return livros;
}

async function main() {
  console.log('📖 Importando a Bíblia (ACF)');

  const livros = await baixarAcf();

  await connection.versiculo.deleteMany();
  await connection.livroBiblico.deleteMany();

  await connection.livroBiblico.createMany({
    data: livros.map((livro, indice) => ({
      id: indice + 1,
      abbrev: livro.abbrev,
      nome: livro.name,
      testamento: indice + 1 <= ULTIMO_LIVRO_ANTIGO ? ('ANTIGO' as const) : ('NOVO' as const),
    })),
  });
  console.log(`  ✓ ${livros.length} livros`);

  const versiculos = livros.flatMap((livro, indice) =>
    livro.chapters.flatMap((capitulo, numeroCapitulo) =>
      capitulo.map((texto, numeroVersiculo) => ({
        livroId: indice + 1,
        capitulo: numeroCapitulo + 1,
        numero: numeroVersiculo + 1,
        texto,
      })),
    ),
  );

  for (let i = 0; i < versiculos.length; i += TAMANHO_LOTE) {
    await connection.versiculo.createMany({ data: versiculos.slice(i, i + TAMANHO_LOTE) });
    process.stdout.write(`\r  ✓ ${Math.min(i + TAMANHO_LOTE, versiculos.length)}/${versiculos.length} versículos`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
