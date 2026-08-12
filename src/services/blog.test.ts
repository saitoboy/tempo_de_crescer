import { describe, expect, it } from 'vitest';
import { extrairCorpo, extrairPublicadoEm, extrairTitulo, htmlParaTexto } from './blog';

describe('htmlParaTexto', () => {
  it('não parte palavras cortadas por tag no meio', () => {
    // O caso real do blog: <span> no meio de "Resenha" virava "R esenha"
    expect(htmlParaTexto('<b>R</b><span>esenha</span> do Culto')).toBe('Resenha do Culto');
    expect(htmlParaTexto('Rese<span></span>nha')).toBe('Resenha');
  });

  it('não parte datas cortadas por tag', () => {
    expect(htmlParaTexto('<span>1</span><span>9/10/2025</span>')).toBe('19/10/2025');
  });

  it('transforma blocos em quebra de linha', () => {
    expect(htmlParaTexto('<p>Primeira</p><p>Segunda</p>')).toBe('Primeira\nSegunda');
    expect(htmlParaTexto('um<br>dois')).toBe('um\ndois');
  });

  it('resolve as entidades HTML do blog', () => {
    expect(htmlParaTexto('a&nbsp;b')).toBe('a b');
    expect(htmlParaTexto('&quot;Tema&quot;')).toBe('"Tema"');
    expect(htmlParaTexto('Cristo &amp; a Igreja')).toBe('Cristo & a Igreja');
  });

  it('descarta linhas vazias e espaço sobrando', () => {
    expect(htmlParaTexto('<p>  a  </p><p></p><p> b </p>')).toBe('a\nb');
  });

  it('remove script e style junto com o conteúdo deles', () => {
    expect(htmlParaTexto('<style>.x{color:red}</style>texto')).toBe('texto');
    expect(htmlParaTexto('<script>var a=1</script>texto')).toBe('texto');
  });
});

describe('extrairCorpo', () => {
  const pagina = `<html><body>
    <div class='post-body entry-content' id='post-body-123'>
      <p>Resenha do Culto de 28/12/2016</p>
    </div>
    <div class='post-footer'>rodapé que não entra</div>
  </body></html>`;

  it('recorta o post-body e para no post-footer', () => {
    const corpo = extrairCorpo(pagina)!;
    expect(htmlParaTexto(corpo)).toContain('Resenha do Culto de 28/12/2016');
    expect(corpo).not.toContain('rodapé que não entra');
  });

  it('devolve undefined quando não há post-body', () => {
    expect(extrairCorpo('<html><body>nada</body></html>')).toBeUndefined();
  });
});

describe('extrairPublicadoEm', () => {
  it('lê a data do abbr, que usa aspas simples no template do Blogger', () => {
    const html = `<abbr class='published' itemprop='datePublished' title='2016-12-28T17:37:00-08:00'>dezembro 28, 2016</abbr>`;
    expect(extrairPublicadoEm(html)).toBe('2016-12-28');
  });

  it('não converte fuso: o dia exibido pelo blog é o que vale', () => {
    // 17:37 em -08:00 vira o dia seguinte em UTC; a data tem de continuar 28
    const html = `<abbr class='published' title='2016-12-28T17:37:00-08:00'>x</abbr>`;
    expect(extrairPublicadoEm(html)).toBe('2016-12-28');
  });

  it('devolve undefined quando o marcador não existe', () => {
    expect(extrairPublicadoEm('<html></html>')).toBeUndefined();
  });
});

describe('extrairTitulo', () => {
  it('lê o og:title', () => {
    const html = `<meta content='Desafios para o novo ano - Lucas 2:41-52' property='og:title'/>`;
    expect(extrairTitulo(html)).toBe('Desafios para o novo ano - Lucas 2:41-52');
  });
});
