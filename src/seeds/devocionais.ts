import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import connection from '../connection';
import { logInfo, logSuccess, logWarning, progresso } from '../utils/logger';

/**
 * Os devocionais viajam como dado, não como geração.
 *
 * O CLI do Claude autentica com a sessão da máquina de quem escreve. Dentro do
 * contêiner em produção não há login nenhum, então **produção não consegue
 * gerar** — e nem deveria: cada texto custa assinatura, e regerar o que já
 * existe seria desperdício em cima de desperdício.
 *
 * O fluxo é: gera na máquina, exporta para arquivo, versiona, e o seed carrega
 * na subida do contêiner. Cultos novos são três por semana; uma passada mensal
 * local dá conta.
 *
 * **A chave de casamento é o slug da resenha, não o id.** Ids são uuid gerados
 * por banco: o id de um devocional aqui não existe em produção. Casar por id
 * criaria devocional órfão ou apontando para a resenha errada — que no livro
 * significa o texto de uma pregação sob o título de outra.
 */

const ARQUIVO = join('prisma', 'dados', 'devocionais.json');

type DevocionalExportado = {
  /** Slug da resenha de origem — a chave estável entre bancos. */
  slug: string;
  titulo: string;
  referencia: string | null;
  versiculo: string | null;
  reflexao: string;
  pontosAplicacao: string[];
  oracao: string | null;
  status: 'GERADO' | 'REVISADO';
  modelo: string | null;
  geradoEm: string;
};

export async function exportarDevocionais(caminho = ARQUIVO): Promise<number> {
  const devocionais = await connection.devocional.findMany({
    orderBy: [{ resenha: { dataPregacao: 'asc' } }],
    select: {
      titulo: true,
      referencia: true,
      versiculo: true,
      reflexao: true,
      pontosAplicacao: true,
      oracao: true,
      status: true,
      modelo: true,
      geradoEm: true,
      resenha: { select: { slug: true } },
    },
  });

  const exportados: DevocionalExportado[] = devocionais.map((d) => ({
    slug: d.resenha.slug,
    titulo: d.titulo,
    referencia: d.referencia,
    versiculo: d.versiculo,
    reflexao: d.reflexao,
    pontosAplicacao: d.pontosAplicacao,
    oracao: d.oracao,
    status: d.status,
    modelo: d.modelo,
    geradoEm: d.geradoEm.toISOString(),
  }));

  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, JSON.stringify(exportados, null, 1), 'utf8');

  return exportados.length;
}

/**
 * Carrega os devocionais do arquivo.
 *
 * Idempotente e **não destrutivo**: devocional que já existe no banco não é
 * tocado. Se alguém revisou um texto pela API, uma nova carga não desfaz a
 * revisão — o que veio do arquivo é o ponto de partida, não a verdade final.
 */
export async function importarDevocionais(caminho = ARQUIVO): Promise<{
  criados: number;
  jaExistiam: number;
  semResenha: string[];
}> {
  if (!existsSync(caminho)) {
    logInfo(`sem ${caminho}, nada a importar`, 'devocional');
    return { criados: 0, jaExistiam: 0, semResenha: [] };
  }

  const arquivo = JSON.parse(readFileSync(caminho, 'utf8')) as DevocionalExportado[];
  if (arquivo.length === 0) return { criados: 0, jaExistiam: 0, semResenha: [] };

  // Uma consulta só: mil buscas por slug seriam mil viagens ao banco.
  const resenhas = await connection.resenha.findMany({
    where: { slug: { in: arquivo.map((d) => d.slug) } },
    select: { id: true, slug: true, devocional: { select: { id: true } } },
  });
  const porSlug = new Map(resenhas.map((r) => [r.slug, r]));

  const resultado = { criados: 0, jaExistiam: 0, semResenha: [] as string[] };
  const barra = progresso('devocionais', arquivo.length, 'devocional');

  for (const [i, d] of arquivo.entries()) {
    const resenha = porSlug.get(d.slug);

    if (!resenha) {
      resultado.semResenha.push(d.slug);
    } else if (resenha.devocional) {
      resultado.jaExistiam++;
    } else {
      await connection.devocional.create({
        data: {
          resenhaId: resenha.id,
          titulo: d.titulo,
          referencia: d.referencia,
          versiculo: d.versiculo,
          reflexao: d.reflexao,
          pontosAplicacao: d.pontosAplicacao,
          oracao: d.oracao,
          status: d.status,
          modelo: d.modelo,
          geradoEm: new Date(d.geradoEm),
        },
      });
      resultado.criados++;
    }

    barra.atualizar(i + 1);
  }

  barra.concluir(`${resultado.criados} devocionais importados`);

  if (resultado.jaExistiam > 0) {
    logInfo(`${resultado.jaExistiam} já existiam e foram preservados`, 'devocional');
  }
  if (resultado.semResenha.length > 0) {
    logWarning(
      `${resultado.semResenha.length} sem resenha correspondente — o acervo do destino está desatualizado`,
      'devocional',
      resultado.semResenha.slice(0, 10),
    );
  }

  return resultado;
}

export async function relatarDevocionais() {
  const [total, comQr] = await Promise.all([
    connection.devocional.count(),
    connection.devocional.count({ where: { resenha: { culto: { qrcodeSvg: { not: null } } } } }),
  ]);
  logSuccess(`${total} devocionais no banco, ${comQr} com QR code`, 'devocional');
}
