#!/usr/bin/env python3
"""
🔄 PIPELINE.PY - Pipeline completo de processamento
Orquestra loader + normalizer + metadata_extractor
"""

import json
from pathlib import Path
from datetime import datetime
from loader import PregacoesLoader
from normalizer import PregacoesNormalizer
from metadata_extractor import MetadadosBiblicosExtractor


class PregacoesPipeline:
    """Pipeline completo de processamento"""
    
    def __init__(self, pasta_output: str = "output"):
        """
        Inicializa o pipeline
        
        Args:
            pasta_output: Pasta para salvar resultados
        """
        self.loader = PregacoesLoader()
        self.normalizer = PregacoesNormalizer()
        self.extractor = MetadadosBiblicosExtractor()
        
        # Ajusta caminho do output (relativo ao services)
        self.pasta_output = Path("..") / ".." / pasta_output
        
        # Cria pasta output se não existir
        self.pasta_output.mkdir(parents=True, exist_ok=True)
        
        print(f"📁 Output: {self.pasta_output.resolve()}")
    
    
    def processar_ano(self, ano: int, salvar: bool = True, extrair_metadados: bool = True) -> dict:
        """
        Processa um ano específico
        
        Args:
            ano: Ano a processar
            salvar: Se deve salvar arquivo
            extrair_metadados: Se deve extrair metadados bíblicos
            
        Returns:
            Dicionário com dados normalizados
        """
        print("\n" + "=" * 80)
        print(f"📅 PROCESSANDO ANO {ano}")
        print("=" * 80)
        
        # Carrega dados
        dados = self.loader.carregar_por_ano(ano)
        
        if not dados:
            print(f"❌ Dados do ano {ano} não encontrados")
            return None
        
        # Normaliza
        pregacoes = dados.get('pregacoes', [])
        normalizadas = self.normalizer.normalizar_lote(pregacoes, ano)
        
        # Extrai metadados bíblicos
        if extrair_metadados:
            normalizadas = self.extractor.processar_lote(normalizadas)
        
        # Relatório de normalização
        relatorio_norm = self.normalizer.gerar_relatorio(normalizadas)
        self.normalizer.imprimir_relatorio(relatorio_norm)
        
        # Relatório bíblico
        if extrair_metadados:
            relatorio_biblico = self.extractor.gerar_relatorio_biblico(normalizadas)
            self.extractor.imprimir_relatorio_biblico(relatorio_biblico)
        
        # Prepara resultado
        resultado = {
            'ano': ano,
            'igreja': dados.get('igreja'),
            'pastores': dados.get('pastores'),
            'total_pregacoes': len(normalizadas),
            'data_processamento': datetime.now().isoformat(),
            'pregacoes': normalizadas,
            'relatorio_normalizacao': relatorio_norm,
            'relatorio_biblico': relatorio_biblico if extrair_metadados else None
        }
        
        # Salva
        if salvar:
            sufixo = "_enriquecidas" if extrair_metadados else "_normalizadas"
            arquivo_saida = self.pasta_output / f"pregacoes_{ano}{sufixo}.json"
            self._salvar_json(resultado, arquivo_saida)
        
        return resultado
    
    
    def processar_todos_anos(self, salvar_individual: bool = False, extrair_metadados: bool = True) -> dict:
        """
        Processa TODOS os anos e gera arquivo consolidado
        
        Args:
            salvar_individual: Se deve salvar arquivos por ano também
            extrair_metadados: Se deve extrair metadados bíblicos
            
        Returns:
            Dicionário consolidado
        """
        print("\n" + "=" * 80)
        print("🌍 PROCESSANDO TODOS OS ANOS")
        if extrair_metadados:
            print("📖 COM EXTRAÇÃO DE METADADOS BÍBLICOS")
        print("=" * 80)
        
        # Carrega todos
        todos_dados = self.loader.carregar_todos_anos()
        
        if not todos_dados:
            print("❌ Nenhum dado encontrado")
            return None
        
        todas_normalizadas = []
        relatorios_por_ano = {}
        relatorios_biblicos_por_ano = {}
        
        # Processa cada ano
        for dados in todos_dados:
            ano = dados.get('ano')
            
            if not ano:
                print(f"⚠️  Arquivo sem ano especificado - pulando")
                continue
            
            pregacoes = dados.get('pregacoes', [])
            
            print(f"\n📅 Ano {ano}: {len(pregacoes)} pregações")
            
            # Normaliza
            normalizadas = self.normalizer.normalizar_lote(pregacoes, ano)
            
            # Extrai metadados bíblicos
            if extrair_metadados:
                normalizadas = self.extractor.processar_lote(normalizadas)
            
            todas_normalizadas.extend(normalizadas)
            
            # Relatórios por ano
            relatorio_norm = self.normalizer.gerar_relatorio(normalizadas)
            relatorios_por_ano[ano] = relatorio_norm
            
            if extrair_metadados:
                relatorio_biblico = self.extractor.gerar_relatorio_biblico(normalizadas)
                relatorios_biblicos_por_ano[ano] = relatorio_biblico
            
            # Salva individual se solicitado
            if salvar_individual:
                resultado_ano = {
                    'ano': ano,
                    'igreja': dados.get('igreja'),
                    'pastores': dados.get('pastores'),
                    'total_pregacoes': len(normalizadas),
                    'pregacoes': normalizadas,
                    'relatorio_normalizacao': relatorio_norm,
                    'relatorio_biblico': relatorio_biblico if extrair_metadados else None
                }
                sufixo = "_enriquecidas" if extrair_metadados else "_normalizadas"
                arquivo = self.pasta_output / f"pregacoes_{ano}{sufixo}.json"
                self._salvar_json(resultado_ano, arquivo)
        
        # Relatório consolidado
        print("\n" + "=" * 80)
        print("📊 RELATÓRIO CONSOLIDADO GERAL")
        print("=" * 80)
        
        relatorio_geral = self.normalizer.gerar_relatorio(todas_normalizadas)
        self.normalizer.imprimir_relatorio(relatorio_geral)
        
        if extrair_metadados:
            relatorio_biblico_geral = self.extractor.gerar_relatorio_biblico(todas_normalizadas)
            self.extractor.imprimir_relatorio_biblico(relatorio_biblico_geral)
        
        # Prepara resultado consolidado
        consolidado = {
            'descricao': 'Pregações consolidadas - Todos os anos',
            'igreja': 'IBPS Muriaé',
            'total_pregacoes': len(todas_normalizadas),
            'total_anos': len(relatorios_por_ano),
            'data_processamento': datetime.now().isoformat(),
            'com_metadados_biblicos': extrair_metadados,
            'pregacoes': todas_normalizadas,
            'relatorio_normalizacao': relatorio_geral,
            'relatorio_biblico': relatorio_biblico_geral if extrair_metadados else None,
            'relatorios_por_ano': relatorios_por_ano,
            'relatorios_biblicos_por_ano': relatorios_biblicos_por_ano if extrair_metadados else None
        }
        
        # Salva consolidado
        sufixo = "_enriquecidas" if extrair_metadados else "_normalizadas"
        arquivo_consolidado = self.pasta_output / f"pregacoes{sufixo}_completo.json"
        self._salvar_json(consolidado, arquivo_consolidado)
        
        print(f"\n✅ PROCESSAMENTO COMPLETO!")
        print(f"📦 Total: {len(todas_normalizadas)} pregações processadas")
        print(f"📁 Salvo em: {arquivo_consolidado.resolve()}")
        
        return consolidado
    
    
    def _salvar_json(self, dados: dict, caminho: Path):
        """
        Salva dados em JSON
        
        Args:
            dados: Dicionário a salvar
            caminho: Caminho do arquivo
        """
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        
        tamanho_kb = caminho.stat().st_size / 1024
        print(f"💾 Salvo: {caminho.name} ({tamanho_kb:.1f} KB)")


# ==================== MENU ====================


def menu_principal():
    """Menu interativo do pipeline"""
    
    print("\n" + "=" * 80)
    print("🔄 PIPELINE DE PROCESSAMENTO DE PREGAÇÕES")
    print("=" * 80)
    print("\nOpções:")
    print("  1. Processar um ano específico")
    print("  2. Processar TODOS os anos (consolidado)")
    print("  3. Processar todos + salvar por ano")
    print("  4. Processar TODOS com metadados bíblicos 📖")
    print("  0. Sair")
    print("=" * 80)
    
    pipeline = PregacoesPipeline()
    
    try:
        escolha = input("\n👉 Sua escolha: ").strip()
        
        if escolha == '1':
            ano = int(input("   Digite o ano (2016-2026): "))
            pipeline.processar_ano(ano, extrair_metadados=True)
        
        elif escolha == '2':
            print("\n🚀 Processando TODOS os anos (sem metadados)...")
            pipeline.processar_todos_anos(salvar_individual=False, extrair_metadados=False)
        
        elif escolha == '3':
            print("\n🚀 Processando TODOS os anos + salvando por ano...")
            pipeline.processar_todos_anos(salvar_individual=True, extrair_metadados=False)
        
        elif escolha == '4':
            print("\n🚀 Processando TODOS os anos COM METADADOS BÍBLICOS 📖...")
            pipeline.processar_todos_anos(salvar_individual=True, extrair_metadados=True)
        
        elif escolha == '0':
            print("👋 Até logo!")
        
        else:
            print("❌ Opção inválida!")
    
    except KeyboardInterrupt:
        print("\n\n👋 Cancelado pelo usuário")
    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()


# ==================== TESTE ====================


if __name__ == "__main__":
    menu_principal()
