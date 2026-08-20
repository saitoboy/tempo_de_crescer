import 'dotenv/config';
import connection from '../connection';
import { slugDaUrl } from '../services/ingestao';
import { logInfo, logSuccess, logWarning } from '../utils/logger';

/**
 * Realinha o slug de cada resenha com o que `slugDaUrl` produz hoje.
 *
 * **O slug é a chave que leva devocional e livro de um banco para outro.** Os
 * arquivos em `prisma/dados` casam por ele, e não por id — ids são uuid de
 * banco e não existem no destino. Se o slug de uma resenha aqui não for o
 * mesmo que a ingestão gera lá, o devocional dela não encontra dono.
 *
 * E era o caso de 99 resenhas. O banco local carrega slugs de uma versão
 * anterior da função — `a-mesa-com-jesus-lucas-2214-20` sem o ano, e
 * `2017-11-efesios-522-32_15` com sufixo de desempate. A função de hoje deriva
 * do caminho inteiro da URL e devolve `2025-12-a-mesa-com-jesus-lucas-2214-20`,
 * sem sufixo nenhum. Medido num ensaio de deploy com banco vazio: 98
 * devocionais e 29 páginas do livro ficaram sem par — 29 dias em branco no
 * livro impresso.
 *
 * Recalcular é seguro porque o slug é função pura da `urlBlog`, que é única e
 * é a chave de deduplicação da ingestão. Rodar de novo não muda nada.
 *
 * **Em duas fases, por causa da restrição de unicidade.** Trocar um a um
 * esbarra em colisão passageira: a resenha A quer o slug que a resenha B ainda
 * ocupa, mesmo que no fim ninguém fique com o slug do outro. A primeira fase
 * move todo mundo para um valor temporário, a segunda grava o definitivo.
 */

async function main() {
  const resenhas = await connection.resenha.findMany({
    select: { id: true, slug: true, urlBlog: true },
  });

  const trocas = resenhas
    .map((r) => ({ id: r.id, de: r.slug, para: slugDaUrl(r.urlBlog) }))
    .filter((t) => t.de !== t.para);

  if (trocas.length === 0) {
    logSuccess(`os ${resenhas.length} slugs já estão alinhados`, 'ingestao');
    return;
  }

  logInfo(`${trocas.length} de ${resenhas.length} slugs fora do padrão de hoje`, 'ingestao');
  for (const t of trocas.slice(0, 5)) logInfo(`  ${t.de} → ${t.para}`, 'ingestao');
  if (trocas.length > 5) logInfo(`  … e mais ${trocas.length - 5}`, 'ingestao');

  // Recalcular não pode inventar duplicata: se acontecesse, duas resenhas
  // diferentes teriam a mesma URL, o que a ingestão já impede. Conferir antes
  // é barato e evita descobrir isso no meio da segunda fase.
  const destinos = new Set(trocas.map((t) => t.para));
  const intactos = new Set(
    resenhas.filter((r) => r.slug === slugDaUrl(r.urlBlog)).map((r) => r.slug),
  );
  const conflitos = [...destinos].filter((d) => intactos.has(d));
  if (destinos.size !== trocas.length || conflitos.length > 0) {
    logWarning(
      `os novos slugs colidiriam entre si (${trocas.length - destinos.size}) ` +
        `ou com quem já está certo (${conflitos.length}) — nada foi alterado`,
      'ingestao',
    );
    return;
  }

  await connection.$transaction(async (tx) => {
    for (const t of trocas) {
      await tx.resenha.update({ where: { id: t.id }, data: { slug: `tmp-${t.id}` } });
    }
    for (const t of trocas) {
      await tx.resenha.update({ where: { id: t.id }, data: { slug: t.para } });
    }
  });

  logSuccess(`${trocas.length} slugs realinhados`, 'ingestao');
  logInfo('exporte de novo: os arquivos em prisma/dados guardam o slug antigo', 'ingestao');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => connection.$disconnect());
