#!/usr/bin/env python3
"""
🧹 NORMALIZER.PY - Normalizador de Pregações
Padroniza, limpa e enriquece dados de pregações
"""

import re
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path


class PregacoesNormalizer:
    """Normalizador de dados de pregações"""
    
    def __init__(self):
        """Inicializa o normalizador"""
        self.pregadores_conhecidos = [
            "Nélio Monteiro",
            "Ryan Sousa", 
            "Gabriel Monteiro",
            "Jaine Feliciano",
            "Robson Soares",
            "Jailson"
        ]
        
        # Padrões para detectar pregadores no texto
        self.padroes_pregador = [
            r"(?:Pastor|Pr\.|Pregador)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)",
            r"([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+)\s*\.\.\.\s*tags",
            r"Pr\.\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)",
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
        normalizada = {
            'id_original': pregacao.get('id'),
            'titulo': self._limpar_titulo(pregacao.get('titulo', '')),
            'data_pregacao': self._normalizar_data(pregacao.get('data_pregacao'), ano_arquivo),
            'ano': self._extrair_ano(pregacao.get('data_pregacao'), ano_arquivo),
            'pregador': self._extrair_pregador(pregacao),
            'conteudo_original': pregacao.get('conteudo_completo', ''),
            'conteudo_limpo': self._limpar_conteudo(pregacao.get('conteudo_completo', '')),
            'tamanho_texto': len(pregacao.get('conteudo_completo', '')),
            'url_blog': pregacao.get('url_blog', ''),
            'url_youtube': pregacao.get('url_youtube', ''),
            'tags': pregacao.get('tags', []),
            '_metadados': {
                'ano_arquivo': ano_arquivo or pregacao.get('_ano_arquivo'),
                'igreja': pregacao.get('_igreja', ''),
                'processado_em': datetime.now().isoformat()
            }
        }
        
        # Gera ID único
        normalizada['id_unico'] = self._gerar_id_unico(normalizada)
        
        return normalizada
    
    
    def _limpar_titulo(self, titulo: str) -> str:
        """Remove caracteres especiais e normaliza título"""
        if not titulo:
            return "Sem título"
        
        # Remove espaços extras
        titulo = ' '.join(titulo.split())
        
        return titulo.strip()
    
    
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
        
        # Formatos conhecidos
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
    
    
    def _extrair_pregador(self, pregacao: Dict) -> Optional[str]:
        """
        Tenta extrair o nome do pregador do conteúdo
        
        Args:
            pregacao: Dicionário da pregação
            
        Returns:
            Nome do pregador ou None
        """
        conteudo = pregacao.get('conteudo_completo', '')
        
        if not conteudo:
            return None
        
        # Busca no final do texto (comum ter "Nome... tags")
        ultimas_linhas = '\n'.join(conteudo.split('\n')[-5:])
        
        # Remove quebras de linha e espaços extras
        ultimas_linhas = ' '.join(ultimas_linhas.split())
        
        for padrao in self.padroes_pregador:
            match = re.search(padrao, ultimas_linhas, re.IGNORECASE)
            if match:
                nome = match.group(1).strip()
                
                # Remove sufixos comuns
                nome = re.sub(r'\s+(em|de|da|IBPS|Igreja).*$', '', nome, flags=re.IGNORECASE)
                
                # Remove espaços duplos
                nome = ' '.join(nome.split())
                
                # Valida se é um nome conhecido
                for pregador in self.pregadores_conhecidos:
                    if pregador.lower() in nome.lower():
                        return pregador
                
                # Se não conhece mas parece nome válido (tem sobrenome)
                if len(nome.split()) >= 2 and len(nome) < 50:
                    return nome
        
        return None
    
    
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
        
        # Remove cabeçalhos comuns
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
        
        # Remove espaços extras
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
            'por_pregador': pregadores
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
        
        print(f"\n🔷 TAMANHO DOS TEXTOS:")
        print(f"   Média: {relatorio['tamanho_medio']:,} caracteres")
        print(f"   Mínimo: {relatorio['tamanho_minimo']:,} caracteres")
        print(f"   Máximo: {relatorio['tamanho_maximo']:,} caracteres")
        
        print(f"\n🔷 DISTRIBUIÇÃO POR ANO:")
        for ano in sorted(relatorio['por_ano'].keys()):
            qtd = relatorio['por_ano'][ano]
            print(f"   {ano}: {qtd} pregações")
        
        print(f"\n🔷 DISTRIBUIÇÃO POR PREGADOR:")
        top_pregadores = sorted(relatorio['por_pregador'].items(), key=lambda x: x[1], reverse=True)
        for pregador, qtd in top_pregadores[:10]:
            print(f"   {pregador}: {qtd} pregações")
        
        print("\n" + "=" * 80)


# ==================== TESTE ====================


if __name__ == "__main__":
    from loader import PregacoesLoader
    import json
    
    print("\n" + "=" * 80)
    print("🧪 TESTE DO NORMALIZER")
    print("=" * 80)
    
    # Carrega dados
    loader = PregacoesLoader()
    dados = loader.carregar_por_ano(2016)
    
    if dados:
        # Normaliza
        normalizer = PregacoesNormalizer()
        pregacoes = dados.get('pregacoes', [])
        normalizadas = normalizer.normalizar_lote(pregacoes, dados.get('ano'))
        
        # Relatório
        relatorio = normalizer.gerar_relatorio(normalizadas)
        normalizer.imprimir_relatorio(relatorio)
        
        # Salva resultado
        output_file = "../../output/pregacoes_2016_normalizadas.json"
        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(normalizadas, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 Salvo em: {output_file}")
