import { dataPorExtenso, type PaginaDoLivro } from './livro';

/**
 * O caderno de revisão do pastor, em papel.
 *
 * Quem revisa não usa computador, e ler devocional numa tela para depois
 * descrever a correção por telefone não funciona. Então a revisão vira o que
 * ele já sabe fazer: folha impressa e caneta.
 *
 * **A4 deitado é exatamente dois A5 em pé** — 297×210 mm contra 148×210. A
 * página do livro fica à esquerda no tamanho real em que será impressa, e a
 * metade da direita, um A5 inteiro, é papel pautado para ele escrever.
 *
 * Ver a página no tamanho final importa: uma correção de "está muito longo" só
 * faz sentido diante do espaço real da página, não de um texto esticado na
 * tela.
 */

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Espaço entre as pautas.
 *
 * 8 mm, e não os 6 de um caderno comum: letra de quem tem oitenta anos é maior,
 * e pauta apertada faz a pessoa escrever menos do que queria dizer.
 */
const ALTURA_DA_PAUTA = '8mm';

const ESTILO = `
  @page { size: A4 landscape; margin: 0; }

  * { box-sizing: border-box; }

  /*
   * Sem isto o navegador não imprime fundo, e a pauta — que é um gradiente —
   * some. A folha sairia em branco do lado direito, que é justamente o lado
   * que precisa existir.
   */
  .pauta, .cabecalho, .veredito span, .oracao, .anotacoesLivro {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    color: #111;
    margin: 0;
  }

  .folha {
    width: 297mm;
    height: 210mm;
    display: flex;
    page-break-after: always;
    overflow: hidden;
  }
  .folha:last-child { page-break-after: auto; }

  /* ── metade esquerda: a página do livro, em A5 de verdade ───────────── */

  .pagina {
    width: 148mm;
    height: 210mm;
    padding: 14mm 13mm 12mm;
    border-right: 0.3mm dashed #bbb;
    display: flex;
    flex-direction: column;
    font-size: 8.8pt;
    line-height: 1.34;
  }

  .cabecalho {
    background: #f2f2f2;
    margin: -14mm -13mm 3.5mm;
    padding: 14mm 13mm 3mm;
    text-align: center;
  }
  .titulo {
    font-family: 'Bebas Neue', 'Haettenschweiler', 'Arial Narrow', Impact, sans-serif;
    font-size: 20pt;
    letter-spacing: 0.3px;
    margin: 0 0 1.5mm;
    text-transform: uppercase;
  }
  .versiculo { font-style: italic; font-size: 8.4pt; margin: 0; }
  .referencia { font-style: normal; font-weight: bold; }
  .creditos { font-size: 7.4pt; color: #555; margin-top: 1.5mm; }

  .reflexao p { text-align: justify; hyphens: auto; margin: 0 0 2mm; }
  .rotulo { font-weight: bold; }

  ul { margin: 3mm 0 0; padding: 0; list-style: none; }
  li { position: relative; padding-left: 4mm; margin-bottom: 1.6mm; text-align: justify; }
  li::before { content: "▪"; position: absolute; left: 0; font-size: 7pt; top: 1px; }

  .oracao { background: #efefef; padding: 2.8mm; font-style: italic; text-align: justify; margin-top: auto; }
  .oracao b { font-style: normal; }

  /* ── metade direita: onde ele escreve ────────────────────────────────── */

  .revisao {
    width: 148mm;
    height: 210mm;
    padding: 10mm 10mm 8mm;
    display: flex;
    flex-direction: column;
  }

  .identificacao {
    font-size: 8pt;
    color: #444;
    border-bottom: 0.5mm solid #333;
    padding-bottom: 2mm;
    margin-bottom: 3mm;
  }
  .identificacao b { font-size: 10pt; color: #111; }
  .identificacao .numero { float: right; font-size: 14pt; font-weight: bold; color: #111; }

  /*
   * O veredito existe para a revisão render decisão, e não só comentário.
   * Sem ele, "está bom mas mudaria uma coisa" volta sem dizer se entra no livro.
   */
  .veredito { font-size: 8.5pt; margin-bottom: 3mm; }
  .veredito span {
    display: inline-block;
    border: 0.4mm solid #333;
    width: 4.5mm; height: 4.5mm;
    margin: 0 1.5mm 0 0;
    vertical-align: -0.8mm;
    background: #fff;
  }
  .veredito label { margin-right: 6mm; }

  .tituloAnotacoes { font-size: 9pt; font-weight: bold; margin-bottom: 2mm; }

  /*
   * A pauta é um gradiente repetido, não uma lista de divs: uma linha a cada
   * ${ALTURA_DA_PAUTA}, ocupando o que sobrar da folha, sem contar quantas cabem.
   */
  .pauta {
    flex: 1;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent,
      transparent calc(${ALTURA_DA_PAUTA} - 0.2mm),
      #c9c9c9 calc(${ALTURA_DA_PAUTA} - 0.2mm),
      #c9c9c9 ${ALTURA_DA_PAUTA}
    );
  }

  .assinatura { margin-top: 4mm; font-size: 7.5pt; color: #666; display: flex; justify-content: space-between; }
  .assinatura span { border-top: 0.3mm solid #999; padding-top: 1mm; }
  .assinatura .linhaData { width: 45mm; text-align: center; }
  .assinatura .linhaNome { width: 70mm; text-align: center; }
`;

function paginaDoLivro(p: PaginaDoLivro): string {
  const creditos = [p.data ? dataPorExtenso(p.data) : null, p.pregador ? `Pr. ${p.pregador}` : null]
    .filter(Boolean)
    .join(' · ');

  return `
  <div class="pagina">
    <div class="cabecalho">
      <h1 class="titulo">${escapar(p.titulo)}</h1>
      ${p.versiculo ? `<p class="versiculo">"${escapar(p.versiculo)}"${p.referencia ? ` <span class="referencia">— ${escapar(p.referencia)}</span>` : ''}</p>` : ''}
      ${creditos ? `<div class="creditos">${escapar(creditos)}</div>` : ''}
    </div>

    <div class="reflexao">
      <p><span class="rotulo">REFLEXÃO DEVOCIONAL:</span> ${p.reflexao.map(escapar).join('</p><p>')}</p>
    </div>

    ${
      p.pontosAplicacao.length > 0
        ? `<div><span class="rotulo">PONTOS DE APLICAÇÃO PRÁTICA:</span>
      <ul>${p.pontosAplicacao.map((a) => `<li>${escapar(a)}</li>`).join('')}</ul></div>`
        : ''
    }

    ${p.oracao ? `<div class="oracao"><b>ORAÇÃO:</b> ${escapar(p.oracao)}</div>` : ''}
  </div>`;
}

function ladoDaRevisao(p: PaginaDoLivro, numero: number): string {
  const origem = [p.data ? dataPorExtenso(p.data) : null, p.referencia].filter(Boolean).join(' · ');

  return `
  <div class="revisao">
    <div class="identificacao">
      <span class="numero">${numero}</span>
      <b>${escapar(p.titulo)}</b><br>
      ${escapar(origem)}
    </div>

    <div class="veredito">
      <label><span></span>Aprovado</label>
      <label><span></span>Aprovado com ajustes</label>
      <label><span></span>Refazer</label>
    </div>

    <div class="tituloAnotacoes">ANOTAÇÕES</div>
    <div class="pauta"></div>

    <div class="assinatura">
      <span class="linhaData">data</span>
      <span class="linhaNome">assinatura</span>
    </div>
  </div>`;
}

/**
 * O caderno inteiro.
 *
 * O número em cada folha é o que permite transcrever a correção de volta: o
 * pastor devolve papel, e alguém precisa saber a qual devocional cada anotação
 * pertence.
 */
export function montarRevisao(paginas: PaginaDoLivro[], titulo = 'Revisão — Tempo de Crescer'): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapar(titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
${paginas.map((p, i) => `<div class="folha">${paginaDoLivro(p)}${ladoDaRevisao(p, i + 1)}</div>`).join('\n')}
</body>
</html>`;
}
