#!/usr/bin/env python3
"""
📊 Dashboard IBPS - Análise Teológica de Pregações
Igreja Batista do Parque Safira
"""

import streamlit as st
import json
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from pathlib import Path
from datetime import datetime

# ========== CONFIG ==========
st.set_page_config(
    page_title="Dashboard IBPS",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ========== CSS MÍNIMO ==========
st.markdown("""
<style>
    .info-box {
        background: #f0f2f6;
        padding: 1rem;
        border-radius: 5px;
        border-left: 4px solid #1f77b4;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

# ========== FUNÇÃO PARA LIMPAR NOMES DE DOUTRINAS ==========
def limpar_nome_doutrina(nome):
    """Remove 'Doutrina de/da/do/das' e artigos soltos"""
    if not isinstance(nome, str):
        return nome
    
    # Remove variações de "Doutrina"
    nome = nome.replace('Doutrina de ', '')
    nome = nome.replace('Doutrina da ', '')
    nome = nome.replace('Doutrina do ', '')
    nome = nome.replace('Doutrina das ', '')
    nome = nome.replace('Doutrina d', '')
    
    # Remove artigos soltos no início (a, o, as, os, e)
    nome = nome.strip()
    if nome.startswith('a '):
        nome = nome[2:]
    elif nome.startswith('o '):
        nome = nome[2:]
    elif nome.startswith('as '):
        nome = nome[3:]
    elif nome.startswith('os '):
        nome = nome[3:]
    elif nome.startswith('e '):
        nome = nome[2:]
    
    return nome.strip()

# ========== CARREGA DADOS ==========
@st.cache_data
def carregar_dados():
    base_path = Path(__file__).parent.parent.parent / 'output'
    
    with open(base_path / 'pregacoes_classificadas_v31.json', 'r', encoding='utf-8') as f:
        classificadas = json.load(f)
    
    with open(base_path / 'relatorio_cobertura_biblica.json', 'r', encoding='utf-8') as f:
        cobertura_biblica = json.load(f)
    
    return {
        'pregacoes': classificadas['pregacoes'],
        'biblica': cobertura_biblica
    }

@st.cache_data
def criar_dataframe(pregacoes_raw):
    import re
    dados = []
    
    for p in pregacoes_raw:
        classif = p.get('classificacao_tematica', {})
        tema_principal = classif.get('tema_principal', {})
        subtemas = classif.get('subtemas_detalhados', [])
        
        ano_arquivo = p.get('ano', None)
        data_str = p.get('data_pregacao', '')
        
        try:
            if data_str:
                dia, mes, ano = data_str.split('/')[:3]
                data_obj = datetime(int(ano), int(mes), int(dia))
            elif ano_arquivo:
                data_obj = datetime(int(ano_arquivo), 1, 1)
                data_str = f"01/01/{ano_arquivo}"
            else:
                continue
        except:
            if ano_arquivo:
                data_obj = datetime(int(ano_arquivo), 1, 1)
                data_str = f"01/01/{ano_arquivo}"
            else:
                continue
        
        # Extrai livro do título se necessário
        livro_biblico = p.get('livro_biblico', 'Não identificado')
        titulo = p.get('titulo', 'Sem título')
        
        if livro_biblico == 'Não identificado' or not livro_biblico:
            match = re.match(r'^([0-9]?\s?[A-Za-zÀ-ú]+)', titulo)
            if match:
                livro_possivel = match.group(1).strip()
                livros_conhecidos = ['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio',
                                   'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel', '1 Reis',
                                   '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias',
                                   'Ester', 'Jó', 'Salmos', 'Provérbios', 'Eclesiastes',
                                   'Cantares', 'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel',
                                   'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas',
                                   'Miquéias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu',
                                   'Zacarias', 'Malaquias', 'Mateus', 'Marcos', 'Lucas', 'João',
                                   'Atos', 'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas',
                                   'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses',
                                   '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito',
                                   'Filemom', 'Hebreus', 'Tiago', '1 Pedro', '2 Pedro',
                                   '1 João', '2 João', '3 João', 'Judas', 'Apocalipse']
                
                for livro_canon in livros_conhecidos:
                    if livro_canon.lower() in livro_possivel.lower():
                        livro_biblico = livro_canon
                        break
        
        dados.append({
            'titulo': titulo,
            'data': data_str,
            'data_obj': data_obj,
            'ano': data_obj.year,
            'pregador': p.get('pregador', 'Desconhecido'),
            'livro_biblico': livro_biblico,
            'tema': tema_principal.get('nome', 'Não classificado'),
            'confianca': tema_principal.get('confianca_normalizada', 0),
            'subtemas': ', '.join([s.get('nome', '') for s in subtemas]) if subtemas else 'Nenhum'
        })
    
    return pd.DataFrame(dados)

dados = carregar_dados()
df = criar_dataframe(dados['pregacoes'])

# ========== SIDEBAR - FILTROS ==========
with st.sidebar:
    st.title("🎛️ Filtros")
    
    # SLIDER DE ANO (INTERVALO)
    st.markdown("**📅 Período (Anos)**")
    anos_disponiveis = sorted(df['ano'].unique())
    ano_min = int(min(anos_disponiveis))
    ano_max = int(max(anos_disponiveis))
    
    ano_range = st.slider(
        "Selecione o intervalo de anos",
        min_value=ano_min,
        max_value=ano_max,
        value=(ano_min, ano_max),
        step=1,
        label_visibility="collapsed"
    )
    
    st.caption(f"📊 Selecionado: {ano_range[0]} - {ano_range[1]}")
    
    st.markdown("**🎤 Pregador**")
    pregadores_validos = [p for p in df['pregador'].unique() if p is not None]
    pregadores_disponiveis = ["Todos"] + sorted(pregadores_validos)
    pregador_sel = st.selectbox("Selecione o pregador", pregadores_disponiveis, label_visibility="collapsed")
    
    st.markdown("**🎯 Tema**")
    temas_validos = [t for t in df['tema'].unique() if t is not None]
    temas_disponiveis = ["Todos"] + sorted(temas_validos)
    tema_sel = st.selectbox("Selecione o tema", temas_disponiveis, label_visibility="collapsed")
    
    st.markdown("**📖 Livro Bíblico**")
    livros_validos = [l for l in df['livro_biblico'].unique() if l is not None]
    livros_disponiveis = ["Todos"] + sorted(livros_validos)
    livro_sel = st.selectbox("Selecione o livro", livros_disponiveis, label_visibility="collapsed")
    
    st.markdown("---")
    
    if st.button("🔄 Resetar Filtros", width='stretch'):
        st.rerun()
    
    st.markdown("---")
    st.markdown("**🔬 Metodologia**")
    st.info("""
    - **Modelo:** Híbrido v3.1
    - **Técnicas:** TF-IDF + Heurístico
    - **Base:** Wayne Grudem
    - **Framework:** CRISP-DM
    """)
    
    # 🆕 EXPLICAÇÃO DOS CONCEITOS
    with st.expander("💡 O que é TF-IDF?"):
        st.markdown("""
        **TF-IDF (Term Frequency - Inverse Document Frequency)**
        
        É uma técnica de **Processamento de Linguagem Natural (NLP)** que identifica quais palavras são mais importantes em um texto.
        
        **Como funciona:**
        - **TF (Frequência do Termo):** Conta quantas vezes uma palavra aparece no texto
        - **IDF (Frequência Inversa nos Documentos):** Verifica se a palavra é rara ou comum em todos os textos
        
        **Exemplo prático:**
        - Palavra "salvação" aparece 15x em uma pregação → **TF alto**
        - Palavra "salvação" aparece em apenas 20% das pregações → **IDF alto**
        - **Resultado:** "salvação" é uma palavra-chave importante para essa pregação
        
        📊 **No nosso sistema:** O TF-IDF calcula a relevância de termos teológicos (ex: "justificação", "santificação", "redenção") para classificar cada pregação em uma das 8 doutrinas.
        """)
    
    with st.expander("💡 O que é Heurístico?"):
        st.markdown("""
        **Heurístico (Regras baseadas em conhecimento especializado)**
        
        São **regras lógicas criadas manualmente** por especialistas para melhorar a classificação automática.
        
        **Como funciona:**
        - Usa palavras-chave específicas de cada doutrina
        - Aplica pesos e prioridades baseadas em contexto
        - Complementa o TF-IDF com conhecimento teológico
        
        **Exemplo prático:**
        - Se a pregação tem "cruz", "sacrifício", "propiciação" → **Aumenta score de "Doutrina de Cristo"**
        - Se tem "batismo", "ceia", "membresia" → **Aumenta score de "Doutrina da Igreja"**
        
        📊 **No nosso sistema:** O método heurístico usa um dicionário com 200+ termos teológicos específicos de cada doutrina (baseado em Wayne Grudem) para refinar a classificação do TF-IDF.
        
        **Por que híbrido?**
        - **TF-IDF:** Identifica padrões automaticamente
        - **Heurístico:** Adiciona conhecimento teológico especializado
        - **Resultado:** Classificação mais precisa e contextualizada
        """)
    
    with st.expander("💡 O que é CRISP-DM?"):
        st.markdown("""
        **CRISP-DM (Cross-Industry Standard Process for Data Mining)**
        
        É uma **metodologia internacional** para projetos de análise de dados e ciência de dados.
        
        **6 Fases do CRISP-DM:**
        1. **Entendimento do Negócio:** Definir objetivos (classificar pregações)
        2. **Entendimento dos Dados:** Analisar 956 pregações coletadas
        3. **Preparação dos Dados:** Limpar e normalizar textos
        4. **Modelagem:** Criar modelo TF-IDF + Heurístico
        5. **Avaliação:** Testar precisão da classificação
        6. **Implantação:** Dashboard e relatórios
        
        📊 **No nosso projeto:** Seguimos todas as etapas para garantir qualidade científica e reprodutibilidade.
        """)

# ========== APLICA FILTROS ==========
df_filtrado = df.copy()

df_filtrado = df_filtrado[(df_filtrado['ano'] >= ano_range[0]) & (df_filtrado['ano'] <= ano_range[1])]

if pregador_sel != "Todos":
    df_filtrado = df_filtrado[df_filtrado['pregador'] == pregador_sel]

if tema_sel != "Todos":
    df_filtrado = df_filtrado[df_filtrado['tema'] == tema_sel]

if livro_sel != "Todos":
    df_filtrado = df_filtrado[df_filtrado['livro_biblico'] == livro_sel]

# ========== HEADER ==========
st.title("📊 Dashboard de Análise Teológica")
st.markdown("**Igreja Batista do Parque Safira (IBPS)** • Sistema de BI para Análise de Pregações (2012-2026)")

with st.expander("ℹ️ Sobre este Dashboard"):
    st.markdown("""
    Este dashboard analisa **956 pregações** através de técnicas de **NLP (Processamento de Linguagem Natural)** e 
    **Teologia Sistemática** (Wayne Grudem), classificando em **8 doutrinas fundamentais** 
    usando o **modelo Híbrido v3.1** (TF-IDF + Heurístico).
    
    **Base Teórica:** Teologia Sistemática de Wayne Grudem (2018)
    
    **8 Doutrinas Classificadas:**
    1. Palavra de Deus
    2. Deus
    3. Cristo
    4. Espírito Santo
    5. Salvação
    6. Igreja
    7. Homem
    8. Últimas Coisas (Escatologia)
    
    **Metodologia:** CRISP-DM (metodologia internacional de ciência de dados)
    """)

st.markdown("---")

# ========== KPIs ==========
st.subheader("📈 Indicadores Principais (KPIs)")

col1, col2, col3, col4 = st.columns(4)

with col1:
    total_filtrado = len(df_filtrado)
    total_geral = len(df)
    percentual_filtro = (total_filtrado / total_geral * 100) if total_geral > 0 else 0
    
    st.metric(
        "📚 Pregações Analisadas",
        total_filtrado,
        f"{percentual_filtro:.1f}% do total ({total_geral})"
    )

with col2:
    if not df_filtrado.empty:
        tema_mais_comum = df_filtrado['tema'].value_counts().head(1)
        if len(tema_mais_comum) > 0:
            tema_nome = limpar_nome_doutrina(tema_mais_comum.index[0])
            tema_qtd = tema_mais_comum.values[0]
            st.metric("🎯 Tema Predominante", tema_nome, f"{tema_qtd}x")
        else:
            st.metric("🎯 Tema Predominante", "N/A")
    else:
        st.metric("🎯 Tema Predominante", "N/A")

with col3:
    pregadores_unicos = df_filtrado['pregador'].nunique() if not df_filtrado.empty else 0
    st.metric("🎤 Pregadores Ativos", pregadores_unicos)

with col4:
    if not df_filtrado.empty:
        df_livros_validos = df_filtrado[
            (df_filtrado['livro_biblico'] != 'Não identificado') & 
            (df_filtrado['livro_biblico'].notna())
        ]
        livros_pregados_filtrados = df_livros_validos['livro_biblico'].nunique()
        total_livros = 66
        percentual = (livros_pregados_filtrados / total_livros) * 100
        
        st.metric(
            "📖 Cobertura Bíblica",
            f"{livros_pregados_filtrados} de {total_livros}",
            f"{percentual:.1f}%"
        )
    else:
        st.metric("📖 Cobertura Bíblica", "0 de 66")

st.markdown("---")

# ========== DISTRIBUIÇÃO TEMÁTICA ==========
st.header("📊 Distribuição Temática")

col_left, col_right = st.columns(2)

with col_left:
    if not df_filtrado.empty:
        distribuicao_temas = df_filtrado['tema'].value_counts()
        nomes_simplificados = [limpar_nome_doutrina(nome) for nome in distribuicao_temas.index]
        
        fig_pizza = px.pie(
            values=distribuicao_temas.values,
            names=nomes_simplificados,
            title="Distribuição por Tema Teológico",
            hole=0.4
        )
        
        fig_pizza.update_traces(
            textposition='inside', 
            textinfo='percent+label'
        )
        fig_pizza.update_layout(height=500)
        
        st.plotly_chart(fig_pizza, width='stretch')
    else:
        st.info("Nenhum dado disponível")

with col_right:
    if not df_filtrado.empty:
        top5_temas = df_filtrado['tema'].value_counts().head(5)
        nomes_simplificados = [limpar_nome_doutrina(nome) for nome in top5_temas.index]
        
        fig_barras = px.bar(
            x=top5_temas.values,
            y=nomes_simplificados,
            orientation='h',
            title="Top 5 Temas Pregados (Ranking)",
            labels={'x': 'Quantidade', 'y': 'Tema'},
            text=top5_temas.values
        )
        
        fig_barras.update_traces(textposition='outside')
        fig_barras.update_layout(height=500, showlegend=False)
        
        st.plotly_chart(fig_barras, width='stretch')
    else:
        st.info("Nenhum dado disponível")

# Explicação da Confiança
if not df_filtrado.empty:
    st.markdown("### 📊 Confiança Estatística")
    
    st.info("""
    **O que é Confiança?** É a probabilidade percentual de que a classificação temática esteja correta, 
    calculada pelo modelo TF-IDF. Quanto maior a confiança, mais segura é a classificação.
    
    - **Alta (≥20%)**: Tema claramente identificado
    - **Média (10-20%)**: Tema provável
    - **Baixa (<10%)**: Tema incerto ou pregação multitemática
    """)
    
    col_conf1, col_conf2, col_conf3 = st.columns(3)
    
    with col_conf1:
        confianca_media = df_filtrado['confianca'].mean()
        st.metric("Confiança Média", f"{confianca_media:.1f}%")
    
    with col_conf2:
        alta_confianca = len(df_filtrado[df_filtrado['confianca'] >= 20])
        st.metric("Alta Confiança (≥20%)", f"{alta_confianca} pregações")
    
    with col_conf3:
        baixa_confianca = len(df_filtrado[df_filtrado['confianca'] < 10])
        st.metric("Baixa Confiança (<10%)", f"{baixa_confianca} pregações")

st.markdown("---")

# ========== EVOLUÇÃO TEMPORAL ==========
st.header("📈 Evolução Temporal")

if not df_filtrado.empty:
    evolucao = df_filtrado.groupby(['ano', 'tema']).size().reset_index(name='quantidade')
    evolucao['tema'] = evolucao['tema'].apply(limpar_nome_doutrina)
    
    fig_linha = px.line(
        evolucao,
        x='ano',
        y='quantidade',
        color='tema',
        markers=True,
        title="Evolução de Todos os Temas ao Longo dos Anos",
        labels={'ano': 'Ano', 'quantidade': 'Pregações', 'tema': 'Tema'}
    )
    
    fig_linha.update_traces(mode='lines+markers', line=dict(width=2), marker=dict(size=6))
    fig_linha.update_layout(height=600, hovermode='x unified')
    
    st.plotly_chart(fig_linha, width='stretch')
    
    # Resumo Anual
    st.markdown("### 📅 Resumo Anual")
    
    resumo_anual = df_filtrado.groupby('ano').agg({
        'titulo': 'count',
        'pregador': 'nunique'
    }).reset_index()
    
    livros_por_ano = []
    for ano in df_filtrado['ano'].unique():
        df_ano = df_filtrado[df_filtrado['ano'] == ano]
        df_ano_valido = df_ano[
            (df_ano['livro_biblico'] != 'Não identificado') & 
            (df_ano['livro_biblico'].notna())
        ]
        livros_por_ano.append({
            'ano': ano,
            'livros_validos': df_ano_valido['livro_biblico'].nunique()
        })
    
    df_livros = pd.DataFrame(livros_por_ano)
    resumo_anual = resumo_anual.merge(df_livros, on='ano', how='left')
    
    conf_por_ano = df_filtrado.groupby('ano')['confianca'].mean().reset_index()
    resumo_anual = resumo_anual.merge(conf_por_ano, on='ano', how='left')
    
    resumo_anual.columns = ['Ano', 'Total de Pregações', 'Pregadores', 'Livros Pregados', 'Confiança Média (%)']
    resumo_anual['Confiança Média (%)'] = resumo_anual['Confiança Média (%)'].round(1)
    
    st.dataframe(resumo_anual, width='stretch', hide_index=True)
    
else:
    st.info("Nenhum dado disponível")

st.markdown("---")

# ========== PREGADORES ==========
st.header("🎤 Análise de Pregadores")

col_preg1, col_preg2 = st.columns(2)

with col_preg1:
    if not df_filtrado.empty:
        top_pregadores = df_filtrado['pregador'].value_counts().head(10)
        
        fig_pregadores = px.bar(
            x=top_pregadores.values,
            y=top_pregadores.index,
            orientation='h',
            title="Top 10 Pregadores Mais Ativos",
            labels={'x': 'Pregações', 'y': 'Pregador'},
            text=top_pregadores.values
        )
        
        fig_pregadores.update_traces(textposition='outside')
        fig_pregadores.update_layout(height=500, showlegend=False)
        
        st.plotly_chart(fig_pregadores, width='stretch')
    else:
        st.info("Nenhum dado disponível")

with col_preg2:
    if not df_filtrado.empty and len(df_filtrado) > 5:
        top5_preg = df_filtrado['pregador'].value_counts().head(5).index
        top5_tem = df_filtrado['tema'].value_counts().head(5).index
        
        df_heatmap = df_filtrado[
            (df_filtrado['pregador'].isin(top5_preg)) &
            (df_filtrado['tema'].isin(top5_tem))
        ]
        
        if not df_heatmap.empty:
            pivot = df_heatmap.groupby(['pregador', 'tema']).size().unstack(fill_value=0)
            pivot.columns = [limpar_nome_doutrina(col) for col in pivot.columns]
            
            fig_heat = px.imshow(
                pivot,
                labels=dict(x="Tema", y="Pregador", color="Quantidade"),
                title="Especialização Temática (Top 5)",
                aspect='auto',
                color_continuous_scale='Blues'
            )
            
            fig_heat.update_layout(height=500)
            st.plotly_chart(fig_heat, width='stretch')
        else:
            st.info("Dados insuficientes")
    else:
        st.info("Dados insuficientes")

st.markdown("---")

# ========== COBERTURA BÍBLICA ==========
st.header("📖 Cobertura Bíblica")

col_bib1, col_bib2 = st.columns([2, 1])

with col_bib1:
    if not df_filtrado.empty:
        df_livros_validos = df_filtrado[
            (df_filtrado['livro_biblico'] != 'Não identificado') & 
            (df_filtrado['livro_biblico'].notna())
        ]
        
        if not df_livros_validos.empty:
            top_livros = df_livros_validos['livro_biblico'].value_counts().head(20)
            
            fig_livros = px.bar(
                x=top_livros.index,
                y=top_livros.values,
                title="Top 20 Livros Mais Pregados",
                labels={'x': 'Livro', 'y': 'Pregações'},
                text=top_livros.values
            )
            
            fig_livros.update_traces(textposition='outside')
            fig_livros.update_layout(xaxis_tickangle=-45, height=500)
            st.plotly_chart(fig_livros, width='stretch')
        else:
            st.warning("⚠️ Nenhum livro identificado nos filtros")
    else:
        st.info("Nenhum dado disponível")

with col_bib2:
    st.subheader("📊 Estatísticas")
    
    if not df_filtrado.empty:
        df_livros_validos = df_filtrado[
            (df_filtrado['livro_biblico'] != 'Não identificado') & 
            (df_filtrado['livro_biblico'].notna())
        ]
        
        livros_pregados_filtrados = df_livros_validos['livro_biblico'].nunique()
        total_livros_biblia = 66
        percentual_cobertura = (livros_pregados_filtrados / total_livros_biblia) * 100
        
        st.metric(
            "✅ Livros Pregados",
            f"{livros_pregados_filtrados} de {total_livros_biblia}",
            f"{percentual_cobertura:.1f}%"
        )
        
        st.metric("❌ Livros Não Pregados", total_livros_biblia - livros_pregados_filtrados)
        
        sem_livro = len(df_filtrado) - len(df_livros_validos)
        percentual_sem = (sem_livro/len(df_filtrado)*100) if len(df_filtrado) > 0 else 0
        
        st.metric("⚠️ Sem Livro Identificado", f"{sem_livro} pregações", f"{percentual_sem:.1f}%")
    else:
        st.info("Nenhum dado disponível")
    
    with st.expander("📋 Livros Não Pregados"):
        cobertura_geral = dados['biblica']
        nao_pregados = cobertura_geral.get('livros_nao_pregados', [])
        if nao_pregados:
            livros_faltantes = [l['livro'] for l in nao_pregados]
            st.write(", ".join(livros_faltantes))
        else:
            st.success("✅ Todos os 66 livros foram pregados!")

# VT vs NT
if not df_filtrado.empty:
    st.markdown("### 📚 Velho vs Novo Testamento")
    
    col_vt, col_nt = st.columns(2)
    
    livros_nt = ['Mateus', 'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', 'Gálatas', 
                 'Efésios', 'Filipenses', 'Colossenses', 'Hebreus', 'Tiago', 
                 'Apocalipse', '1 Coríntios', '2 Coríntios', '1 Tessalonicenses',
                 '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom',
                 '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas']
    
    df_com_livro = df_filtrado[
        (df_filtrado['livro_biblico'] != 'Não identificado') & 
        (df_filtrado['livro_biblico'].notna())
    ]
    
    if not df_com_livro.empty:
        vt_count = len(df_com_livro[~df_com_livro['livro_biblico'].isin(livros_nt)])
        nt_count = len(df_com_livro[df_com_livro['livro_biblico'].isin(livros_nt)])
        
        with col_vt:
            st.metric("📜 Velho Testamento", f"{vt_count} pregações")
        
        with col_nt:
            st.metric("📖 Novo Testamento", f"{nt_count} pregações")

st.markdown("---")

# ========== TABELA DE PREGAÇÕES ==========
st.header("📋 Dataset Completo")

if not df_filtrado.empty:
    df_exibicao = df_filtrado[['titulo', 'data', 'pregador', 'tema', 'livro_biblico', 'confianca']].copy()
    df_exibicao = df_exibicao.sort_values('data', ascending=False)
    df_exibicao['confianca'] = df_exibicao['confianca'].round(1)
    df_exibicao['tema'] = df_exibicao['tema'].apply(limpar_nome_doutrina)
    
    df_exibicao.columns = ['Título', 'Data', 'Pregador', 'Tema', 'Livro Bíblico', 'Confiança (%)']
    
    st.dataframe(df_exibicao, width='stretch', hide_index=True, height=400)
    
    csv = df_exibicao.to_csv(index=False, encoding='utf-8-sig')
    st.download_button(
        "📥 Baixar CSV",
        csv,
        f"pregacoes_ibps_{datetime.now().strftime('%Y%m%d')}.csv",
        "text/csv"
    )
else:
    st.info("Nenhuma pregação encontrada")

st.markdown("---")

# ========== FOOTER ==========
st.markdown("""
### 🔬 Ficha Técnica

**Metodologia:** Híbrido v3.1 (TF-IDF + Heurístico) | **Base Teórica:** Teologia Sistemática (Wayne Grudem) | **Framework:** CRISP-DM

**Dataset:** 956 pregações (2012-2026) | 55 pregadores | 44 de 66 livros bíblicos

---

Desenvolvido por **Guilherme Saito** • Coordenador de Inovação | © 2026 IBPS
""")
