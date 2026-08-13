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
 * ⚠️ Este gerador **não foi aberto no InDesign** — não há licença aqui para
 * testar. A estrutura segue a especificação IDML, mas até alguém abrir o
 * arquivo de verdade isso é promessa, não fato. O caminho seguro para produção
 * é o designer exportar um template do InDesign uma vez e este código preencher
 * os quadros dele, em vez de gerar o pacote do zero.
 *
 * ponytail: gerar IDML do zero é o caminho arriscado; preencher template
 * exportado é o barato. Trocar quando houver um template.
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

/** Um parágrafo dentro de uma Story. */
function paragrafo(texto: string, estilo: string): string {
  return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${estilo}">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content>${escapar(texto)}</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>`;
}

function story(id: string, paragrafos: Array<{ texto: string; estilo: string }>): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <Story Self="${id}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="" AppliedNamedGrid="n">
    <StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>
    ${paragrafos.map((p) => paragrafo(p.texto, p.estilo)).join('\n    ')}
  </Story>
</idPkg:Story>`;
}

/** Um quadro de texto posicionado, ligado à sua Story. */
function quadro(
  self: string,
  storyId: string,
  caixa: { x: number; y: number; largura: number; altura: number },
  nome: string,
): string {
  const { x, y, largura, altura } = caixa;
  // O InDesign posiciona pelo centro do quadro, com o item transformado.
  const meiaL = largura / 2;
  const meiaA = altura / 2;

  return `<TextFrame Self="${self}" ParentStory="${storyId}" Name="${escapar(nome)}"
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
      <TextFramePreference TextColumnCount="1" VerticalJustification="TopAlign"/>
    </TextFrame>`;
}

type Bloco = {
  nome: string;
  estilo: string;
  caixa: { x: number; y: number; largura: number; altura: number };
  paragrafos: string[];
};

/** Os blocos da página, na posição do modelo escaneado. */
function blocosDaPagina(p: PaginaDoLivro): Bloco[] {
  const util = LARGURA - MARGEM * 2;
  const colunaLarga = util * 0.6;
  const colunaEstreita = util * 0.35;
  const direita = MARGEM + util - colunaEstreita;

  const blocos: Bloco[] = [
    {
      nome: 'Titulo',
      estilo: 'Titulo',
      caixa: { x: MARGEM, y: 40, largura: util, altura: 60 },
      paragrafos: [p.titulo.toUpperCase()],
    },
  ];

  if (p.versiculo) {
    blocos.push({
      nome: 'Versiculo',
      estilo: 'Versiculo',
      caixa: { x: MARGEM, y: 102, largura: util, altura: 34 },
      paragrafos: [`"${p.versiculo}" - ${p.referencia ?? ''}`],
    });
  }

  blocos.push(
    {
      nome: 'Creditos',
      estilo: 'Creditos',
      caixa: { x: MARGEM, y: 142, largura: util, altura: 30 },
      paragrafos: [`Data: ${dataPorExtenso(p.data)}`, `Pastor: ${p.pregador ?? '—'}`],
    },
    {
      nome: 'Reflexao',
      estilo: 'Corpo',
      caixa: { x: MARGEM, y: 178, largura: util, altura: 190 },
      paragrafos: ['REFLEXÃO DEVOCIONAL:', ...p.reflexao],
    },
    {
      nome: 'PontosAplicacao',
      estilo: 'Corpo',
      caixa: { x: MARGEM, y: 376, largura: colunaLarga, altura: 130 },
      paragrafos: ['PONTOS DE APLICAÇÃO PRÁTICA:', ...p.pontosAplicacao.map((i) => `▪ ${i}`)],
    },
    {
      nome: 'QRCode',
      estilo: 'Creditos',
      caixa: { x: direita, y: 376, largura: colunaEstreita, altura: 130 },
      // O QR entra como URL: o designer coloca a imagem, ou o InDesign gera.
      // Embutir SVG dentro de IDML exige um Graphic com Link, e um link para
      // arquivo que o designer não tem quebraria ao abrir.
      paragrafos: ['ASSISTA ON-LINE:', p.youtubeUrl ?? ''],
    },
    {
      nome: 'Oracao',
      estilo: 'Oracao',
      caixa: { x: MARGEM, y: 512, largura: colunaLarga, altura: 60 },
      paragrafos: p.oracao ? [`ORAÇÃO: "${p.oracao}"`] : [],
    },
    {
      nome: 'Anotacoes',
      estilo: 'Creditos',
      caixa: { x: direita, y: 512, largura: colunaEstreita, altura: 60 },
      paragrafos: ['ANOTAÇÕES:'],
    },
  );

  return blocos.filter((b) => b.paragrafos.length > 0);
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <RootCharacterStyleGroup Self="u1">
    <CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/>
  </RootCharacterStyleGroup>
  <RootParagraphStyleGroup Self="u2">
    <ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]"/>
    <ParagraphStyle Self="ParagraphStyle/Titulo" Name="Titulo" PointSize="27" Justification="LeftAlign" Capitalization="AllCaps"/>
    <ParagraphStyle Self="ParagraphStyle/Versiculo" Name="Versiculo" PointSize="10" FontStyle="Italic"/>
    <ParagraphStyle Self="ParagraphStyle/Creditos" Name="Creditos" PointSize="10"/>
    <ParagraphStyle Self="ParagraphStyle/Corpo" Name="Corpo" PointSize="10" Justification="FullyJustified" Hyphenation="true"/>
    <ParagraphStyle Self="ParagraphStyle/Oracao" Name="Oracao" PointSize="10" FontStyle="Italic" Justification="FullyJustified"/>
  </RootParagraphStyleGroup>
</idPkg:Styles>`;

/**
 * Monta o pacote.
 *
 * Uma página por spread, na ordem em que as páginas foram passadas.
 */
export async function montarIdml(paginas: PaginaDoLivro[]): Promise<Buffer> {
  const zip = new JSZip();

  // O mimetype precisa ser o primeiro arquivo e sem compressão — é assim que
  // o formato é reconhecido antes de descompactar o resto.
  zip.file('mimetype', 'application/vnd.adobe.indesign-idml-package', { compression: 'STORE' });

  const spreads: string[] = [];
  const stories: string[] = [];

  paginas.forEach((p, indice) => {
    const spreadId = `spread${indice}`;
    const quadros: string[] = [];

    blocosDaPagina(p).forEach((bloco, ordem) => {
      const storyId = `story${indice}_${ordem}`;
      stories.push(storyId);
      zip.file(
        `Stories/Story_${storyId}.xml`,
        story(
          storyId,
          bloco.paragrafos.map((texto) => ({ texto, estilo: bloco.estilo })),
        ),
      );
      quadros.push(quadro(`frame${indice}_${ordem}`, storyId, bloco.caixa, bloco.nome));
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
  zip.file(
    'Resources/Preferences.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Preferences xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0">
  <DocumentPreference PageWidth="${LARGURA}" PageHeight="${ALTURA}" FacingPages="false" PagesPerDocument="${paginas.length}"/>
  <ViewPreference HorizontalMeasurementUnits="Points" VerticalMeasurementUnits="Points"/>
</idPkg:Preferences>`,
  );

  zip.file(
    'designmap.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" DOMVersion="18.0" readerVersion="6.0" featureSet="257" product="18.0(50)"?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0" Self="doc">
  <idPkg:Preferences src="Resources/Preferences.xml"/>
  <idPkg:Styles src="Resources/Styles.xml"/>
  ${spreads.map((s) => `<idPkg:Spread src="Spreads/Spread_${s}.xml"/>`).join('\n  ')}
  ${stories.map((s) => `<idPkg:Story src="Stories/Story_${s}.xml"/>`).join('\n  ')}
</Document>`,
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
