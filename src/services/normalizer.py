#!/usr/bin/env python3
"""
🧹 NORMALIZER.PY - Normalizador de Pregações
Padroniza, limpa e enriquece dados de pregações
"""

import re
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
from unidecode import unidecode


class PregacoesNormalizer:
    """Normalizador de dados de pregações"""
    
    def __init__(self):
        """Inicializa o normalizador"""
        
        # Lista de pregadores OFICIAIS da igreja
        self.pregadores_oficiais = [
            "Nélio Monteiro",
            "Gabriel Monteiro",
            "Ryan Souza",
            "Jaine Feliciano",
            "Robson Soares",
            "Jailson"
        ]
        
        # Mapa de normalização COMPLETO (variações -> nome correto)
        self.mapa_normalizacao = {
            # Ryan (todas variações)
            'ryan sousa': 'Ryan Souza',
            'ryan souza': 'Ryan Souza',
            'ryan de sousa': 'Ryan Souza',
            'ryan de souza': 'Ryan Souza',
            'ryan': 'Ryan Souza',
            
            # Silvio (todas variações)
            'silvio farias': 'Silvio Farias',
            'sílvio farias': 'Silvio Farias',
            'silvio faria': 'Silvio Farias',
            'sílvio faria': 'Silvio Farias',
            'silvio': 'Silvio Farias',
            'sílvio': 'Silvio Farias',
            
            # Nelio (todas variações)
            'nelio monteiro': 'Nélio Monteiro',
            'nélio monteiro': 'Nélio Monteiro',
            'nelio': 'Nélio Monteiro',
            'nélio': 'Nélio Monteiro',
            
            # Gabriel
            'gabriel monteiro': 'Gabriel Monteiro',
            'gabriel': 'Gabriel Monteiro',
            
            # Robson (todas variações)
            'robson soares': 'Robson Soares',
            'pastor robson': 'Robson Soares',
            'pr robson': 'Robson Soares',
            'robson': 'Robson Soares',
            
            # Jailson
            'jailson': 'Jailson',
            
            # Jaine (todas variações)
            'jaine feliciano': 'Jaine Feliciano',
            'missionária jaine': 'Jaine Feliciano',
            'missionaria jaine': 'Jaine Feliciano',
            'jaine': 'Jaine Feliciano'
        }
        
        # Palavras que NÃO SÃO nomes de pregadores
        self.palavras_invalidas = [
            'cada um', 'todos', 'nós', 'vamos', 'estamos',
            'não estamos', 'cada', 'um', 'todos nós'
        ]
        
        # Frases da redatora/editora (NÃO são pregadores)
        self.frases_redatora = [
            'editado por', 'editada por', 'mensagem pastor',
            'mensagem seminarista', 'mensagem do pastor',
            'mensagem do seminarista', 'transcrito por',
            'transcrita por', 'resumo por', 'resenha por',
            'editado', 'editada', 'beth', 'elizabete',
            'lacerda', 'paulo'
        ]
    
    
    def normalizar_pregacao(self, pregacao: Dict, ano_arquivo: int = None) -> Dict:
        """
        Normaliza uma pregação individual
        
        Args:
            pregacao: Dicionário com dados da pregação
            ano_arquivo: Ano do arquivo (fallback se data estiver vazia)
            
        Returns:
            Pregação normalizada
        """
        # 🆕 Extrai data do texto PRIMEIRO (mais confiável)
        data_do_texto = self._extrair_data_do_texto(pregacao.get('conteudo_completo', ''))
        data_do_json = self._normalizar_data(pregacao.get('data_pregacao'), ano_arquivo)
        
        # Prioriza data do texto
        data_final = data_do_texto or data_do_json
        
        normalizada = {
            'id_original': pregacao.get('id'),
            'titulo': self._limpar_titulo(pregacao.get('titulo', '')),
            'data_pregacao': data_final,
            'ano': self._extrair_ano_da_data(data_final, ano_arquivo),
            'pregador': self._extrair_e_normalizar_pregador(pregacao),
            'tipo_pregador': None,
            'conteudo_original': pregacao.get('conteudo_completo', ''),
            'conteudo_limpo': self._limpar_conteudo(pregacao.get('conteudo_completo', '')),
            'tamanho_texto': len(pregacao.get('conteudo_completo', '')),
            'url_blog': pregacao.get('url_blog', ''),
            'url_youtube': pregacao.get('url_youtube', ''),
            'tags': pregacao.get('tags', []),
            '_metadados': {
                'ano_arquivo': ano_arquivo or pregacao.get('_ano_arquivo'),
                'igreja': pregacao.get('_igreja', ''),
                'processado_em': datetime.now().isoformat(),
                'data_fonte': 'texto' if data_do_texto else ('json' if data_do_json else 'fallback')
            }
        }
        
        # Classifica tipo de pregador
        normalizada['tipo_pregador'] = self._classificar_tipo_pregador(normalizada['pregador'])
        
        # Gera ID único
        normalizada['id_unico'] = self._gerar_id_unico(normalizada)
        
        return normalizada
    
    
    def _limpar_titulo(self, titulo: str) -> str:
        """Remove caracteres especiais e normaliza título"""
        if not titulo:
            return "Sem título"
        
        titulo = ' '.join(titulo.split())
        return titulo.strip()
    
    
    def _extrair_data_do_texto(self, conteudo: str) -> Optional[str]:
        """
        Extrai data real da pregação do conteúdo (primeiras linhas)
        
        Args:
            conteudo: Texto completo da pregação
            
        Returns:
            Data no formato DD/MM/YYYY ou None
        """
        if not conteudo:
            return None
        
        # Busca nas primeiras 15 linhas
        linhas = conteudo.split('\n')[:15]
        
        # Padrões de data (DD/MM/YYYY ou DD-MM-YYYY ou DD/MM/YY)
        padroes_data = [
            r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b',      # 24/08/2025
            r'\b(\d{1,2})-(\d{1,2})-(\d{4})\b',      # 24-08-2025
            r'\b(\d{1,2})/(\d{1,2})/(\d{2})\b',      # 24/08/25
        ]
        
        for linha in linhas:
            # Remove espaços extras
            linha = linha.strip()
            
            # Ignora linhas muito longas (não são datas)
            if len(linha) > 50:
                continue
            
            # Tenta encontrar data
            for padrao in padroes_data:
                match = re.search(padrao, linha)
                if match:
                    dia = match.group(1)
                    mes = match.group(2)
                    ano = match.group(3)
                    
                    # Converte ano de 2 dígitos para 4
                    if len(ano) == 2:
                        ano = f"20{ano}" if int(ano) <= 50 else f"19{ano}"
                    
                    # Valida data
                    try:
                        data_obj = datetime(int(ano), int(mes), int(dia))
                        
                        # Retorna no formato DD/MM/YYYY
                        return data_obj.strftime("%d/%m/%Y")
                    except:
                        continue
        
        return None
    
    
    def _normalizar_data(self, data_str: str, ano_fallback: int = None) -> Optional[str]:
        """
        Normaliza data para formato DD/MM/YYYY
        
        Args:
            data_str: String da data
            ano_fallback: Ano para usar se data estiver vazia
            
        Returns:
            Data no formato DD/MM/YYYY ou None
        """
        if not data_str or data_str.strip() == '':
            return None
        
        formatos = [
            "%d/%m/%Y",
            "%d-%m-%Y", 
            "%Y-%m-%d",
            "%d/%m/%y",
            "%d%m%Y"
        ]
        
        for formato in formatos:
            try:
                data = datetime.strptime(data_str.strip(), formato)
                return data.strftime("%d/%m/%Y")
            except:
                continue
        
        return None
    
    
    def _extrair_ano(self, data_str: str, ano_fallback: int = None) -> int:
        """
        Extrai ano da data ou usa fallback
        
        Args:
            data_str: String da data
            ano_fallback: Ano do arquivo
            
        Returns:
            Ano (int)
        """
        data_normalizada = self._normalizar_data(data_str, ano_fallback)
        
        if data_normalizada:
            try:
                return int(data_normalizada.split('/')[-1])
            except:
                pass
        
        return ano_fallback if ano_fallback else datetime.now().year
    
    
    def _extrair_ano_da_data(self, data_str: str, ano_fallback: int = None) -> int:
        """
        Extrai ano de uma data já normalizada
        
        Args:
            data_str: Data no formato DD/MM/YYYY
            ano_fallback: Ano do arquivo
            
        Returns:
            Ano (int)
        """
        if data_str:
            try:
                return int(data_str.split('/')[-1])
            except:
                pass
        
        return ano_fallback if ano_fallback else datetime.now().year
    
    
    def _extrair_e_normalizar_pregador(self, pregacao: Dict) -> Optional[str]:
        """
        Extrai e normaliza o nome do pregador (VERSÃO ROBUSTA)
        
        Args:
            pregacao: Dicionário da pregação
            
        Returns:
            Nome normalizado do pregador ou None
        """
        conteudo = pregacao.get('conteudo_completo', '')
        
        if not conteudo:
            return None
        
        # Busca nas últimas 15 linhas
        linhas = conteudo.split('\n')
        ultimas_linhas = [l.strip() for l in linhas[-15:] if l.strip()]
        ultimas_linhas.reverse()
        
        # ESTRATÉGIA 1: Busca linha antes de "IBPS"
        for i in range(len(ultimas_linhas) - 1):
            linha_atual = ultimas_linhas[i]
            linha_anterior = ultimas_linhas[i + 1] if i + 1 < len(ultimas_linhas) else ""
            
            # Se achou "IBPS", pega linha anterior
            if re.search(r'\bIBPS\b|Igreja\s+Batista', linha_atual, re.IGNORECASE):
                nome_candidato = self._limpar_nome_bruto(linha_anterior)
                
                if nome_candidato:
                    nome_normalizado = self._normalizar_nome_pregador(nome_candidato)
                    if nome_normalizado:
                        return nome_normalizado
        
        # ESTRATÉGIA 2: Busca padrão "Pastor Nome" ou "Pr. Nome" ou "Irmão Nome"
        texto_busca = '\n'.join(ultimas_linhas[:10])
        
        padroes = [
            r'(?:Pastor|Pr\.|Pregador|Missionária|Irmão)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)',
            r'^([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+)\s*$'
        ]
        
        for padrao in padroes:
            match = re.search(padrao, texto_busca, re.MULTILINE | re.IGNORECASE)
            if match:
                nome_candidato = self._limpar_nome_bruto(match.group(1))
                
                if nome_candidato:
                    nome_normalizado = self._normalizar_nome_pregador(nome_candidato)
                    if nome_normalizado:
                        return nome_normalizado
        
        return None
    
    
    def _limpar_nome_bruto(self, nome_bruto: str) -> Optional[str]:
        """
        Limpa nome bruto removendo prefixos, sufixos e ruídos
        
        Args:
            nome_bruto: Nome extraído do texto
            
        Returns:
            Nome limpo ou None
        """
        if not nome_bruto:
            return None
        
        # VALIDAÇÃO PRIMEIRA: Ignora frases da redatora
        nome_lower_check = nome_bruto.lower()
        for frase_redatora in self.frases_redatora:
            if frase_redatora in nome_lower_check:
                return None
        
        # Remove prefixos
        nome = re.sub(
            r'^(Pastor|Pr\.|Pregador|Missionária|Missionario|Irmão|Mensagem)\s+',
            '',
            nome_bruto,
            flags=re.IGNORECASE
        )
        
        # Remove cidades no final (BH, Muriaé, etc.)
        nome = re.sub(r'\s+(BH|Bh|Muriaé|Muriape|Muriae)\s*$', '', nome, flags=re.IGNORECASE)
        
        # Remove sufixos (TUDO depois destas palavras)
        nome = re.sub(
            r'\s+(em|de|da|na|no|do|IBPS|Igreja|Batista|Parque|Safira|Culto|Manhã|Noite|Tarde|Domingo|Belo|Horizonte|Muriaé|–|-).*$',
            '',
            nome,
            flags=re.IGNORECASE
        )
        
        # Remove pontuação
        nome = re.sub(r'[.,;:!?–-]', '', nome)
        
        # Remove espaços extras
        nome = ' '.join(nome.split()).strip()
        
        # Valida tamanho mínimo
        if len(nome) < 3:
            return None
        
        # VALIDAÇÃO FINAL: Verifica novamente frases da redatora
        nome_lower_final = nome.lower()
        for frase_redatora in self.frases_redatora:
            if frase_redatora in nome_lower_final:
                return None
        
        return nome
    
    
    def _normalizar_nome_pregador(self, nome: str) -> Optional[str]:
        """
        Normaliza variações de nomes para forma padrão
        
        Args:
            nome: Nome do pregador (limpo)
            
        Returns:
            Nome normalizado ou None
        """
        if not nome or len(nome) < 3:
            return None
        
        nome_lower = nome.lower().strip()
        nome_sem_acento = unidecode(nome_lower)
        
        # VALIDAÇÃO 1: Rejeita palavras inválidas
        if nome_lower in self.palavras_invalidas:
            return None
        
        # VALIDAÇÃO 2: Rejeita se contém palavras inválidas
        for palavra_invalida in self.palavras_invalidas:
            if palavra_invalida in nome_lower:
                return None
        
        # VALIDAÇÃO 3: Rejeita frases da redatora
        for frase_redatora in self.frases_redatora:
            if frase_redatora in nome_lower:
                return None
        
        # VALIDAÇÃO 4: Rejeita nomes muito longos (provavelmente frases)
        if len(nome) > 30:
            return None
        
        # VALIDAÇÃO 5: Rejeita se contém verbos comuns (é frase, não nome)
        verbos_comuns = ['comprometa', 'seja', 'faça', 'tenha', 'esteja', 'vamos', 'façamos']
        for verbo in verbos_comuns:
            if verbo in nome_lower:
                return None
        
        # BUSCA 1: Exata no mapa
        if nome_sem_acento in self.mapa_normalizacao:
            return self.mapa_normalizacao[nome_sem_acento]
        
        # BUSCA 2: Apenas primeiro nome
        primeiro_nome = nome_sem_acento.split()[0]
        if primeiro_nome in self.mapa_normalizacao:
            return self.mapa_normalizacao[primeiro_nome]
        
        # BUSCA 3: Parcial nos pregadores oficiais
        for pregador_oficial in self.pregadores_oficiais:
            pregador_sem_acento = unidecode(pregador_oficial.lower())
            
            if nome_sem_acento in pregador_sem_acento or pregador_sem_acento in nome_sem_acento:
                return pregador_oficial
        
        # BUSCA 4: Se tem nome + sobrenome válido, capitaliza
        partes = nome.split()
        if len(partes) >= 2 and len(nome) < 50:
            return ' '.join(p.capitalize() for p in partes)
        
        # Ignora nomes de uma palavra só
        if len(partes) == 1:
            return None
        
        return None
    
    
    def _classificar_tipo_pregador(self, pregador: Optional[str]) -> str:
        """
        Classifica tipo de pregador
        
        Args:
            pregador: Nome do pregador
            
        Returns:
            Tipo: "oficial", "irmao", "visitante" ou "desconhecido"
        """
        if not pregador:
            return "desconhecido"
        
        # Verifica se é pregador oficial
        if pregador in self.pregadores_oficiais:
            return "oficial"
        
        # Irmãos conhecidos (membros da igreja que pregaram)
        irmaos_conhecidos = [
            "Silvio Farias",
            "Márcio Santos",
            "Paulo Junior",
            "Felipe",
            "Garibaldi",
            "Guilherme Saito",
            "Paulo Victor",
            "Geovane Glória"
        ]
        
        for irmao in irmaos_conhecidos:
            if irmao.lower() in pregador.lower():
                return "irmao"
        
        return "visitante"
    
    
    def _limpar_conteudo(self, conteudo: str) -> str:
        """
        Remove padrões desnecessários do texto
        
        Args:
            conteudo: Texto original
            
        Returns:
            Texto limpo
        """
        if not conteudo:
            return ""
        
        padroes_remover = [
            r"Resenha do Culto.*?\n",
            r"Culto (da|de) (manhã|noite|tarde).*?\n",
            r"Domingo.*?\n",
            r"^tags.*",
            r"\.\.\.\s*tags.*",
        ]
        
        texto_limpo = conteudo
        
        for padrao in padroes_remover:
            texto_limpo = re.sub(padrao, '', texto_limpo, flags=re.IGNORECASE | re.MULTILINE)
        
        texto_limpo = re.sub(r'\n\s*\n', '\n\n', texto_limpo)
        texto_limpo = re.sub(r' +', ' ', texto_limpo)
        
        return texto_limpo.strip()
    
    
    def _gerar_id_unico(self, pregacao: Dict) -> str:
        """
        Gera ID único no formato ANO_NNN
        
        Args:
            pregacao: Pregação normalizada
            
        Returns:
            ID único (ex: "2016_001")
        """
        ano = pregacao.get('ano')
        id_original = pregacao.get('id_original', 0)
        
        return f"{ano}_{id_original:03d}"
    
    
    def normalizar_lote(self, pregacoes: List[Dict], ano_arquivo: int = None) -> List[Dict]:
        """
        Normaliza um lote de pregações
        
        Args:
            pregacoes: Lista de pregações
            ano_arquivo: Ano do arquivo (opcional)
            
        Returns:
            Lista de pregações normalizadas
        """
        normalizadas = []
        
        print(f"\n⚙️  Normalizando {len(pregacoes)} pregações...")
        
        for i, pregacao in enumerate(pregacoes, 1):
            try:
                normalizada = self.normalizar_pregacao(pregacao, ano_arquivo)
                normalizadas.append(normalizada)
                
                if i % 10 == 0:
                    print(f"   ✓ {i}/{len(pregacoes)}")
                    
            except Exception as e:
                print(f"   ❌ Erro na pregação {i}: {e}")
        
        print(f"✅ {len(normalizadas)} pregações normalizadas")
        
        return normalizadas
    
    
    def gerar_relatorio(self, normalizadas: List[Dict]) -> Dict:
        """
        Gera relatório de qualidade dos dados
        
        Args:
            normalizadas: Lista de pregações normalizadas
            
        Returns:
            Dicionário com estatísticas
        """
        total = len(normalizadas)
        
        com_data = sum(1 for p in normalizadas if p['data_pregacao'])
        com_pregador = sum(1 for p in normalizadas if p['pregador'])
        com_conteudo = sum(1 for p in normalizadas if len(p['conteudo_limpo']) > 100)
        
        tamanhos = [p['tamanho_texto'] for p in normalizadas if p['tamanho_texto'] > 0]
        
        anos = {}
        for p in normalizadas:
            ano = p['ano']
            anos[ano] = anos.get(ano, 0) + 1
        
        pregadores = {}
        for p in normalizadas:
            preg = p['pregador'] or 'Não identificado'
            pregadores[preg] = pregadores.get(preg, 0) + 1
        
        tipos_pregador = {}
        for p in normalizadas:
            tipo = p.get('tipo_pregador', 'desconhecido')
            tipos_pregador[tipo] = tipos_pregador.get(tipo, 0) + 1
        
        # Identifica pregações sem pregador
        sem_pregador_detalhes = []
        for p in normalizadas:
            if not p['pregador']:
                sem_pregador_detalhes.append({
                    'id': p['id_original'],
                    'titulo': p['titulo'],
                    'data': p['data_pregacao'] or 'Sem data',
                    'ano': p['ano'],
                    'preview': p['conteudo_original'][:200] if p['conteudo_original'] else '',
                    'url_blog': p.get('url_blog', '')
                })
        
        # 🆕 Estatísticas de fonte de data
        fontes_data = {}
        for p in normalizadas:
            fonte = p.get('_metadados', {}).get('data_fonte', 'desconhecido')
            fontes_data[fonte] = fontes_data.get(fonte, 0) + 1
        
        relatorio = {
            'total_pregacoes': total,
            'com_data': com_data,
            'sem_data': total - com_data,
            'com_pregador': com_pregador,
            'sem_pregador': total - com_pregador,
            'com_conteudo_valido': com_conteudo,
            'tamanho_medio': sum(tamanhos) // len(tamanhos) if tamanhos else 0,
            'tamanho_minimo': min(tamanhos) if tamanhos else 0,
            'tamanho_maximo': max(tamanhos) if tamanhos else 0,
            'por_ano': anos,
            'por_pregador': pregadores,
            'por_tipo_pregador': tipos_pregador,
            'sem_pregador_detalhes': sem_pregador_detalhes,
            'fontes_data': fontes_data  # 🆕
        }
        
        return relatorio
    
    
    def imprimir_relatorio(self, relatorio: Dict):
        """
        Imprime relatório formatado
        
        Args:
            relatorio: Dicionário com estatísticas
        """
        print("\n" + "=" * 80)
        print("📊 RELATÓRIO DE NORMALIZAÇÃO")
        print("=" * 80)
        
        print(f"\n🔷 DADOS GERAIS:")
        print(f"   Total de pregações: {relatorio['total_pregacoes']}")
        print(f"   Com data: {relatorio['com_data']} ({relatorio['com_data']/relatorio['total_pregacoes']*100:.1f}%)")
        print(f"   Sem data: {relatorio['sem_data']} ({relatorio['sem_data']/relatorio['total_pregacoes']*100:.1f}%)")
        print(f"   Com pregador: {relatorio['com_pregador']} ({relatorio['com_pregador']/relatorio['total_pregacoes']*100:.1f}%)")
        print(f"   Sem pregador: {relatorio['sem_pregador']} ({relatorio['sem_pregador']/relatorio['total_pregacoes']*100:.1f}%)")
        
        # 🆕 Fonte das datas
        if relatorio.get('fontes_data'):
            print(f"\n🔷 FONTE DAS DATAS:")
            for fonte, qtd in sorted(relatorio['fontes_data'].items(), key=lambda x: x[1], reverse=True):
                print(f"   {fonte.capitalize()}: {qtd} pregações")
        
        print(f"\n🔷 TAMANHO DOS TEXTOS:")
        print(f"   Média: {relatorio['tamanho_medio']:,} caracteres")
        print(f"   Mínimo: {relatorio['tamanho_minimo']:,} caracteres")
        print(f"   Máximo: {relatorio['tamanho_maximo']:,} caracteres")
        
        print(f"\n🔷 DISTRIBUIÇÃO POR ANO:")
        for ano in sorted(relatorio['por_ano'].keys()):
            qtd = relatorio['por_ano'][ano]
            print(f"   {ano}: {qtd} pregações")
        
        print(f"\n🔷 TIPO DE PREGADOR:")
        for tipo, qtd in sorted(relatorio['por_tipo_pregador'].items(), key=lambda x: x[1], reverse=True):
            print(f"   {tipo.capitalize()}: {qtd} pregações")
        
        print(f"\n🔷 DISTRIBUIÇÃO POR PREGADOR:")
        top_pregadores = sorted(relatorio['por_pregador'].items(), key=lambda x: x[1], reverse=True)
        for pregador, qtd in top_pregadores[:15]:
            print(f"   {pregador}: {qtd} pregações")
        
        # Mostra detalhes das pregações sem pregador
        if relatorio.get('sem_pregador_detalhes'):
            print(f"\n🔷 PREGAÇÕES SEM PREGADOR IDENTIFICADO:")
            for detalhe in relatorio['sem_pregador_detalhes']:
                print(f"\n   📌 ID: {detalhe['id']} | Data: {detalhe['data']} | Ano: {detalhe['ano']}")
                print(f"   📖 Título: {detalhe['titulo'][:70]}...")
                if detalhe['url_blog']:
                    print(f"   🔗 URL: {detalhe['url_blog']}")
                preview_clean = ' '.join(detalhe['preview'].split())
                print(f"   📄 Preview: {preview_clean[:120]}...")
        
        print("\n" + "=" * 80)


# ==================== TESTE ====================


if __name__ == "__main__":
    from loader import PregacoesLoader
    import json
    
    print("\n" + "=" * 80)
    print("🧪 TESTE DO NORMALIZER")
    print("=" * 80)
    
    loader = PregacoesLoader()
    dados = loader.carregar_por_ano(2025)
    
    if dados:
        normalizer = PregacoesNormalizer()
        pregacoes = dados.get('pregacoes', [])
        normalizadas = normalizer.normalizar_lote(pregacoes, dados.get('ano'))
        
        relatorio = normalizer.gerar_relatorio(normalizadas)
        normalizer.imprimir_relatorio(relatorio)
        
        output_file = "../../output/pregacoes_2025_normalizadas.json"
        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(normalizadas, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 Salvo em: {output_file}")
