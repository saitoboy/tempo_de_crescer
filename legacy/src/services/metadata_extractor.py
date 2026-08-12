#!/usr/bin/env python3
"""
📖 METADATA_EXTRACTOR.PY - Extrator de Metadados Bíblicos
Extrai referências bíblicas (livros, capítulos, versículos) das pregações
"""

import re
from typing import Dict, List, Optional, Tuple
from collections import Counter


class MetadadosBiblicosExtractor:
    """Extrator de metadados bíblicos das pregações"""
    
    def __init__(self):
        """Inicializa o extrator com lista de livros bíblicos"""
        
        # Lista completa de livros da Bíblia (PT-BR)
        self.livros_biblia = {
            # Antigo Testamento
            'genesis': ['Gênesis', 'Genesis', 'Gn', 'Ge'],
            'exodo': ['Êxodo', 'Exodo', 'Ex', 'Éx'],
            'levitico': ['Levítico', 'Levitico', 'Lv'],
            'numeros': ['Números', 'Numeros', 'Nm', 'Nu'],
            'deuteronomio': ['Deuteronômio', 'Deuteronomio', 'Dt'],
            'josue': ['Josué', 'Josue', 'Js'],
            'juizes': ['Juízes', 'Juizes', 'Jz', 'Jui'],
            'rute': ['Rute', 'Rt', 'Ru'],
            'samuel1': ['1 Samuel', 'I Samuel', '1Samuel', '1Sm', '1 Sm'],
            'samuel2': ['2 Samuel', 'II Samuel', '2Samuel', '2Sm', '2 Sm'],
            'reis1': ['1 Reis', 'I Reis', '1Reis', '1Rs', '1 Rs'],
            'reis2': ['2 Reis', 'II Reis', '2Reis', '2Rs', '2 Rs'],
            'cronicas1': ['1 Crônicas', '1 Cronicas', 'I Crônicas', '1Cr', '1 Cr'],
            'cronicas2': ['2 Crônicas', '2 Cronicas', 'II Crônicas', '2Cr', '2 Cr'],
            'esdras': ['Esdras', 'Ed', 'Esd'],
            'neemias': ['Neemias', 'Ne', 'Nee'],
            'ester': ['Ester', 'Et', 'Est'],
            'jo': ['Jó', 'Jo', 'Job'],
            'salmos': ['Salmos', 'Salmo', 'Sl', 'Sal', 'Ps'],
            'proverbios': ['Provérbios', 'Proverbios', 'Pv', 'Pro'],
            'eclesiastes': ['Eclesiastes', 'Ec', 'Ecl'],
            'cantares': ['Cântico dos Cânticos', 'Cantares', 'Ct', 'Cant'],
            'isaias': ['Isaías', 'Isaias', 'Is'],
            'jeremias': ['Jeremias', 'Jr', 'Jer'],
            'lamentacoes': ['Lamentações', 'Lamentacoes', 'Lm', 'Lam'],
            'ezequiel': ['Ezequiel', 'Ez', 'Eze'],
            'daniel': ['Daniel', 'Dn', 'Dan'],
            'oseias': ['Oséias', 'Oseias', 'Os'],
            'joel': ['Joel', 'Jl'],
            'amos': ['Amós', 'Amos', 'Am'],
            'obadias': ['Obadias', 'Ob', 'Abd'],
            'jonas': ['Jonas', 'Jn', 'Jon'],
            'miqueias': ['Miquéias', 'Miqueias', 'Mq', 'Miq'],
            'naum': ['Naum', 'Na'],
            'habacuque': ['Habacuque', 'Hc', 'Hab'],
            'sofonias': ['Sofonias', 'Sf', 'Sof'],
            'ageu': ['Ageu', 'Ag'],
            'zacarias': ['Zacarias', 'Zc', 'Zac'],
            'malaquias': ['Malaquias', 'Ml', 'Mal'],
            
            # Novo Testamento
            'mateus': ['Mateus', 'Mt', 'Mat'],
            'marcos': ['Marcos', 'Mc', 'Mar'],
            'lucas': ['Lucas', 'Lc', 'Luc'],
            'joao': ['João', 'Joao', 'Jo', 'Jn'],
            'atos': ['Atos', 'At', 'Act'],
            'romanos': ['Romanos', 'Rm', 'Rom'],
            'corintios1': ['1 Coríntios', '1 Corintios', 'I Coríntios', '1Co', '1 Co'],
            'corintios2': ['2 Coríntios', '2 Corintios', 'II Coríntios', '2Co', '2 Co'],
            'galatas': ['Gálatas', 'Galatas', 'Gl', 'Gal'],
            'efesios': ['Efésios', 'Efesios', 'Ef'],
            'filipenses': ['Filipenses', 'Fp', 'Fil'],
            'colossenses': ['Colossenses', 'Cl', 'Col'],
            'tessalonicenses1': ['1 Tessalonicenses', 'I Tessalonicenses', '1Ts', '1 Ts'],
            'tessalonicenses2': ['2 Tessalonicenses', 'II Tessalonicenses', '2Ts', '2 Ts'],
            'timoteo1': ['1 Timóteo', '1 Timoteo', 'I Timóteo', '1Tm', '1 Tm'],
            'timoteo2': ['2 Timóteo', '2 Timoteo', 'II Timóteo', '2Tm', '2 Tm'],
            'tito': ['Tito', 'Tt'],
            'filemom': ['Filemom', 'Fm', 'File'],
            'hebreus': ['Hebreus', 'Hb', 'Heb'],
            'tiago': ['Tiago', 'Tg'],
            'pedro1': ['1 Pedro', 'I Pedro', '1Pedro', '1Pe', '1 Pe'],
            'pedro2': ['2 Pedro', 'II Pedro', '2Pedro', '2Pe', '2 Pe'],
            'joao1': ['1 João', '1 Joao', 'I João', '1Jo', '1 Jo'],
            'joao2': ['2 João', '2 Joao', 'II João', '2Jo', '2 Jo'],
            'joao3': ['3 João', '3 Joao', 'III João', '3Jo', '3 Jo'],
            'judas': ['Judas', 'Jd'],
            'apocalipse': ['Apocalipse', 'Ap', 'Apo', 'Rev']
        }
        
        # Mapa reverso (de variação para nome canônico)
        self.mapa_reverso = {}
        for nome_canonico, variacoes in self.livros_biblia.items():
            for variacao in variacoes:
                self.mapa_reverso[variacao.lower()] = nome_canonico
        
        # Nome formal de cada livro
        self.nomes_formais = {
            'genesis': 'Gênesis', 'exodo': 'Êxodo', 'levitico': 'Levítico',
            'numeros': 'Números', 'deuteronomio': 'Deuteronômio', 'josue': 'Josué',
            'juizes': 'Juízes', 'rute': 'Rute', 'samuel1': '1 Samuel',
            'samuel2': '2 Samuel', 'reis1': '1 Reis', 'reis2': '2 Reis',
            'cronicas1': '1 Crônicas', 'cronicas2': '2 Crônicas', 'esdras': 'Esdras',
            'neemias': 'Neemias', 'ester': 'Ester', 'jo': 'Jó', 'salmos': 'Salmos',
            'proverbios': 'Provérbios', 'eclesiastes': 'Eclesiastes',
            'cantares': 'Cântico dos Cânticos', 'isaias': 'Isaías',
            'jeremias': 'Jeremias', 'lamentacoes': 'Lamentações',
            'ezequiel': 'Ezequiel', 'daniel': 'Daniel', 'oseias': 'Oséias',
            'joel': 'Joel', 'amos': 'Amós', 'obadias': 'Obadias', 'jonas': 'Jonas',
            'miqueias': 'Miquéias', 'naum': 'Naum', 'habacuque': 'Habacuque',
            'sofonias': 'Sofonias', 'ageu': 'Ageu', 'zacarias': 'Zacarias',
            'malaquias': 'Malaquias', 'mateus': 'Mateus', 'marcos': 'Marcos',
            'lucas': 'Lucas', 'joao': 'João', 'atos': 'Atos', 'romanos': 'Romanos',
            'corintios1': '1 Coríntios', 'corintios2': '2 Coríntios',
            'galatas': 'Gálatas', 'efesios': 'Efésios', 'filipenses': 'Filipenses',
            'colossenses': 'Colossenses', 'tessalonicenses1': '1 Tessalonicenses',
            'tessalonicenses2': '2 Tessalonicenses', 'timoteo1': '1 Timóteo',
            'timoteo2': '2 Timóteo', 'tito': 'Tito', 'filemom': 'Filemom',
            'hebreus': 'Hebreus', 'tiago': 'Tiago', 'pedro1': '1 Pedro',
            'pedro2': '2 Pedro', 'joao1': '1 João', 'joao2': '2 João',
            'joao3': '3 João', 'judas': 'Judas', 'apocalipse': 'Apocalipse'
        }
    
    
    def extrair_referencias(self, texto: str) -> List[Dict]:
        """
        Extrai todas as referências bíblicas do texto
        
        Args:
            texto: Texto da pregação
            
        Returns:
            Lista de dicionários com referências encontradas
        """
        referencias = []
        
        # Padrão: Livro Capítulo:Versículo (ex: João 3:16)
        # Aceita: João 3:16, João 3:16-17, João 3, 1 João 3:16
        padrao = r'(?:1|2|3|I{1,3})?\s*([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?'
        
        matches = re.finditer(padrao, texto)
        
        for match in matches:
            livro_raw = match.group(1).strip()
            capitulo = match.group(2)
            versiculo_inicio = match.group(3)
            versiculo_fim = match.group(4)
            
            # Verifica se é um livro bíblico válido
            livro_canonico = self._identificar_livro(livro_raw)
            
            if livro_canonico:
                referencia = {
                    'livro_canonico': livro_canonico,
                    'livro_formal': self.nomes_formais.get(livro_canonico),
                    'capitulo': int(capitulo),
                    'versiculo_inicio': int(versiculo_inicio) if versiculo_inicio else None,
                    'versiculo_fim': int(versiculo_fim) if versiculo_fim else None,
                    'referencia_completa': self._formatar_referencia(
                        livro_canonico, capitulo, versiculo_inicio, versiculo_fim
                    )
                }
                referencias.append(referencia)
        
        return referencias
    
    
    def _identificar_livro(self, livro_texto: str) -> Optional[str]:
        """
        Identifica o livro canônico a partir de uma variação
        
        Args:
            livro_texto: Nome do livro (qualquer variação)
            
        Returns:
            Nome canônico ou None
        """
        livro_lower = livro_texto.lower().strip()
        
        # Busca no mapa reverso
        return self.mapa_reverso.get(livro_lower)
    
    
    def _formatar_referencia(self, livro: str, cap: str, v_ini: str = None, v_fim: str = None) -> str:
        """Formata referência completa"""
        nome = self.nomes_formais.get(livro, livro)
        
        if v_ini and v_fim:
            return f"{nome} {cap}:{v_ini}-{v_fim}"
        elif v_ini:
            return f"{nome} {cap}:{v_ini}"
        else:
            return f"{nome} {cap}"
    
    
    def extrair_metadados_pregacao(self, pregacao: Dict) -> Dict:
        """
        Extrai metadados bíblicos de uma pregação completa
        
        Args:
            pregacao: Pregação normalizada
            
        Returns:
            Dicionário com metadados enriquecidos
        """
        titulo = pregacao.get('titulo', '')
        conteudo = pregacao.get('conteudo_limpo', '')
        
        # Extrai do título e conteúdo
        refs_titulo = self.extrair_referencias(titulo)
        refs_conteudo = self.extrair_referencias(conteudo)
        
        # Combina e remove duplicatas
        todas_refs = refs_titulo + refs_conteudo
        
        # Conta frequência de cada livro
        livros_mencionados = [ref['livro_canonico'] for ref in todas_refs]
        frequencia_livros = Counter(livros_mencionados)
        
        # Livro principal (mais mencionado)
        livro_principal = None
        texto_base = None
        
        if frequencia_livros:
            livro_principal = frequencia_livros.most_common(1)[0][0]
            
            # Texto base: primeira referência do livro principal no título
            for ref in refs_titulo:
                if ref['livro_canonico'] == livro_principal:
                    texto_base = ref['referencia_completa']
                    break
        
        metadados = {
            **pregacao,  # Mantém dados originais
            'metadados_biblicos': {
                'livro_principal': self.nomes_formais.get(livro_principal) if livro_principal else None,
                'texto_base': texto_base,
                'total_referencias': len(todas_refs),
                'referencias_titulo': len(refs_titulo),
                'referencias_conteudo': len(refs_conteudo),
                'livros_mencionados': [self.nomes_formais.get(l) for l in set(livros_mencionados)],
                'todas_referencias': [ref['referencia_completa'] for ref in todas_refs[:10]]  # Primeiras 10
            }
        }
        
        return metadados
    
    
    def processar_lote(self, pregacoes: List[Dict]) -> List[Dict]:
        """
        Processa um lote de pregações
        
        Args:
            pregacoes: Lista de pregações normalizadas
            
        Returns:
            Lista com metadados extraídos
        """
        enriquecidas = []
        
        print(f"\n📖 Extraindo metadados bíblicos de {len(pregacoes)} pregações...")
        
        for i, pregacao in enumerate(pregacoes, 1):
            try:
                enriquecida = self.extrair_metadados_pregacao(pregacao)
                enriquecidas.append(enriquecida)
                
                if i % 50 == 0:
                    print(f"   ✓ {i}/{len(pregacoes)}")
            
            except Exception as e:
                print(f"   ❌ Erro na pregação {i}: {e}")
                enriquecidas.append(pregacao)  # Mantém original
        
        print(f"✅ {len(enriquecidas)} pregações processadas")
        
        return enriquecidas
    
    
    def gerar_relatorio_biblico(self, pregacoes: List[Dict]) -> Dict:
        """
        Gera relatório de livros mais pregados
        
        Args:
            pregacoes: Pregações com metadados
            
        Returns:
            Relatório estatístico
        """
        livros_principais = []
        total_com_livro = 0
        total_referencias = 0
        
        for p in pregacoes:
            meta = p.get('metadados_biblicos', {})
            livro = meta.get('livro_principal')
            
            if livro:
                livros_principais.append(livro)
                total_com_livro += 1
            
            total_referencias += meta.get('total_referencias', 0)
        
        freq_livros = Counter(livros_principais)
        
        return {
            'total_pregacoes': len(pregacoes),
            'com_livro_identificado': total_com_livro,
            'sem_livro': len(pregacoes) - total_com_livro,
            'total_referencias_extraidas': total_referencias,
            'media_referencias_por_pregacao': total_referencias / len(pregacoes) if pregacoes else 0,
            'top_10_livros': freq_livros.most_common(10)
        }
    
    
    def imprimir_relatorio_biblico(self, relatorio: Dict):
        """Imprime relatório formatado"""
        print("\n" + "=" * 80)
        print("📖 RELATÓRIO DE METADADOS BÍBLICOS")
        print("=" * 80)
        
        print(f"\n🔷 IDENTIFICAÇÃO:")
        print(f"   Total de pregações: {relatorio['total_pregacoes']}")
        print(f"   Com livro identificado: {relatorio['com_livro_identificado']} ({relatorio['com_livro_identificado']/relatorio['total_pregacoes']*100:.1f}%)")
        print(f"   Sem livro: {relatorio['sem_livro']} ({relatorio['sem_livro']/relatorio['total_pregacoes']*100:.1f}%)")
        
        print(f"\n🔷 REFERÊNCIAS:")
        print(f"   Total extraídas: {relatorio['total_referencias_extraidas']:,}")
        print(f"   Média por pregação: {relatorio['media_referencias_por_pregacao']:.1f}")
        
        print(f"\n🔷 TOP 10 LIVROS MAIS PREGADOS:")
        for i, (livro, qtd) in enumerate(relatorio['top_10_livros'], 1):
            print(f"   {i:2d}. {livro:25} - {qtd:3d} pregações")
        
        print("\n" + "=" * 80)


# ==================== TESTE ====================


if __name__ == "__main__":
    import json
    from pathlib import Path
    
    print("\n" + "=" * 80)
    print("🧪 TESTE DO EXTRATOR DE METADADOS BÍBLICOS")
    print("=" * 80)
    
    # Carrega pregações normalizadas
    arquivo = Path("../../output/pregacoes_2016_normalizadas.json")
    
    if arquivo.exists():
        with open(arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        
        pregacoes = dados.get('pregacoes', dados)  # Suporta ambos formatos
        
        # Extrai metadados
        extractor = MetadadosBiblicosExtractor()
        enriquecidas = extractor.processar_lote(pregacoes[:10])  # Testa com 10
        
        # Mostra exemplo
        print("\n📋 EXEMPLO DE PREGAÇÃO ENRIQUECIDA:")
        exemplo = enriquecidas[0]
        print(f"   Título: {exemplo['titulo']}")
        meta = exemplo.get('metadados_biblicos', {})
        print(f"   Livro principal: {meta.get('livro_principal')}")
        print(f"   Texto base: {meta.get('texto_base')}")
        print(f"   Total de referências: {meta.get('total_referencias')}")
        
        # Relatório
        relatorio = extractor.gerar_relatorio_biblico(enriquecidas)
        extractor.imprimir_relatorio_biblico(relatorio)
    
    else:
        print(f"❌ Arquivo não encontrado: {arquivo}")
        print("   Execute primeiro o pipeline.py!")
