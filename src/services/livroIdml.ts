import JSZip from 'jszip';
import { dataPorExtenso, type PaginaDoLivro } from './livro';

/**
 * O livro em IDML, para o designer abrir no InDesign.
 *
 * IDML é um pacote ZIP de XML — dá para montar sem InDesign. O que sai daqui é
 * a **diagramação base**: cada página com os quadros de texto nomeados, na
 * posição do modelo, já preenchidos. O designer ajusta tipografia, viúvas,
 * órfãs e respiros, e manda para a gráfica. É um arquivo vivo, não uma imagem.
 *
 * **Aberto e conferido no InDesign.** A primeira tentativa abriu, com os
 * quadros na posição certa, e expôs três defeitos que já estão corrigidos:
 *
 * 1. `PagesPerDocument` com o total criava as páginas do documento ALÉM dos
 *    spreads, e o arquivo abria com um bloco de páginas em branco na frente.
 * 2. Faltava o `<Br/>` terminador de parágrafo, então o InDesign emendava
 *    tudo numa linha: "REFLEXÃO DEVOCIONAL:Ouvi, céus, e escuta...".
 * 3. O marcador "▪" saía como caractere inválido; "•" existe nas fontes
 *    padrão.
 *
 * ponytail: gerar IDML do zero funciona, mas preencher um template exportado
 * pelo designer é menos código e sobrevive melhor a mudança de layout. Trocar
 * quando houver um template.
 */

/** A5 em pontos: 148 × 210 mm. */
const LARGURA = 419.53;
const ALTURA = 595.28;
const MARGEM = 36;

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Um trecho de texto dentro de um parágrafo.
 *
 * Os rótulos do modelo — "REFLEXÃO DEVOCIONAL:", "ORAÇÃO:" — são negrito
 * **dentro** do parágrafo, não linha própria. Como linha própria e com o
 * parágrafo justificado, o InDesign espalhava "REFLEXÃO" na esquerda e
 * "DEVOCIONAL:" na direita, de ponta a ponta.
 */
export type Trecho = { texto: string; negrito?: boolean; estilo?: string };

function trechoXml({ texto, negrito, estilo: nomeado }: Trecho): string {
  const estilo = nomeado
    ? `CharacterStyle/${nomeado}`
    : negrito
      ? 'CharacterStyle/Negrito'
      : 'CharacterStyle/$ID/[No character style]';
  return `<CharacterStyleRange AppliedCharacterStyle="${estilo}">
          <Content>${escapar(texto)}</Content>
        </CharacterStyleRange>`;
}

/**
 * Um parágrafo dentro de uma Story.
 *
 * O `<Br/>` no fim é o terminador de parágrafo do IDML. Sem ele o InDesign
 * emenda tudo numa linha só — foi o que aconteceu na primeira tentativa, e o
 * texto saiu como "REFLEXÃO DEVOCIONAL:Ouvi, céus, e escuta...".
 */
function paragrafo(trechos: Trecho[], estilo: string, ultimo: boolean): string {
  const quebra = ultimo ? '' : '<Br/>';
  const corpo = trechos.map(trechoXml).join('\n        ');
  return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${estilo}">
        ${corpo}${quebra}
      </ParagraphStyleRange>`;
}

function story(id: string, paragrafos: Array<{ trechos: Trecho[]; estilo: string }>): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <Story Self="${id}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="" AppliedNamedGrid="n">
    <StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>
    ${paragrafos.map((p, i) => paragrafo(p.trechos, p.estilo, i === paragrafos.length - 1)).join('\n    ')}
  </Story>
</idPkg:Story>`;
}

/** Um quadro de texto posicionado, ligado à sua Story. */
function quadro(
  self: string,
  storyId: string,
  caixa: { x: number; y: number; largura: number; altura: number },
  nome: string,
  fundo = false,
): string {
  const { x, y, largura, altura } = caixa;
  // O InDesign posiciona pelo centro do quadro, com o item transformado.
  const meiaL = largura / 2;
  const meiaA = altura / 2;

  // O recuo interno existe para o texto não encostar na borda da caixa cinza.
  const preenchimento = fundo ? ' FillColor="Color/Cinza"' : '';
  const recuo = fundo ? 6 : 0;

  return `<TextFrame Self="${self}" ParentStory="${storyId}" Name="${escapar(nome)}"${preenchimento}
      ContentType="TextType" ItemTransform="1 0 0 1 ${(x + meiaL - LARGURA / 2).toFixed(2)} ${(y + meiaA - ALTURA / 2).toFixed(2)}">
      <Properties>
        <PathGeometry>
          <GeometryPathType PathOpen="false">
            <PathPointArray>
              <PathPointType Anchor="${-meiaL} ${-meiaA}" LeftDirection="${-meiaL} ${-meiaA}" RightDirection="${-meiaL} ${-meiaA}"/>
              <PathPointType Anchor="${-meiaL} ${meiaA}" LeftDirection="${-meiaL} ${meiaA}" RightDirection="${-meiaL} ${meiaA}"/>
              <PathPointType Anchor="${meiaL} ${meiaA}" LeftDirection="${meiaL} ${meiaA}" RightDirection="${meiaL} ${meiaA}"/>
              <PathPointType Anchor="${meiaL} ${-meiaA}" LeftDirection="${meiaL} ${-meiaA}" RightDirection="${meiaL} ${-meiaA}"/>
            </PathPointArray>
          </GeometryPathType>
        </PathGeometry>
      </Properties>
      <TextFramePreference TextColumnCount="1" VerticalJustification="TopAlign">
        <Properties>
          <InsetSpacing type="list">
            <ListItem type="unit">${recuo}</ListItem>
            <ListItem type="unit">${recuo}</ListItem>
            <ListItem type="unit">${recuo}</ListItem>
            <ListItem type="unit">${recuo}</ListItem>
          </InsetSpacing>
        </Properties>
      </TextFramePreference>
    </TextFrame>`;
}

type ParagrafoDoBloco = { trechos: Trecho[]; estilo: string };

type Bloco = {
  nome: string;
  caixa: { x: number; y: number; largura: number; altura: number };
  paragrafos: ParagrafoDoBloco[];
  /** Caixa cinza, como a da oração e a do número da página no modelo. */
  fundo?: boolean;
};

/** Atalhos para montar os parágrafos do modelo sem repetição. */
const texto = (t: string, estilo = 'Corpo'): ParagrafoDoBloco => ({ trechos: [{ texto: t }], estilo });
const titulado = (rotulo: string, corpo: string, estilo = 'Corpo'): ParagrafoDoBloco => ({
  trechos: [{ texto: `${rotulo} `, negrito: true }, { texto: corpo }],
  estilo,
});
const cabecalhoDeSecao = (t: string): ParagrafoDoBloco => ({
  trechos: [{ texto: t, negrito: true }],
  estilo: 'Secao',
});

/**
 * Quantas páginas cada devocional ocupa.
 *
 * `uma` é o formato do Tozer: título, versículo, reflexão, pontos, QR e
 * oração numa página só. `duas` abre em páginas encaradas — a esquerda recebe
 * o título, o versículo e a reflexão, com espaço para respirar, e a direita
 * recebe a aplicação, a oração e o QR.
 *
 * `auto` é o padrão e decide por devocional: o acervo tem pregações curtas e
 * longas, e forçar o mesmo formato para todas deixaria umas apertadas e outras
 * com metade da página vazia.
 */
export type PaginasPorDevocional = 'uma' | 'duas' | 'auto';

/**
 * Acima disto o devocional não cabe numa página só.
 *
 * O número saiu de medir a página A5 renderizada: os blocos fixos ocupam 501px
 * dos 695px úteis, sobram 194px para a reflexão, e isso dá cerca de 1.250
 * caracteres. A margem é para o texto não encostar no rodapé.
 */
const LIMITE_DE_UMA_PAGINA = 1150;

function cabeEmUmaPagina(p: PaginaDoLivro): boolean {
  const reflexao = p.reflexao.join(' ').length;
  const aplicacao = p.pontosAplicacao.join(' ').length;
  return reflexao + aplicacao <= LIMITE_DE_UMA_PAGINA;
}

/**
 * Os blocos da página, no modelo escolhido pelo pastor.
 *
 * Pontos de aplicação e oração ocupam a largura toda, não há bloco de
 * anotações, e o link da transmissão fica discreto no rodapé — foi a versão
 * que a igreja preferiu entre as duas apresentadas.
 */
function blocosDaPagina(p: PaginaDoLivro): Bloco[] {
  const util = LARGURA - MARGEM * 2;

  return [
    ...cabecalhoEcreditos(p, MARGEM, util),
    {
      nome: 'Reflexao',
      caixa: { x: MARGEM, y: 186, largura: util, altura: 230 },
      paragrafos: reflexaoComRotulo(p),
    },
    {
      nome: 'PontosAplicacao',
      caixa: { x: MARGEM, y: 428, largura: util, altura: 104 },
      paragrafos: [cabecalhoDeSecao('PONTOS DE APLICAÇÃO PRÁTICA:'), ...marcadores(p)],
    },
    {
      nome: 'Oracao',
      caixa: { x: MARGEM, y: 486, largura: util, altura: 62 },
      paragrafos: p.oracao ? [titulado('ORAÇÃO:', `"${p.oracao}"`, 'Oracao')] : [],
      fundo: true,
    },
    {
      nome: 'QRCode',
      caixa: { x: MARGEM, y: 556, largura: util * 0.62, altura: 22 },
      // O link fica escrito para o designer gerar o QR na diagramação.
      paragrafos: p.youtubeUrl ? [texto(p.youtubeUrl, 'Nota')] : [],
    },
    numeroDaPagina(),
  ].filter((b) => b.paragrafos.length > 0);
}

/**
 * O número da página, na caixinha cinza do rodapé.
 *
 * O texto fica vazio de propósito: o designer põe o marcador de número de
 * página do InDesign, que renumera sozinho quando a ordem muda. Escrever o
 * número aqui congelaria a paginação.
 */
function numeroDaPagina(): Bloco {
  const largura = 46;
  return {
    nome: 'NumeroDaPagina',
    caixa: { x: (LARGURA - largura) / 2, y: 578, largura, altura: 20 },
    paragrafos: [{ trechos: [{ texto: ' ' }], estilo: 'Numero' }],
    fundo: true,
  };
}

/** Título, versículo e créditos — iguais nos dois modelos. */
function cabecalhoEcreditos(p: PaginaDoLivro, x: number, largura: number): Bloco[] {
  const blocos: Bloco[] = [
    {
      nome: 'Titulo',
      caixa: { x, y: 44, largura, altura: 56 },
      paragrafos: [{ trechos: [{ texto: p.titulo.toUpperCase() }], estilo: 'Titulo' }],
    },
  ];

  if (p.versiculo) {
    blocos.push({
      nome: 'Versiculo',
      caixa: { x, y: 104, largura, altura: 38 },
      paragrafos: [
        {
          // A referência sai do itálico do versículo, mas em peso normal —
          // no modelo do designer ela é romana, não negrito.
          trechos: [
            { texto: `"${p.versiculo}" ` },
            { texto: `- ${p.referencia ?? ''}`, estilo: 'Romano' },
          ],
          estilo: 'Versiculo',
        },
      ],
    });
  }

  blocos.push({
    nome: 'Creditos',
    caixa: { x, y: 146, largura, altura: 34 },
    paragrafos: [
      ...(p.data ? [titulado('Data:', dataPorExtenso(p.data), 'Creditos')] : []),
      titulado('Pastor:', p.pregador ?? '—', 'Creditos'),
    ],
  });

  return blocos;
}

/** O rótulo abre o primeiro parágrafo em negrito, como no modelo. */
function reflexaoComRotulo(p: PaginaDoLivro): ParagrafoDoBloco[] {
  const [primeiro, ...resto] = p.reflexao;
  return [
    titulado('REFLEXÃO DEVOCIONAL:', primeiro ?? ''),
    ...resto.map((paragrafo) => texto(paragrafo)),
  ];
}

function marcadores(p: PaginaDoLivro): ParagrafoDoBloco[] {
  return p.pontosAplicacao.map((item) => texto(`• ${item}`, 'Marcador'));
}

/** Página esquerda do modelo de duas: o texto respira. */
function blocosDaEsquerda(p: PaginaDoLivro): Bloco[] {
  const util = LARGURA - MARGEM * 2;
  return [
    ...cabecalhoEcreditos(p, MARGEM, util),
    {
      nome: 'Reflexao',
      caixa: { x: MARGEM, y: 190, largura: util, altura: 368 },
      paragrafos: reflexaoComRotulo(p),
    },
    numeroDaPagina(),
  ].filter((b) => b.paragrafos.length > 0);
}

/** Página direita do modelo de duas: aplicação, oração e QR. */
function blocosDaDireita(p: PaginaDoLivro): Bloco[] {
  const util = LARGURA - MARGEM * 2;
  return [
    {
      nome: 'PontosAplicacao',
      caixa: { x: MARGEM, y: 60, largura: util, altura: 200 },
      paragrafos: [cabecalhoDeSecao('PONTOS DE APLICAÇÃO PRÁTICA:'), ...marcadores(p)],
    },
    {
      nome: 'Oracao',
      caixa: { x: MARGEM, y: 286, largura: util, altura: 110 },
      paragrafos: p.oracao ? [titulado('ORAÇÃO:', `"${p.oracao}"`, 'Oracao')] : [],
      fundo: true,
    },
    {
      nome: 'QRCode',
      caixa: { x: MARGEM, y: 420, largura: util, altura: 66 },
      paragrafos: [
        cabecalhoDeSecao('ASSISTA ON-LINE:'),
        ...(p.youtubeUrl ? [texto(p.youtubeUrl, 'Nota')] : []),
      ],
    },
    {
      nome: 'Anotacoes',
      caixa: { x: MARGEM, y: 494, largura: util, altura: 76 },
      paragrafos: [cabecalhoDeSecao('ANOTAÇÕES:')],
      fundo: true,
    },
    numeroDaPagina(),
  ].filter((b) => b.paragrafos.length > 0);
}

/**
 * Estilos de parágrafo e caractere.
 *
 * Três decisões vieram do arquivo aberto no InDesign:
 *
 * - **Cabeçalho de seção nunca é justificado.** Justificado e sozinho na
 *   linha, "PONTOS DE APLICAÇÃO PRÁTICA:" saía espalhado de ponta a ponta.
 * - **A justificação tem limite de compressão.** Sem `MinimumWordSpacing`, o
 *   InDesign espremia os espaços até sumirem, e o texto virava
 *   "FixeoolharemCristoantesdetentarqualqueravanço".
 * - **`SpaceAfter` separa os parágrafos.** Sem ele o texto vira um bloco só.
 */
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <RootCharacterStyleGroup Self="u1">
    <CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/>
    <CharacterStyle Self="CharacterStyle/Negrito" Name="Negrito" FontStyle="Bold"/>
    <CharacterStyle Self="CharacterStyle/Romano" Name="Romano" FontStyle="Regular"/>
  </RootCharacterStyleGroup>
  <RootParagraphStyleGroup Self="u2">
    <ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]"/>

    <ParagraphStyle Self="ParagraphStyle/Titulo" Name="Titulo"
      PointSize="30" Leading="30" Justification="LeftAlign" Capitalization="AllCaps"
      Hyphenation="false" Tracking="-15"/>

    <ParagraphStyle Self="ParagraphStyle/Versiculo" Name="Versiculo"
      PointSize="9.5" Leading="12" FontStyle="Italic" Justification="LeftAlign" Hyphenation="false"/>

    <ParagraphStyle Self="ParagraphStyle/Creditos" Name="Creditos"
      PointSize="10" Leading="13" Justification="LeftAlign" Hyphenation="false"/>

    <ParagraphStyle Self="ParagraphStyle/Corpo" Name="Corpo"
      PointSize="9.5" Leading="12.5" Justification="LeftJustified" Hyphenation="true"
      SpaceAfter="5" MinimumWordSpacing="85" DesiredWordSpacing="100" MaximumWordSpacing="133"
      MinimumGlyphScaling="98" MaximumGlyphScaling="102"/>

    <ParagraphStyle Self="ParagraphStyle/Secao" Name="Secao"
      PointSize="9.5" Leading="12.5" Justification="LeftAlign" Hyphenation="false" SpaceAfter="3"/>

    <ParagraphStyle Self="ParagraphStyle/Marcador" Name="Marcador"
      PointSize="9.5" Leading="12.5" Justification="LeftAlign" Hyphenation="false"
      SpaceAfter="3" LeftIndent="10" FirstLineIndent="-10"
      MinimumWordSpacing="90" DesiredWordSpacing="100" MaximumWordSpacing="120"/>

    <ParagraphStyle Self="ParagraphStyle/Oracao" Name="Oracao"
      PointSize="9.5" Leading="12.5" FontStyle="Italic" Justification="LeftJustified" Hyphenation="true"
      MinimumWordSpacing="85" DesiredWordSpacing="100" MaximumWordSpacing="133"/>

    <ParagraphStyle Self="ParagraphStyle/Numero" Name="Numero"
      PointSize="9" Leading="11" Justification="CenterAlign" Hyphenation="false"/>

    <ParagraphStyle Self="ParagraphStyle/Nota" Name="Nota"
      PointSize="7.5" Leading="9.5" Justification="LeftAlign" Hyphenation="false"/>
  </RootParagraphStyleGroup>
</idPkg:Styles>`;

/**
 * Monta o pacote.
 *
 * Uma página por spread, na ordem em que as páginas foram passadas.
 */
export async function montarIdml(
  paginas: PaginaDoLivro[],
  formato: PaginasPorDevocional = 'auto',
): Promise<Buffer> {
  const zip = new JSZip();

  // O mimetype precisa ser o primeiro arquivo e sem compressão — é assim que
  // o formato é reconhecido antes de descompactar o resto.
  zip.file('mimetype', 'application/vnd.adobe.indesign-idml-package', { compression: 'STORE' });

  const spreads: string[] = [];
  const stories: string[] = [];

  // Um devocional pode virar uma folha ou duas encaradas.
  const folhas = paginas.flatMap((p) => {
    const emDuas = formato === 'duas' || (formato === 'auto' && !cabeEmUmaPagina(p));
    return emDuas ? [blocosDaEsquerda(p), blocosDaDireita(p)] : [blocosDaPagina(p)];
  });

  folhas.forEach((blocos, indice) => {
    const spreadId = `spread${indice}`;
    const quadros: string[] = [];

    blocos.forEach((bloco, ordem) => {
      const storyId = `story${indice}_${ordem}`;
      stories.push(storyId);
      zip.file(
        `Stories/Story_${storyId}.xml`,
        story(storyId, bloco.paragrafos),
      );
      quadros.push(quadro(`frame${indice}_${ordem}`, storyId, bloco.caixa, bloco.nome, bloco.fundo));
    });

    spreads.push(spreadId);
    zip.file(
      `Spreads/Spread_${spreadId}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <Spread Self="${spreadId}" PageCount="1" BindingLocation="0" ItemTransform="1 0 0 1 0 0">
    <Page Self="${spreadId}_page" Name="${indice + 1}" AppliedMaster="n" ItemTransform="1 0 0 1 ${-LARGURA / 2} ${-ALTURA / 2}">
      <Properties>
        <PageColor type="enumeration">UseMasterColor</PageColor>
      </Properties>
    </Page>
    ${quadros.join('\n    ')}
  </Spread>
</idPkg:Spread>`,
    );
  });

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles>
</container>`,
  );

  zip.file('Resources/Styles.xml', ESTILOS);

  // Sem a cor declarada aqui, o FillColor dos quadros não resolve e as caixas
  // da oração, das anotações e do número saem sem fundo.
  zip.file(
    'Resources/Graphic.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Graphic xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <Color Self="Color/Cinza" Model="Process" Space="CMYK" ColorValue="0 0 0 8"
    Name="Cinza" ColorOverride="Normal"/>
  <Color Self="Color/Preto" Model="Process" Space="CMYK" ColorValue="0 0 0 100"
    Name="Preto" ColorOverride="Normal"/>
  <Color Self="Color/$ID/None" Model="Process" Space="CMYK" ColorValue="0 0 0 0"
    Name="$ID/None" ColorOverride="Normal"/>
</idPkg:Graphic>`,
  );
  zip.file(
    'Resources/Preferences.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Preferences xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <!--
    PagesPerDocument fica em 1: as páginas de verdade vêm dos spreads. Com o
    total aqui, o InDesign criava as páginas do documento E os spreads, e o
    arquivo abria com um bloco de páginas em branco na frente.
  -->
  <DocumentPreference PageWidth="${LARGURA}" PageHeight="${ALTURA}" FacingPages="false" PagesPerDocument="1"/>
  <ViewPreference HorizontalMeasurementUnits="Points" VerticalMeasurementUnits="Points"/>
</idPkg:Preferences>`,
  );

  zip.file(
    'designmap.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" DOMVersion="18.0" readerVersion="6.0" featureSet="257" product="18.0(50)"?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0" Self="doc">
  <idPkg:Preferences src="Resources/Preferences.xml"/>
  <idPkg:Graphic src="Resources/Graphic.xml"/>
  <idPkg:Styles src="Resources/Styles.xml"/>
  ${spreads.map((s) => `<idPkg:Spread src="Spreads/Spread_${s}.xml"/>`).join('\n  ')}
  ${stories.map((s) => `<idPkg:Story src="Stories/Story_${s}.xml"/>`).join('\n  ')}
</Document>`,
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
