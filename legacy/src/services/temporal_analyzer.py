#!/usr/bin/env python3
"""
⏰ TEMPORAL_ANALYZER.PY - Analisador Temporal de Pregações
Analisa progressão temática, ciclos espirituais e evolução ao longo do tempo
"""

import json
from typing import Dict, List, Optional, Tuple
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime
import statistics


class TemporalAnalyzer:
    """Analisador de padrões temporais e espirituais"""
    
    def __init__(self):
        """Inicializa o analisador temporal"""
        
        # Mapeamento de meses para trimestres
        self.trimestres = {
            1: 'Q1', 2: 'Q1', 3: 'Q1',
            4: 'Q2', 5: 'Q2', 6: 'Q2',
            7: 'Q3', 8: 'Q3', 9: 'Q3',
            10: 'Q4', 11: 'Q4', 12: 'Q4'
        }
        
        # Estações espirituais (padrões comuns)
        self.estacoes_espirituais = {
            'Q1': 'Início do ano - Renovação e Compromisso',
            'Q2': 'Primavera - Crescimento e Evangelismo',
            'Q3': 'Meio do ano - Consolidação e Ensino',
            'Q4': 'Final do ano - Gratidão e Esperança'
        }
    
    
    def analisar_progressao_anual(self, pregacoes: List[Dict]) -> Dict:
        """
        Analisa a progressão temática ano a ano
        
        Args:
            pregacoes: Pregações classificadas
            
        Returns:
            Relatório de progressão anual
        """
        print("\n📅 Analisando progressão anual...")
        
        # Agrupa por ano
        por_ano = defaultdict(lambda: {
            'total': 0,
            'temas': Counter(),
            'pregadores': Counter(),
            'livros': Counter(),
            'subtemas': Counter()
        })
        
        for pregacao in pregacoes:
            ano = pregacao.get('ano')
            if not ano:
                continue
            
            por_ano[ano]['total'] += 1
            
            # Tema principal
            classif = pregacao.get('classificacao_tematica', {})
            tema_princ = classif.get('tema_principal', {})
            
            if tema_princ.get('nome'):
                por_ano[ano]['temas'][tema_princ['nome']] += 1
                
                # Subtemas
                for subtema in tema_princ.get('subtemas_detectados', []):
                    por_ano[ano]['subtemas'][subtema] += 1
            
            # Pregador
            pregador = pregacao.get('pregador')
            if pregador:
                por_ano[ano]['pregadores'][pregador] += 1
            
            # Livro bíblico
            meta = pregacao.get('metadados_biblicos', {})
            livro = meta.get('livro_principal')
            if livro:
                por_ano[ano]['livros'][livro] += 1
        
        # Calcula evolução
        anos_ordenados = sorted(por_ano.keys())
        evolucao_temas = self._calcular_evolucao_temas(por_ano, anos_ordenados)
        
        print("✅ Progressão anual calculada")
        
        return {
            'por_ano': {ano: dict(dados) for ano, dados in por_ano.items()},
            'anos_ordenados': anos_ordenados,
            'evolucao_temas': evolucao_temas,
            'total_anos': len(anos_ordenados),
            'periodo': f"{min(anos_ordenados)}-{max(anos_ordenados)}" if anos_ordenados else "N/A"
        }
    
    
    def _calcular_evolucao_temas(self, por_ano: Dict, anos: List[int]) -> Dict:
        """
        Calcula evolução percentual de cada tema ao longo dos anos
        
        Args:
            por_ano: Dados agrupados por ano
            anos: Lista de anos ordenada
            
        Returns:
            Evolução de cada tema
        """
        evolucao = defaultdict(dict)
        
        for ano in anos:
            total = por_ano[ano]['total']
            if total == 0:
                continue
            
            for tema, qtd in por_ano[ano]['temas'].items():
                percentual = (qtd / total) * 100
                evolucao[tema][ano] = {
                    'quantidade': qtd,
                    'percentual': round(percentual, 1)
                }
        
        return dict(evolucao)
    
    
    def identificar_ciclos_espirituais(self, pregacoes: List[Dict]) -> Dict:
        """
        Identifica ciclos espirituais (padrões que se repetem anualmente)
        
        Args:
            pregacoes: Pregações classificadas
            
        Returns:
            Relatório de ciclos identificados
        """
        print("\n🔄 Identificando ciclos espirituais...")
        
        # Agrupa por trimestre (agregado de todos os anos)
        por_trimestre = defaultdict(lambda: {
            'total': 0,
            'temas': Counter(),
            'meses': Counter()
        })
        
        for pregacao in pregacoes:
            data_str = pregacao.get('data_pregacao')
            if not data_str:
                continue
            
            try:
                # Parse da data (formato DD/MM/YYYY)
                dia, mes, ano = map(int, data_str.split('/')[:3])
                trimestre = self.trimestres.get(mes)
                
                if not trimestre:
                    continue
                
                por_trimestre[trimestre]['total'] += 1
                por_trimestre[trimestre]['meses'][mes] += 1
                
                # Tema principal
                classif = pregacao.get('classificacao_tematica', {})
                tema_princ = classif.get('tema_principal', {})
                
                if tema_princ.get('nome'):
                    por_trimestre[trimestre]['temas'][tema_princ['nome']] += 1
            
            except (ValueError, AttributeError):
                continue
        
        # Identifica padrões
        padroes = self._identificar_padroes_trimestrais(por_trimestre)
        
        print("✅ Ciclos identificados")
        
        return {
            'por_trimestre': {
                trim: {
                    'total': dados['total'],
                    'temas_dominantes': dict(dados['temas'].most_common(3)),
                    'distribuicao_meses': dict(dados['meses'])
                }
                for trim, dados in por_trimestre.items()
            },
            'padroes_identificados': padroes,
            'estacoes_espirituais': self.estacoes_espirituais
        }
    
    
    def _identificar_padroes_trimestrais(self, por_trimestre: Dict) -> List[Dict]:
        """
        Identifica padrões recorrentes por trimestre
        
        Args:
            por_trimestre: Dados agrupados por trimestre
            
        Returns:
            Lista de padrões identificados
        """
        padroes = []
        
        for trimestre, dados in sorted(por_trimestre.items()):
            if dados['total'] == 0:
                continue
            
            # Tema mais pregado no trimestre
            temas_top = dados['temas'].most_common(1)
            if temas_top:
                tema_dominante, qtd = temas_top[0]
                percentual = (qtd / dados['total']) * 100
                
                padrao = {
                    'trimestre': trimestre,
                    'descricao': self.estacoes_espirituais.get(trimestre, ''),
                    'tema_dominante': tema_dominante,
                    'frequencia': qtd,
                    'percentual': round(percentual, 1),
                    'interpretacao': self._interpretar_padrao(trimestre, tema_dominante)
                }
                
                padroes.append(padrao)
        
        return padroes
    
    
    def _interpretar_padrao(self, trimestre: str, tema: str) -> str:
        """
        Interpreta o significado espiritual de um padrão
        
        Args:
            trimestre: Trimestre (Q1, Q2, Q3, Q4)
            tema: Tema dominante
            
        Returns:
            Interpretação pastoral
        """
        interpretacoes = {
            ('Q1', 'Doutrina da Salvação'): 'Início do ano com ênfase evangelística',
            ('Q1', 'Doutrina de Cristo'): 'Ano inicia com foco cristocêntrico',
            ('Q4', 'Doutrina das Últimas Coisas'): 'Final do ano com perspectiva escatológica',
            ('Q2', 'Doutrina da Igreja'): 'Primavera com foco comunitário',
            ('Q3', 'Doutrina da Palavra de Deus'): 'Meio do ano com ensino bíblico aprofundado'
        }
        
        chave = (trimestre, tema)
        return interpretacoes.get(chave, f'Ênfase em {tema} durante {self.estacoes_espirituais.get(trimestre, trimestre)}')
    
    
    def analisar_evolucao_tematica(self, pregacoes: List[Dict]) -> Dict:
        """
        Analisa evolução temática comparando períodos
        
        Args:
            pregacoes: Pregações classificadas
            
        Returns:
            Análise comparativa de evolução
        """
        print("\n📈 Analisando evolução temática...")
        
        # Divide em períodos de 5 anos
        anos = [p.get('ano') for p in pregacoes if p.get('ano')]
        if not anos:
            return {}
        
        ano_min = min(anos)
        ano_max = max(anos)
        meio = ano_min + (ano_max - ano_min) // 2
        
        # Primeiro período vs Segundo período
        periodo1 = [p for p in pregacoes if p.get('ano') and ano_min <= p['ano'] <= meio]
        periodo2 = [p for p in pregacoes if p.get('ano') and meio < p['ano'] <= ano_max]
        
        # Conta temas em cada período
        temas_p1 = Counter()
        temas_p2 = Counter()
        
        for p in periodo1:
            tema = p.get('classificacao_tematica', {}).get('tema_principal', {}).get('nome')
            if tema:
                temas_p1[tema] += 1
        
        for p in periodo2:
            tema = p.get('classificacao_tematica', {}).get('tema_principal', {}).get('nome')
            if tema:
                temas_p2[tema] += 1
        
        # Calcula mudanças
        mudancas = self._calcular_mudancas_tematicas(temas_p1, temas_p2, len(periodo1), len(periodo2))
        
        print("✅ Evolução temática calculada")
        
        return {
            'periodo_1': {
                'anos': f"{ano_min}-{meio}",
                'total_pregacoes': len(periodo1),
                'temas': dict(temas_p1.most_common())
            },
            'periodo_2': {
                'anos': f"{meio+1}-{ano_max}",
                'total_pregacoes': len(periodo2),
                'temas': dict(temas_p2.most_common())
            },
            'mudancas_significativas': mudancas
        }
    
    
    def _calcular_mudancas_tematicas(self, temas_p1: Counter, temas_p2: Counter, 
                                     total_p1: int, total_p2: int) -> List[Dict]:
        """
        Calcula mudanças significativas entre períodos
        
        Args:
            temas_p1: Temas do período 1
            temas_p2: Temas do período 2
            total_p1: Total de pregações período 1
            total_p2: Total de pregações período 2
            
        Returns:
            Lista de mudanças significativas
        """
        mudancas = []
        
        todos_temas = set(temas_p1.keys()) | set(temas_p2.keys())
        
        for tema in todos_temas:
            qtd_p1 = temas_p1.get(tema, 0)
            qtd_p2 = temas_p2.get(tema, 0)
            
            perc_p1 = (qtd_p1 / total_p1 * 100) if total_p1 > 0 else 0
            perc_p2 = (qtd_p2 / total_p2 * 100) if total_p2 > 0 else 0
            
            diferenca = perc_p2 - perc_p1
            
            # Considera significativo se mudança >= 3 pontos percentuais
            if abs(diferenca) >= 3.0:
                mudanca = {
                    'tema': tema,
                    'periodo_1': {
                        'quantidade': qtd_p1,
                        'percentual': round(perc_p1, 1)
                    },
                    'periodo_2': {
                        'quantidade': qtd_p2,
                        'percentual': round(perc_p2, 1)
                    },
                    'mudanca_percentual': round(diferenca, 1),
                    'tendencia': 'CRESCEU' if diferenca > 0 else 'DIMINUIU',
                    'interpretacao': self._interpretar_mudanca(tema, diferenca)
                }
                
                mudancas.append(mudanca)
        
        # Ordena por magnitude da mudança
        mudancas.sort(key=lambda x: abs(x['mudanca_percentual']), reverse=True)
        
        return mudancas
    
    
    def _interpretar_mudanca(self, tema: str, diferenca: float) -> str:
        """
        Interpreta o significado espiritual de uma mudança temática
        
        Args:
            tema: Nome do tema
            diferenca: Diferença percentual
            
        Returns:
            Interpretação pastoral
        """
        if diferenca > 5:
            return f"Ênfase crescente em {tema} - possível direcionamento estratégico da liderança"
        elif diferenca < -5:
            return f"Redução significativa em {tema} - pode indicar amadurecimento em outras áreas"
        elif diferenca > 0:
            return f"Crescimento moderado em {tema}"
        else:
            return f"Leve redução em {tema}"
    
    
    def gerar_relatorio_completo(self, pregacoes: List[Dict]) -> Dict:
        """
        Gera relatório temporal completo
        
        Args:
            pregacoes: Pregações classificadas
            
        Returns:
            Relatório consolidado
        """
        print("\n" + "=" * 80)
        print("⏰ GERANDO RELATÓRIO TEMPORAL COMPLETO")
        print("=" * 80)
        
        progressao = self.analisar_progressao_anual(pregacoes)
        ciclos = self.identificar_ciclos_espirituais(pregacoes)
        evolucao = self.analisar_evolucao_tematica(pregacoes)
        
        relatorio = {
            'resumo': {
                'total_pregacoes': len(pregacoes),
                'periodo_analise': progressao.get('periodo', 'N/A'),
                'total_anos': progressao.get('total_anos', 0)
            },
            'progressao_anual': progressao,
            'ciclos_espirituais': ciclos,
            'evolucao_tematica': evolucao
        }
        
        print("\n✅ Relatório temporal completo gerado")
        
        return relatorio
    
    
    def imprimir_relatorio_temporal(self, relatorio: Dict):
        """Imprime relatório formatado"""
        
        print("\n" + "=" * 80)
        print("⏰ RELATÓRIO DE ANÁLISE TEMPORAL - IBPS")
        print("=" * 80)
        
        resumo = relatorio['resumo']
        print(f"\n🔷 RESUMO:")
        print(f"   Total de pregações: {resumo['total_pregacoes']}")
        print(f"   Período: {resumo['periodo_analise']}")
        print(f"   Anos analisados: {resumo['total_anos']}")
        
        # Progressão anual
        progressao = relatorio['progressao_anual']
        print(f"\n🔷 EVOLUÇÃO DOS TOP 3 TEMAS AO LONGO DOS ANOS:")
        
        # Identifica os 3 temas mais pregados no geral
        todos_temas = Counter()
        for ano_dados in progressao['por_ano'].values():
            todos_temas.update(ano_dados['temas'])
        
        top3_temas = [tema for tema, _ in todos_temas.most_common(3)]
        
        for tema in top3_temas:
            print(f"\n   📊 {tema}:")
            evolucao_tema = progressao['evolucao_temas'].get(tema, {})
            
            for ano in progressao['anos_ordenados']:
                dados = evolucao_tema.get(ano, {'quantidade': 0, 'percentual': 0.0})
                barra = '█' * int(dados['percentual'] / 2)
                print(f"      {ano}: {barra} {dados['quantidade']:3d}x ({dados['percentual']:4.1f}%)")
        
        # Ciclos espirituais
        ciclos = relatorio['ciclos_espirituais']
        print(f"\n🔷 CICLOS ESPIRITUAIS (PADRÕES TRIMESTRAIS):")
        
        for padrao in ciclos.get('padroes_identificados', []):
            print(f"\n   🔄 {padrao['trimestre']} - {padrao['descricao']}")
            print(f"      Tema dominante: {padrao['tema_dominante']}")
            print(f"      Frequência: {padrao['frequencia']}x ({padrao['percentual']:.1f}%)")
            print(f"      💡 {padrao['interpretacao']}")
        
        # Evolução temática
        evolucao = relatorio['evolucao_tematica']
        if evolucao:
            print(f"\n🔷 MUDANÇAS TEMÁTICAS SIGNIFICATIVAS:")
            
            p1 = evolucao['periodo_1']
            p2 = evolucao['periodo_2']
            
            print(f"\n   📅 Período 1: {p1['anos']} ({p1['total_pregacoes']} pregações)")
            print(f"   📅 Período 2: {p2['anos']} ({p2['total_pregacoes']} pregações)")
            
            print(f"\n   🔍 Mudanças detectadas:")
            for mudanca in evolucao.get('mudancas_significativas', [])[:5]:
                simbolo = '📈' if mudanca['tendencia'] == 'CRESCEU' else '📉'
                print(f"\n      {simbolo} {mudanca['tema']}:")
                print(f"         {p1['anos']}: {mudanca['periodo_1']['percentual']:4.1f}%")
                print(f"         {p2['anos']}: {mudanca['periodo_2']['percentual']:4.1f}%")
                print(f"         Mudança: {mudanca['mudanca_percentual']:+.1f}pp")
                print(f"         💡 {mudanca['interpretacao']}")
        
        print("\n" + "=" * 80)
    
    
    def salvar_relatorio(self, relatorio: Dict, caminho: str = "../../output/relatorio_temporal.json"):
        """Salva relatório em JSON"""
        caminho_path = Path(caminho)
        caminho_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(caminho_path, 'w', encoding='utf-8') as f:
            json.dump(relatorio, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Relatório temporal salvo em: {caminho_path.resolve()}")


# ==================== TESTE ====================


if __name__ == "__main__":
    import json
    from pathlib import Path
    
    print("\n" + "=" * 80)
    print("🧪 TESTE DO ANALISADOR TEMPORAL")
    print("=" * 80)
    
    # Carrega pregações classificadas (TF-IDF)
    arquivo = Path("../../output/pregacoes_classificadas_tfidf.json")
    
    if arquivo.exists():
        with open(arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        
        pregacoes = dados.get('pregacoes', [])
        
        print(f"\n📚 Carregadas {len(pregacoes)} pregações classificadas")
        
        # Analisa
        analyzer = TemporalAnalyzer()
        relatorio = analyzer.gerar_relatorio_completo(pregacoes)
        
        # Imprime
        analyzer.imprimir_relatorio_temporal(relatorio)
        
        # Salva
        analyzer.salvar_relatorio(relatorio)
    
    else:
        print(f"❌ Arquivo não encontrado: {arquivo}")
        print("   Execute primeiro o thematic_classifier.py v3.0!")
