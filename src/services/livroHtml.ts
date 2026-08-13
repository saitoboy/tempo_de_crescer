import { dataPorExtenso, type PaginaDoLivro } from './livro';

/**
 * O livro em HTML, pronto para imprimir em A5.
 *
 * Por que HTML e não uma biblioteca de PDF: a página tem texto justificado com
 * hifenização, viúvas e órfãs controladas e um bloco de anotações — coisas que
 * o motor de texto do navegador faz bem e que montar à mão em coordenadas
 * levaria muito mais código para um resultado pior. Imprimir para PDF pelo
 * navegador dá o A5 final.
 *
 * O arquivo é autossuficiente: o QR vai embutido como SVG, sem imagem externa.
 */

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ESTILO = `
  @page { size: A5; margin: 14mm 13mm 12mm; }

  * { box-sizing: border-box; }

  body {
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    font-size: 10.2pt;
    line-height: 1.42;
    color: #111;
    margin: 0;
  }

  .pagina {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .pagina:last-child { page-break-after: auto; }

  .cabecalho {
    background: #f0f0f0;
    margin: -14mm -13mm 0;
    padding: 16mm 13mm 5mm;
  }

  h1 {
    font-family: "Haettenschweiler", "Arial Narrow", "Impact", sans-serif;
    font-size: 27pt;
    line-height: 1.02;
    letter-spacing: 0.2px;
    text-transform: uppercase;
    margin: 0 0 3mm;
  }

  .versiculo { font-style: italic; font-size: 9.6pt; margin: 0; }
  .versiculo .referencia { font-style: normal; }

  .creditos { margin: 5mm 0 4mm; font-size: 10pt; }
  .creditos b { letter-spacing: 0.2px; }

  .reflexao p {
    text-align: justify;
    hyphens: auto;
    margin: 0 0 2.6mm;
    orphans: 2;
    widows: 2;
  }
  .reflexao b { letter-spacing: 0.3px; }

  .colunas {
    display: flex;
    gap: 7mm;
    margin-top: 5mm;
    align-items: flex-start;
  }
  .coluna-larga { flex: 1.55; }
  .coluna-estreita { flex: 1; text-align: center; }

  h2 {
    font-size: 10pt;
    font-weight: bold;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    margin: 0 0 2.5mm;
  }

  ul { margin: 0; padding: 0; list-style: none; }
  li {
    position: relative;
    padding-left: 4mm;
    margin-bottom: 2.2mm;
    text-align: justify;
    hyphens: auto;
  }
  li::before { content: "▪"; position: absolute; left: 0; font-size: 7pt; top: 1px; }

  .qrcode svg { width: 34mm; height: 34mm; }

  .rodape { display: flex; gap: 7mm; margin-top: auto; padding-top: 5mm; align-items: stretch; }
  .oracao { flex: 1.55; background: #efefef; padding: 3.5mm; font-style: italic; text-align: justify; hyphens: auto; }
  .oracao b { font-style: normal; }
  .anotacoes { flex: 1; background: #efefef; padding: 3.5mm; min-height: 30mm; }

  .numero { text-align: center; margin-top: 4mm; font-size: 8.5pt; }
  .numero span { background: #efefef; padding: 1mm 3mm; }

  .creditoRedacao { font-size: 7.5pt; color: #555; text-align: center; margin-top: 1.5mm; }
`;

function paginaHtml(p: PaginaDoLivro, numero: number): string {
  const versiculo = p.versiculo
    ? `<p class="versiculo">"${escapar(p.versiculo)}" <span class="referencia">- ${escapar(p.referencia ?? '')}</span></p>`
    : '';

  const reflexao = p.reflexao
    .map((paragrafo, i) =>
      i === 0
        ? `<p><b>REFLEXÃO DEVOCIONAL:</b> ${escapar(paragrafo)}</p>`
        : `<p>${escapar(paragrafo)}</p>`,
    )
    .join('\n');

  const qrcode = p.qrcodeSvg
    ? `<h2>Assista on-line:</h2><div class="qrcode">${p.qrcodeSvg}</div>`
    : '';

  const oracao = p.oracao
    ? `<div class="oracao"><b>ORAÇÃO:</b> "${escapar(p.oracao)}"</div>`
    : '<div class="oracao"></div>';

  return `<section class="pagina">
  <div class="cabecalho">
    <h1>${escapar(p.titulo)}</h1>
    ${versiculo}
  </div>

  <p class="creditos">
    <b>Data:</b> ${dataPorExtenso(p.data)}<br>
    <b>Pastor:</b> ${escapar(p.pregador ?? '—')}
  </p>

  <div class="reflexao">${reflexao}</div>

  <div class="colunas">
    <div class="coluna-larga">
      <h2>Pontos de aplicação prática:</h2>
      <ul>${p.pontosAplicacao.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>
    </div>
    <div class="coluna-estreita">${qrcode}</div>
  </div>

  <div class="rodape">
    ${oracao}
    <div class="anotacoes"><h2>Anotações:</h2></div>
  </div>

  <div class="numero"><span>${String(numero).padStart(2, '0')}</span></div>
  ${p.redator ? `<div class="creditoRedacao">Resenha por ${escapar(p.redator)}</div>` : ''}
</section>`;
}

export function montarHtml(paginas: PaginaDoLivro[], titulo = 'Tempo de Crescer'): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapar(titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
${paginas.map((p, i) => paginaHtml(p, i + 1)).join('\n')}
</body>
</html>`;
}
