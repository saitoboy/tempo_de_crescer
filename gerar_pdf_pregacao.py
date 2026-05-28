import json
import os
import sys
from glob import glob
import re

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

# ── Paleta de cores ──────────────────────────────────────────────────
AZUL_ESCURO = colors.HexColor('#1A237E')
AZUL_MEDIO  = colors.HexColor('#283593')
DOURADO     = colors.HexColor('#C9A84C')
CINZA_TEXTO = colors.HexColor('#333333')
BRANCO      = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm


# ── Cabeçalho e rodapé ───────────────────────────────────────────────
def cabecalho_rodape(canvas, doc):
    canvas.saveState()

    canvas.setFillColor(AZUL_ESCURO)
    canvas.rect(0, PAGE_H - 18 * mm, PAGE_W, 18 * mm, fill=1, stroke=0)

    canvas.setFillColor(BRANCO)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 11 * mm,
                             'IBPS MURIAÉ  ·  Igreja Batista Parque Safira')

    canvas.setStrokeColor(DOURADO)
    canvas.setLineWidth(2)
    canvas.line(MARGIN, PAGE_H - 19 * mm, PAGE_W - MARGIN, PAGE_H - 19 * mm)

    canvas.setStrokeColor(DOURADO)
    canvas.setLineWidth(1)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)

    canvas.setFillColor(AZUL_ESCURO)
    canvas.setFont('Helvetica', 7)
    canvas.drawString(MARGIN, 9 * mm, 'pregacoesibps.blogspot.com')
    canvas.drawRightString(PAGE_W - MARGIN, 9 * mm, f'Pág. {doc.page}')

    canvas.restoreState()


# ── Estilos ──────────────────────────────────────────────────────────
def estilos():
    return {
        'titulo':     ParagraphStyle('titulo',     fontName='Helvetica-Bold',        fontSize=22, textColor=AZUL_ESCURO, alignment=TA_CENTER, spaceAfter=4, leading=28),
        'referencia': ParagraphStyle('referencia', fontName='Helvetica-BoldOblique', fontSize=13, textColor=DOURADO,     alignment=TA_CENTER, spaceAfter=2),
        'meta':       ParagraphStyle('meta',       fontName='Helvetica',             fontSize=9,  textColor=colors.HexColor('#666666'), alignment=TA_CENTER, spaceAfter=2),
        'pastor':     ParagraphStyle('pastor',     fontName='Helvetica-Bold',        fontSize=10, textColor=AZUL_MEDIO,  alignment=TA_CENTER),
        'versiculo':  ParagraphStyle('versiculo',  fontName='Helvetica-BoldOblique', fontSize=10, textColor=AZUL_MEDIO,  spaceBefore=6, spaceAfter=2, leftIndent=8),
        'corpo':      ParagraphStyle('corpo',      fontName='Helvetica',             fontSize=10.5, textColor=CINZA_TEXTO, leading=16, alignment=TA_JUSTIFY, spaceAfter=5),
        'rodape_nome':ParagraphStyle('rodape_nome',fontName='Helvetica-Bold',        fontSize=11, textColor=AZUL_ESCURO, alignment=TA_CENTER, spaceBefore=6),
    }


def eh_referencia_biblica(linha):
    padroes = [
        r'^[A-ZÀ-Ú][a-zà-ú]+\s+\d+:\d+',
        r'^[1-3]\s+[A-ZÀ-Ú][a-zà-ú]+\s+\d+:\d+',
        r'^[A-ZÀ-Ú][a-zà-ú]+\s+\d+$',
    ]
    return any(re.match(p, linha.strip()) for p in padroes)


def extrair_titulo_e_ref(titulo_completo):
    match = re.search(r'[-–]\s*([A-ZÀ-Úa-zà-ú0-9\s:,;]+\d+:\d+[-\d,;]*)\s*$', titulo_completo)
    if match:
        ref = match.group(1).strip()
        tit = titulo_completo[:match.start()].strip().strip('-–').strip()
        return tit, ref
    return titulo_completo, ''


def extrair_pastor(conteudo):
    match = re.search(r'Pastor\s+([^\n]+)', conteudo)
    if match:
        return 'Pastor ' + match.group(1).strip()
    return ''


def montar_nome_arquivo(pregacao):
    """NomePastor - Titulo - DD-MM-YYYY.pdf  (máx 100 chars antes da extensão)"""
    conteudo = pregacao.get('conteudo_completo', '')
    pastor = extrair_pastor(conteudo)
    pastor_limpo = re.sub(r'[^\w\s]', '', pastor).strip().replace(' ', '_')

    # Usa o campo 'titulo' do JSON — NÃO o conteúdo
    titulo_json = pregacao.get('titulo', 'Pregacao')
    titulo_sem_ref, _ = extrair_titulo_e_ref(titulo_json)
    titulo_limpo = re.sub(r'[^\w\s]', '', titulo_sem_ref).strip().replace(' ', '_')
    titulo_limpo = titulo_limpo[:50]  # limita o título a 50 chars

    data = pregacao.get('data_pregacao', '').replace('/', '-') or 'sem-data'

    partes = [p for p in [pastor_limpo, titulo_limpo, data] if p]
    nome = ' - '.join(partes)
    nome = re.sub(r'[<>:"/\\|?*]', '', nome)
    return nome[:100] + '.pdf'


def processar_conteudo(conteudo, st):
    story = []
    linhas = conteudo.split('\n')
    bloco = []

    def flush_bloco():
        texto = ' '.join(bloco).strip()
        if texto:
            story.append(Paragraph(texto, st['corpo']))
        bloco.clear()

    # Pula cabeçalho até depois da data
    inicio = 0
    for i, linha in enumerate(linhas):
        if re.search(r'\d{1,2}/\d{1,2}/\d{4}', linha):
            inicio = i + 1
            break
    inicio = min(inicio + 2, len(linhas))

    for linha in linhas[inicio:]:
        linha = linha.strip()
        if not linha:
            flush_bloco()
            continue
        if eh_referencia_biblica(linha):
            flush_bloco()
            story.append(Spacer(1, 3 * mm))
            story.append(Paragraph(linha, st['versiculo']))
            story.append(HRFlowable(width='40%', thickness=0.5, color=DOURADO,
                                     spaceAfter=3, spaceBefore=1, hAlign='LEFT'))
            continue
        if linha.startswith('Pastor') or linha == 'IBPS':
            flush_bloco()
            continue
        bloco.append(linha)

    flush_bloco()
    return story


def gerar_pdf(pregacao, pasta_saida='.'):
    # Garante que a pasta existe antes de tentar salvar
    os.makedirs(pasta_saida, exist_ok=True)

    caminho_saida = os.path.join(pasta_saida, montar_nome_arquivo(pregacao))

    doc = SimpleDocTemplate(
        caminho_saida,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=26 * mm, bottomMargin=22 * mm,
        title=pregacao.get('titulo', 'Pregação'),
        author='IBPS Muriaé',
    )

    st = estilos()
    story = []

    titulo_completo = pregacao.get('titulo', 'Pregação')
    titulo, ref = extrair_titulo_e_ref(titulo_completo)
    conteudo = pregacao.get('conteudo_completo', '')
    pastor = extrair_pastor(conteudo)
    data = pregacao.get('data_pregacao', '')

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width='100%', thickness=2, color=DOURADO, spaceBefore=2, spaceAfter=6))
    story.append(Paragraph(titulo, st['titulo']))
    if ref:
        story.append(Paragraph(ref, st['referencia']))
    if data:
        story.append(Paragraph(data, st['meta']))
    if pastor:
        story.append(Paragraph(pastor, st['pastor']))
    story.append(HRFlowable(width='100%', thickness=2, color=DOURADO, spaceBefore=6, spaceAfter=10))

    story += processar_conteudo(conteudo, st)

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width='60%', thickness=1, color=DOURADO,
                             hAlign='CENTER', spaceBefore=4, spaceAfter=4))
    if pastor:
        story.append(Paragraph(pastor, st['rodape_nome']))
    story.append(Paragraph('IBPS Muriaé', st['meta']))

    doc.build(story, onFirstPage=cabecalho_rodape, onLaterPages=cabecalho_rodape)
    print(f'✅ {os.path.basename(caminho_saida)}')


# ── Menu ─────────────────────────────────────────────────────────────
def listar_jsons():
    arquivos = sorted(glob('pregacoes_*.json'))
    return [a for a in arquivos if 'completo' not in a]


def menu():
    print('\n' + '=' * 60)
    print('  📖  GERADOR DE PDF — PREGAÇÕES IBPS MURIAÉ')
    print('=' * 60)

    jsons = listar_jsons()
    if not jsons:
        print('❌ Nenhum arquivo pregacoes_XXXX.json encontrado na pasta.')
        sys.exit(1)

    print('\nArquivos disponíveis:')
    for i, arq in enumerate(jsons, 1):
        print(f'  {i}. {arq}')

    print('\nEscolha o arquivo (número): ', end='')
    try:
        idx = int(input().strip()) - 1
        arq = jsons[idx]
    except (ValueError, IndexError):
        print('❌ Opção inválida.')
        sys.exit(1)

    with open(arq, encoding='utf-8') as f:
        dados = json.load(f)

    pregacoes = dados.get('pregacoes', [])
    print(f'\n{len(pregacoes)} pregações encontradas em {arq}')
    print('\nOpções:')
    print('  A. Gerar PDF de UMA pregação específica')
    print('  B. Gerar PDF de TODAS as pregações (uma por arquivo)')
    print('\nEscolha (A/B): ', end='')
    opcao = input().strip().upper()

    if opcao == 'B':
        for p in pregacoes:
            gerar_pdf(p, pasta_saida='pdfs_pregacoes')
        print(f'\n🎉 {len(pregacoes)} PDFs gerados na pasta pdfs_pregacoes/')

    else:
        print('\nPregações disponíveis:')
        for p in pregacoes:
            print(f'  [{p["id"]:>3}] {p.get("data_pregacao","??/??/????")}'
                  f'  —  {p.get("titulo","(sem título)")}')

        print('\nDigite o ID da pregação: ', end='')
        try:
            pid = int(input().strip())
            pregacao = next(p for p in pregacoes if p['id'] == pid)
        except (ValueError, StopIteration):
            print('❌ ID não encontrado.')
            sys.exit(1)

        gerar_pdf(pregacao, pasta_saida='.')
        print('🎉 Arquivo salvo!')


if __name__ == '__main__':
    menu()
