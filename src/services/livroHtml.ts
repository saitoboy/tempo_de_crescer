import { dataPorExtenso, type PaginaDoLivro } from './livro';

/**
 * O livro em HTML, pronto para imprimir em A5.
 *
 * Por que HTML e não uma biblioteca de PDF: a página tem texto justificado com
 * hifenização, viúvas e órfãs controladas — coisas que o motor de texto do
 * navegador faz bem e que montar à mão em coordenadas levaria muito mais código
 * para um resultado pior. Imprimir para PDF pelo navegador dá o A5 final.
 *
 * O arquivo é autossuficiente: o QR vai embutido como SVG, sem imagem externa.
 */

export type Modelo = 'compacto' | 'largo';

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Bebas Neue no título, como no modelo escaneado.
 *
 * A fonte não é embutida: são ~30 KB por página de livro e a licença pede
 * atenção na redistribuição. Instalada na máquina, o navegador usa; sem ela,
 * cai para Haettenschweiler e depois Arial Narrow, que são condensadas e
 * seguram o mesmo peso visual.
 */
const FONTE_TITULO = `'Bebas Neue', 'Haettenschweiler', 'Arial Narrow', Impact, sans-serif`;

const ESTILO_COMUM = `
  @page { size: A5; margin: 14mm 13mm 12mm; }

  * { box-sizing: border-box; }

  /*
   * O navegador não imprime fundo por padrão, e sem isto a faixa do cabeçalho,
   * o bloco da oração e o número da página saem em branco — a página perde a
   * estrutura visual do modelo. Isto força a impressão das áreas cinza sem o
   * leitor precisar marcar "gráficos de plano de fundo".
   */
  .cabecalho, .oracao, .anotacoes, .numero span {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    font-size: 8.8pt;
    line-height: 1.34;
    color: #111;
    margin: 0;
  }

  /*
   * Na tela não existe @page, então a margem da folha precisa ser imitada —
   * senão o cabeçalho, que sangra com margem negativa, sai do enquadramento e
   * a pré-visualização engana. Some na impressão, onde @page manda.
   */
  @media screen {
    body {
      padding: 14mm 13mm 12mm;
      background: #fff;
      width: 148mm;
      margin: 0 auto;
    }
    .pagina { min-height: 184mm; }
    .pagina + .pagina { margin-top: 10mm; border-top: 1px dashed #ccc; padding-top: 14mm; }
  }

  .pagina {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .pagina:last-child { page-break-after: auto; }

  .cabecalho {
    background: linear-gradient(180deg, #e4e4e4 0%, #f4f4f4 100%);
    margin: -14mm -13mm 0;
    padding: 15mm 13mm 3.5mm;
  }

  h1 {
    font-family: ${FONTE_TITULO};
    font-size: 24pt;
    line-height: 1.0;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    margin: 0 0 2mm;
  }

  .versiculo { font-style: italic; font-size: 8.2pt; line-height: 1.28; margin: 0; }
  .versiculo .referencia { font-style: normal; }

  .creditos { margin: 3.5mm 0 3mm; font-size: 8.8pt; }
  .creditos b { letter-spacing: 0.2px; }

  .reflexao p {
    text-align: justify;
    hyphens: auto;
    margin: 0 0 2mm;
    orphans: 2;
    widows: 2;
  }

  h2 {
    font-size: 8.6pt;
    font-weight: bold;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    margin: 0 0 1.8mm;
  }

  ul { margin: 0; padding: 0; list-style: none; }
  li {
    position: relative;
    padding-left: 4mm;
    margin-bottom: 1.6mm;
    text-align: justify;
    hyphens: auto;
  }
  li::before { content: "▪"; position: absolute; left: 0; font-size: 7pt; top: 1px; }

  .oracao { background: #efefef; padding: 2.8mm; font-style: italic; text-align: justify; hyphens: auto; }
  .oracao b { font-style: normal; }

  .numero { text-align: center; margin-top: 2.5mm; font-size: 7.6pt; }
  .numero span { background: #efefef; padding: 1mm 3mm; }

  .creditoRedacao { font-size: 7.2pt; color: #666; text-align: center; margin-top: 1.2mm; }
`;

/** Modelo 1: QR ao lado dos pontos, com espaço para anotações. */
const ESTILO_COMPACTO = `
  .colunas { display: flex; gap: 7mm; margin-top: 3.5mm; align-items: flex-start; }
  .coluna-larga { flex: 1.55; }
  .coluna-estreita { flex: 1; text-align: center; }
  .qrcode svg { width: 25mm; height: 25mm; }

  .rodape { display: flex; gap: 7mm; margin-top: auto; padding-top: 3.5mm; align-items: stretch; }
  .rodape .oracao { flex: 1.55; }
  .anotacoes { flex: 1; background: #efefef; padding: 2.8mm; min-height: 20mm; }
`;

/**
 * Modelo 2: pontos e oração em largura total, sem anotações.
 *
 * O QR fica pequeno e discreto no rodapé, ao lado do número da página — o
 * modelo original trazia a URL do blog escrita, que ocupava três linhas e
 * ninguém digita. O QR faz o mesmo trabalho em 14 mm.
 */
const ESTILO_LARGO = `
  .aplicacao { margin-top: 4mm; }

  .rodape { margin-top: auto; padding-top: 4mm; }
  .rodape .oracao { width: 100%; }

  .assinatura {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4mm;
    margin-top: 3mm;
  }
  .assinatura .qrcode svg { width: 14mm; height: 14mm; display: block; opacity: 0.88; }
  .assinatura .numero { margin: 0; }
`;

function cabecalho(p: PaginaDoLivro): string {
  const versiculo = p.versiculo
    ? `<p class="versiculo">"${escapar(p.versiculo)}" <span class="referencia">- ${escapar(p.referencia ?? '')}</span></p>`
    : '';

  return `<div class="cabecalho">
    <h1>${escapar(p.titulo)}</h1>
    ${versiculo}
  </div>

  <p class="creditos">
    ${p.data ? `<b>Data:</b> ${dataPorExtenso(p.data)}<br>` : ''}
    <b>Pastor:</b> ${escapar(p.pregador ?? '—')}
  </p>`;
}

function reflexao(p: PaginaDoLivro): string {
  const paragrafos = p.reflexao
    .map((texto, i) =>
      i === 0
        ? `<p><b>REFLEXÃO DEVOCIONAL:</b> ${escapar(texto)}</p>`
        : `<p>${escapar(texto)}</p>`,
    )
    .join('\n');
  return `<div class="reflexao">${paragrafos}</div>`;
}

function pontos(p: PaginaDoLivro): string {
  return `<h2>Pontos de aplicação prática:</h2>
      <ul>${p.pontosAplicacao.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`;
}

function oracao(p: PaginaDoLivro): string {
  return p.oracao
    ? `<div class="oracao"><b>ORAÇÃO:</b> "${escapar(p.oracao)}"</div>`
    : '<div class="oracao"></div>';
}

function rodapeDeCredito(p: PaginaDoLivro): string {
  return p.redator ? `<div class="creditoRedacao">Resenha por ${escapar(p.redator)}</div>` : '';
}

function paginaCompacta(p: PaginaDoLivro, numero: number): string {
  const qrcode = p.qrcodeSvg
    ? `<h2>Assista on-line:</h2><div class="qrcode">${p.qrcodeSvg}</div>`
    : '';

  return `<section class="pagina">
  ${cabecalho(p)}
  ${reflexao(p)}

  <div class="colunas">
    <div class="coluna-larga">${pontos(p)}</div>
    <div class="coluna-estreita">${qrcode}</div>
  </div>

  <div class="rodape">
    ${oracao(p)}
    <div class="anotacoes"><h2>Anotações:</h2></div>
  </div>

  <div class="numero"><span>${String(numero).padStart(2, '0')}</span></div>
  ${rodapeDeCredito(p)}
</section>`;
}

function paginaLarga(p: PaginaDoLivro, numero: number): string {
  const qrcode = p.qrcodeSvg ? `<div class="qrcode">${p.qrcodeSvg}</div>` : '';

  return `<section class="pagina">
  ${cabecalho(p)}
  ${reflexao(p)}

  <div class="aplicacao">${pontos(p)}</div>

  <div class="rodape">${oracao(p)}</div>

  <div class="assinatura">
    ${qrcode}
    <div class="numero"><span>${String(numero).padStart(2, '0')}</span></div>
  </div>
  ${rodapeDeCredito(p)}
</section>`;
}

export function montarHtml(
  paginas: PaginaDoLivro[],
  modelo: Modelo = 'compacto',
  titulo = 'Tempo de Crescer',
): string {
  const montarPagina = modelo === 'largo' ? paginaLarga : paginaCompacta;
  const estilo = ESTILO_COMUM + (modelo === 'largo' ? ESTILO_LARGO : ESTILO_COMPACTO);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapar(titulo)}</title>
<style>${estilo}</style>
</head>
<body>
${paginas.map((p, i) => montarPagina(p, i + 1)).join('\n')}
</body>
</html>`;
}
