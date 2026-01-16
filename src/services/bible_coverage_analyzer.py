#!/usr/bin/env python3
"""
📊 BIBLE_COVERAGE_ANALYZER.PY - Analisador de Cobertura Bíblica
Cruza pregações com estrutura completa da Bíblia usando API
"""

import json
import os
import requests
from typing import Dict, List, Optional, Set
from collections import Counter, defaultdict
from pathlib import Path


# Desabilita warnings de SSL
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class BiblicalCoverageAnalyzer:
    """Analisador de cobertura bíblica completa"""
    
    def __init__(self):
        """Inicializa o analisador"""
        
        # API gratuita da Bíblia em português
        self.api_base = "https://www.abibliadigital.com.br/api"
        
        # Configura proxy das variáveis de ambiente
        self.proxies = self._configurar_proxy()
        
        # Estrutura completa da Bíblia (fallback se API falhar)
        self.estrutura_biblica = self._carregar_estrutura_local()
        
        # Tenta carregar da API
        print("📖 Carregando estrutura da Bíblia...")
        estrutura_api = self._carregar_estrutura_api()
        
        if estrutura_api:
            print("   ✅ Dados carregados da API")
            self.estrutura_biblica = estrutura_api
        else:
            print("   ⚠️  API indisponível. Usando dados locais.")
    
    
    def _configurar_proxy(self) -> Dict:
        """
        Configura proxy a partir de variáveis de ambiente
        
        Returns:
            Dicionário com configuração de proxy ou vazio
        """
        proxies = {}
        
        http_proxy = os.getenv('HTTP_PROXY')
        https_proxy = os.getenv('HTTPS_PROXY')
        
        if http_proxy:
            proxies['http'] = http_proxy
            print(f"   🔒 Proxy HTTP configurado")
        
        if https_proxy:
            proxies['https'] = https_proxy
            print(f"   🔒 Proxy HTTPS configurado")
        
        return proxies
    
    
    def _carregar_estrutura_local(self) -> Dict:
        """
        Estrutura completa da Bíblia (fallback local)
        
        Returns:
            Dicionário com estrutura de livros e capítulos
        """
        return {
            # Antigo Testamento
            'genesis': {'nome': 'Gênesis', 'testamento': 'VT', 'capitulos': 50},
            'exodo': {'nome': 'Êxodo', 'testamento': 'VT', 'capitulos': 40},
            'levitico': {'nome': 'Levítico', 'testamento': 'VT', 'capitulos': 27},
            'numeros': {'nome': 'Números', 'testamento': 'VT', 'capitulos': 36},
            'deuteronomio': {'nome': 'Deuteronômio', 'testamento': 'VT', 'capitulos': 34},
            'josue': {'nome': 'Josué', 'testamento': 'VT', 'capitulos': 24},
            'juizes': {'nome': 'Juízes', 'testamento': 'VT', 'capitulos': 21},
            'rute': {'nome': 'Rute', 'testamento': 'VT', 'capitulos': 4},
            'samuel1': {'nome': '1 Samuel', 'testamento': 'VT', 'capitulos': 31},
            'samuel2': {'nome': '2 Samuel', 'testamento': 'VT', 'capitulos': 24},
            'reis1': {'nome': '1 Reis', 'testamento': 'VT', 'capitulos': 22},
            'reis2': {'nome': '2 Reis', 'testamento': 'VT', 'capitulos': 25},
            'cronicas1': {'nome': '1 Crônicas', 'testamento': 'VT', 'capitulos': 29},
            'cronicas2': {'nome': '2 Crônicas', 'testamento': 'VT', 'capitulos': 36},
            'esdras': {'nome': 'Esdras', 'testamento': 'VT', 'capitulos': 10},
            'neemias': {'nome': 'Neemias', 'testamento': 'VT', 'capitulos': 13},
            'ester': {'nome': 'Ester', 'testamento': 'VT', 'capitulos': 10},
            'jo': {'nome': 'Jó', 'testamento': 'VT', 'capitulos': 42},
            'salmos': {'nome': 'Salmos', 'testamento': 'VT', 'capitulos': 150},
            'proverbios': {'nome': 'Provérbios', 'testamento': 'VT', 'capitulos': 31},
            'eclesiastes': {'nome': 'Eclesiastes', 'testamento': 'VT', 'capitulos': 12},
            'cantares': {'nome': 'Cântico dos Cânticos', 'testamento': 'VT', 'capitulos': 8},
            'isaias': {'nome': 'Isaías', 'testamento': 'VT', 'capitulos': 66},
            'jeremias': {'nome': 'Jeremias', 'testamento': 'VT', 'capitulos': 52},
            'lamentacoes': {'nome': 'Lamentações', 'testamento': 'VT', 'capitulos': 5},
            'ezequiel': {'nome': 'Ezequiel', 'testamento': 'VT', 'capitulos': 48},
            'daniel': {'nome': 'Daniel', 'testamento': 'VT', 'capitulos': 12},
            'oseias': {'nome': 'Oséias', 'testamento': 'VT', 'capitulos': 14},
            'joel': {'nome': 'Joel', 'testamento': 'VT', 'capitulos': 3},
            'amos': {'nome': 'Amós', 'testamento': 'VT', 'capitulos': 9},
            'obadias': {'nome': 'Obadias', 'testamento': 'VT', 'capitulos': 1},
            'jonas': {'nome': 'Jonas', 'testamento': 'VT', 'capitulos': 4},
            'miqueias': {'nome': 'Miquéias', 'testamento': 'VT', 'capitulos': 7},
            'naum': {'nome': 'Naum', 'testamento': 'VT', 'capitulos': 3},
            'habacuque': {'nome': 'Habacuque', 'testamento': 'VT', 'capitulos': 3},
            'sofonias': {'nome': 'Sofonias', 'testamento': 'VT', 'capitulos': 3},
            'ageu': {'nome': 'Ageu', 'testamento': 'VT', 'capitulos': 2},
            'zacarias': {'nome': 'Zacarias', 'testamento': 'VT', 'capitulos': 14},
            'malaquias': {'nome': 'Malaquias', 'testamento': 'VT', 'capitulos': 4},
            
            # Novo Testamento
            'mateus': {'nome': 'Mateus', 'testamento': 'NT', 'capitulos': 28},
            'marcos': {'nome': 'Marcos', 'testamento': 'NT', 'capitulos': 16},
            'lucas': {'nome': 'Lucas', 'testamento': 'NT', 'capitulos': 24},
            'joao': {'nome': 'João', 'testamento': 'NT', 'capitulos': 21},
            'atos': {'nome': 'Atos', 'testamento': 'NT', 'capitulos': 28},
            'romanos': {'nome': 'Romanos', 'testamento': 'NT', 'capitulos': 16},
            'corintios1': {'nome': '1 Coríntios', 'testamento': 'NT', 'capitulos': 16},
            'corintios2': {'nome': '2 Coríntios', 'testamento': 'NT', 'capitulos': 13},
            'galatas': {'nome': 'Gálatas', 'testamento': 'NT', 'capitulos': 6},
            'efesios': {'nome': 'Efésios', 'testamento': 'NT', 'capitulos': 6},
            'filipenses': {'nome': 'Filipenses', 'testamento': 'NT', 'capitulos': 4},
            'colossenses': {'nome': 'Colossenses', 'testamento': 'NT', 'capitulos': 4},
            'tessalonicenses1': {'nome': '1 Tessalonicenses', 'testamento': 'NT', 'capitulos': 5},
            'tessalonicenses2': {'nome': '2 Tessalonicenses', 'testamento': 'NT', 'capitulos': 3},
            'timoteo1': {'nome': '1 Timóteo', 'testamento': 'NT', 'capitulos': 6},
            'timoteo2': {'nome': '2 Timóteo', 'testamento': 'NT', 'capitulos': 4},
            'tito': {'nome': 'Tito', 'testamento': 'NT', 'capitulos': 3},
            'filemom': {'nome': 'Filemom', 'testamento': 'NT', 'capitulos': 1},
            'hebreus': {'nome': 'Hebreus', 'testamento': 'NT', 'capitulos': 13},
            'tiago': {'nome': 'Tiago', 'testamento': 'NT', 'capitulos': 5},
            'pedro1': {'nome': '1 Pedro', 'testamento': 'NT', 'capitulos': 5},
            'pedro2': {'nome': '2 Pedro', 'testamento': 'NT', 'capitulos': 3},
            'joao1': {'nome': '1 João', 'testamento': 'NT', 'capitulos': 5},
            'joao2': {'nome': '2 João', 'testamento': 'NT', 'capitulos': 1},
            'joao3': {'nome': '3 João', 'testamento': 'NT', 'capitulos': 1},
            'judas': {'nome': 'Judas', 'testamento': 'NT', 'capitulos': 1},
            'apocalipse': {'nome': 'Apocalipse', 'testamento': 'NT', 'capitulos': 22}
        }
    
    
    def _carregar_estrutura_api(self) -> Optional[Dict]:
        """
        Tenta carregar estrutura da API com múltiplas estratégias
        
        Returns:
            Estrutura da API ou None
        """
        # ESTRATÉGIA 1: Tenta com certifi (certificados atualizados)
        try:
            import certifi
            
            response = requests.get(
                f"{self.api_base}/books",
                proxies=self.proxies if self.proxies else None,
                timeout=10,
                verify=certifi.where()
            )
            
            if response.status_code == 200:
                return self._processar_resposta_api(response.json())
        
        except ImportError:
            print(f"   💡 Dica: instale certifi para melhor suporte SSL")
            print(f"      pip install certifi")
        except Exception as e:
            print(f"   ⚠️  Tentativa 1 falhou: {type(e).__name__}")
        
        # ESTRATÉGIA 2: Tenta sem verificação SSL
        try:
            response = requests.get(
                f"{self.api_base}/books",
                proxies=self.proxies if self.proxies else None,
                timeout=10,
                verify=False
            )
            
            if response.status_code == 200:
                return self._processar_resposta_api(response.json())
        
        except Exception as e:
            print(f"   ⚠️  Tentativa 2 falhou: {type(e).__name__}")
        
        # ESTRATÉGIA 3: Tenta sem proxy
        if self.proxies:
            try:
                print(f"   🔄 Tentando sem proxy...")
                response = requests.get(
                    f"{self.api_base}/books",
                    timeout=10,
                    verify=False
                )
                
                if response.status_code == 200:
                    return self._processar_resposta_api(response.json())
            
            except Exception as e:
                print(f"   ⚠️  Tentativa 3 falhou: {type(e).__name__}")
        
        return None
    
    
    def _processar_resposta_api(self, livros_api: List[Dict]) -> Optional[Dict]:
        """
        Processa resposta da API para nosso formato
        
        Args:
            livros_api: Lista de livros da API
            
        Returns:
            Estrutura formatada ou None
        """
        if not livros_api:
            return None
        
        estrutura = {}
        
        for livro in livros_api:
            abbrev = livro.get('abbrev', {}).get('pt', '').lower()
            
            if abbrev:
                estrutura[abbrev] = {
                    'nome': livro.get('name', ''),
                    'testamento': 'NT' if livro.get('testament') == 'NT' else 'VT',
                    'capitulos': livro.get('chapters', 0)
                }
        
        return estrutura if len(estrutura) >= 60 else None  # Valida se pegou a maioria dos livros
    
    
    def analisar_cobertura(self, pregacoes: List[Dict]) -> Dict:
        """
        Analisa cobertura bíblica das pregações
        
        Args:
            pregacoes: Lista de pregações enriquecidas
            
        Returns:
            Relatório completo de cobertura
        """
        print("\n📊 Analisando cobertura bíblica...")
        
        # Extrai livros pregados
        livros_pregados = set()
        freq_livros = Counter()
        capitulos_pregados = defaultdict(set)
        
        for pregacao in pregacoes:
            meta = pregacao.get('metadados_biblicos', {})
            livro_principal = meta.get('livro_principal')
            
            if livro_principal:
                # Encontra chave canônica
                livro_key = self._encontrar_chave_livro(livro_principal)
                
                if livro_key:
                    livros_pregados.add(livro_key)
                    freq_livros[livro_key] += 1
                    
                    # Extrai capítulos (se disponível)
                    texto_base = meta.get('texto_base', '')
                    if texto_base and ':' in texto_base:
                        try:
                            cap = int(texto_base.split()[1].split(':')[0])
                            capitulos_pregados[livro_key].add(cap)
                        except:
                            pass
        
        # Calcula estatísticas
        total_livros_biblia = len(self.estrutura_biblica)
        livros_nao_pregados = set(self.estrutura_biblica.keys()) - livros_pregados
        
        # Cobertura VT e NT
        livros_vt = {k for k, v in self.estrutura_biblica.items() if v['testamento'] == 'VT'}
        livros_nt = {k for k, v in self.estrutura_biblica.items() if v['testamento'] == 'NT'}
        
        pregados_vt = livros_pregados & livros_vt
        pregados_nt = livros_pregados & livros_nt
        
        # Calcula % de capítulos cobertos
        total_capitulos_biblia = sum(v['capitulos'] for v in self.estrutura_biblica.values())
        capitulos_cobertos = sum(len(caps) for caps in capitulos_pregados.values())
        
        relatorio = {
            'resumo': {
                'total_livros_biblia': total_livros_biblia,
                'livros_pregados': len(livros_pregados),
                'livros_nao_pregados': len(livros_nao_pregados),
                'percentual_cobertura': (len(livros_pregados) / total_livros_biblia) * 100,
                'total_capitulos_biblia': total_capitulos_biblia,
                'capitulos_cobertos': capitulos_cobertos,
                'percentual_capitulos': (capitulos_cobertos / total_capitulos_biblia) * 100
            },
            'por_testamento': {
                'vt': {
                    'total': len(livros_vt),
                    'pregados': len(pregados_vt),
                    'percentual': (len(pregados_vt) / len(livros_vt)) * 100 if livros_vt else 0
                },
                'nt': {
                    'total': len(livros_nt),
                    'pregados': len(pregados_nt),
                    'percentual': (len(pregados_nt) / len(livros_nt)) * 100 if livros_nt else 0
                }
            },
            'livros_pregados': sorted([
                {
                    'livro': self.estrutura_biblica[k]['nome'],
                    'testamento': self.estrutura_biblica[k]['testamento'],
                    'vezes': freq_livros[k],
                    'capitulos_cobertos': len(capitulos_pregados.get(k, [])),
                    'total_capitulos': self.estrutura_biblica[k]['capitulos'],
                    'percentual_caps': (len(capitulos_pregados.get(k, [])) / self.estrutura_biblica[k]['capitulos']) * 100
                }
                for k in livros_pregados
            ], key=lambda x: x['vezes'], reverse=True),
            'livros_nao_pregados': sorted([
                {
                    'livro': self.estrutura_biblica[k]['nome'],
                    'testamento': self.estrutura_biblica[k]['testamento'],
                    'capitulos': self.estrutura_biblica[k]['capitulos']
                }
                for k in livros_nao_pregados
            ], key=lambda x: x['livro'])
        }
        
        print("✅ Análise concluída")
        
        return relatorio
    
    
    def _encontrar_chave_livro(self, nome_livro: str) -> Optional[str]:
        """
        Encontra chave canônica do livro
        
        Args:
            nome_livro: Nome do livro (qualquer variação)
            
        Returns:
            Chave canônica ou None
        """
        nome_lower = nome_livro.lower().strip()
        
        # Busca exata
        for key, info in self.estrutura_biblica.items():
            if info['nome'].lower() == nome_lower:
                return key
        
        # Busca parcial
        for key, info in self.estrutura_biblica.items():
            if nome_lower in info['nome'].lower():
                return key
        
        return None
    
    
    def imprimir_relatorio(self, relatorio: Dict):
        """Imprime relatório formatado"""
        
        print("\n" + "=" * 80)
        print("📖 RELATÓRIO DE COBERTURA BÍBLICA - IBPS (2016-2026)")
        print("=" * 80)
        
        resumo = relatorio['resumo']
        
        print(f"\n🔷 RESUMO GERAL:")
        print(f"   Total de livros na Bíblia: {resumo['total_livros_biblia']}")
        print(f"   Livros pregados: {resumo['livros_pregados']} ({resumo['percentual_cobertura']:.1f}%)")
        print(f"   Livros NÃO pregados: {resumo['livros_nao_pregados']} ({100-resumo['percentual_cobertura']:.1f}%)")
        
        print(f"\n🔷 COBERTURA POR CAPÍTULOS:")
        print(f"   Total de capítulos na Bíblia: {resumo['total_capitulos_biblia']:,}")
        print(f"   Capítulos abordados: {resumo['capitulos_cobertos']:,} ({resumo['percentual_capitulos']:.1f}%)")
        
        vt = relatorio['por_testamento']['vt']
        nt = relatorio['por_testamento']['nt']
        
        print(f"\n🔷 POR TESTAMENTO:")
        print(f"   📜 Antigo Testamento: {vt['pregados']}/{vt['total']} ({vt['percentual']:.1f}%)")
        print(f"   🆕 Novo Testamento: {nt['pregados']}/{nt['total']} ({nt['percentual']:.1f}%)")
        
        print(f"\n🔷 TOP 10 LIVROS MAIS PREGADOS:")
        for i, livro in enumerate(relatorio['livros_pregados'][:10], 1):
            caps = f"{livro['capitulos_cobertos']}/{livro['total_capitulos']} caps ({livro['percentual_caps']:.0f}%)"
            print(f"   {i:2d}. {livro['livro']:25} - {livro['vezes']:3d}x | {caps}")
        
        if relatorio['livros_nao_pregados']:
            print(f"\n❌ LIVROS NÃO PREGADOS ({len(relatorio['livros_nao_pregados'])}):")
            for livro in relatorio['livros_nao_pregados']:
                print(f"   • {livro['livro']:30} ({livro['testamento']}) - {livro['capitulos']} capítulos")
        else:
            print(f"\n🎉 PARABÉNS! TODOS OS 66 LIVROS DA BÍBLIA FORAM PREGADOS!")
        
        print("\n" + "=" * 80)
    
    
    def salvar_relatorio(self, relatorio: Dict, caminho: str = "../../output/relatorio_cobertura_biblica.json"):
        """Salva relatório em JSON"""
        caminho_path = Path(caminho)
        caminho_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(caminho_path, 'w', encoding='utf-8') as f:
            json.dump(relatorio, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Relatório salvo em: {caminho_path.resolve()}")


# ==================== TESTE ====================


if __name__ == "__main__":
    import json
    from pathlib import Path
    
    print("\n" + "=" * 80)
    print("🧪 TESTE DO ANALISADOR DE COBERTURA BÍBLICA")
    print("=" * 80)
    
    # Carrega pregações enriquecidas
    arquivo = Path("../../output/pregacoes_enriquecidas_completo.json")
    
    if arquivo.exists():
        with open(arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        
        pregacoes = dados.get('pregacoes', [])
        
        # Analisa cobertura
        analyzer = BiblicalCoverageAnalyzer()
        relatorio = analyzer.analisar_cobertura(pregacoes)
        
        # Imprime relatório
        analyzer.imprimir_relatorio(relatorio)
        
        # Salva
        analyzer.salvar_relatorio(relatorio)
    
    else:
        print(f"❌ Arquivo não encontrado: {arquivo}")
        print("   Execute primeiro o pipeline.py com opção 4!")
