#!/usr/bin/env python3
"""
📂 LOADER.PY - Carregador de Pregações
Carrega JSONs de pregações (individual ou completo)
"""

import json
import os
from typing import Dict, List, Optional
from pathlib import Path


class PregacoesLoader:
    """Carregador inteligente de arquivos JSON de pregações"""
    
    def __init__(self, pasta_data: str = None):
        """
        Inicializa o loader
        
        Args:
            pasta_data: Pasta onde estão os arquivos JSON (None = busca automática)
        """
        if pasta_data:
            self.pasta_data = Path(pasta_data)
        else:
            # 🔍 BUSCA AUTOMÁTICA
            self.pasta_data = self._encontrar_pasta_data()
        
        print(f"📂 Usando pasta: {self.pasta_data}")
    
    
    def _encontrar_pasta_data(self) -> Path:
        """
        Encontra automaticamente a pasta com os JSONs
        
        Returns:
            Path da pasta encontrada
        """
        # Opções de busca (em ordem de prioridade)
        opcoes = [
            Path("src/data"),           # Estrutura do projeto
            Path("data"),               # Pasta data na raiz
            Path("../data"),            # data um nível acima
            Path("."),                  # Pasta atual
        ]
        
        for pasta in opcoes:
            if pasta.exists():
                # Verifica se tem arquivos JSON de pregações
                arquivos = list(pasta.glob("*pregacoes*.json"))
                if arquivos:
                    return pasta
        
        # Se não encontrou, usa pasta atual
        print("⚠️  Pasta 'data' não encontrada. Usando pasta atual.")
        return Path(".")
    
    
    def listar_arquivos_disponiveis(self) -> List[str]:
        """
        Lista todos os arquivos JSON de pregações disponíveis
        
        Returns:
            Lista com nomes dos arquivos
        """
        arquivos = []
        
        # Busca arquivos .json que contenham 'pregacoes' no nome
        padroes = ["*pregacoes*.json", "pregacoes_*.json"]
        
        for padrao in padroes:
            for arquivo in self.pasta_data.glob(padrao):
                caminho = str(arquivo)
                if caminho not in arquivos:
                    arquivos.append(caminho)
        
        return sorted(arquivos)
    
    
    def carregar_arquivo(self, caminho: str) -> Optional[Dict]:
        """
        Carrega um arquivo JSON específico
        
        Args:
            caminho: Caminho do arquivo JSON
            
        Returns:
            Dicionário com os dados ou None em caso de erro
        """
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            
            nome_arquivo = Path(caminho).name
            
            print(f"✅ {nome_arquivo}")
            print(f"   📊 {dados.get('total_pregacoes', '?')} pregações")
            print(f"   📅 Ano: {dados.get('ano', 'não especificado')}")
            
            return dados
            
        except FileNotFoundError:
            print(f"❌ Arquivo não encontrado: {caminho}")
            return None
            
        except json.JSONDecodeError as e:
            print(f"❌ Erro ao decodificar JSON: {e}")
            return None
            
        except Exception as e:
            print(f"❌ Erro inesperado: {e}")
            return None
    
    
    def carregar_todos_anos(self) -> List[Dict]:
        """
        Carrega TODOS os arquivos de pregações encontrados
        
        Returns:
            Lista com dados de todos os arquivos
        """
        arquivos = self.listar_arquivos_disponiveis()
        
        if not arquivos:
            print("❌ Nenhum arquivo de pregações encontrado!")
            return []
        
        print(f"\n📂 Encontrados {len(arquivos)} arquivos\n")
        
        todos_dados = []
        
        for arquivo in arquivos:
            dados = self.carregar_arquivo(arquivo)
            if dados:
                todos_dados.append(dados)
        
        total_pregacoes = sum(d.get('total_pregacoes', 0) for d in todos_dados)
        
        print("\n" + "=" * 80)
        print(f"✅ RESUMO: {len(todos_dados)} arquivos carregados")
        print(f"📊 Total geral: {total_pregacoes} pregações")
        print("=" * 80)
        
        return todos_dados
    
    
    def carregar_por_ano(self, ano: int) -> Optional[Dict]:
        """
        Carrega pregações de um ano específico
        
        Args:
            ano: Ano desejado (ex: 2016)
            
        Returns:
            Dados do ano ou None se não encontrado
        """
        arquivos = self.listar_arquivos_disponiveis()
        
        for arquivo in arquivos:
            if str(ano) in arquivo:
                return self.carregar_arquivo(arquivo)
        
        print(f"❌ Arquivo do ano {ano} não encontrado")
        return None
    
    
    def consolidar_todas_pregacoes(self) -> List[Dict]:
        """
        Consolida TODAS as pregações de todos os arquivos em uma única lista
        
        Returns:
            Lista unificada com todas as pregações
        """
        todos_dados = self.carregar_todos_anos()
        
        if not todos_dados:
            return []
        
        pregacoes_consolidadas = []
        
        for dados in todos_dados:
            ano = dados.get('ano')
            igreja = dados.get('igreja')
            pregacoes = dados.get('pregacoes', [])
            
            # Adiciona metadados do arquivo em cada pregação
            for pregacao in pregacoes:
                pregacao['_ano_arquivo'] = ano
                pregacao['_igreja'] = igreja
                pregacoes_consolidadas.append(pregacao)
        
        print(f"\n📦 Consolidadas: {len(pregacoes_consolidadas)} pregações")
        
        return pregacoes_consolidadas
    
    
    def menu_interativo(self) -> Optional[Dict]:
        """
        Menu interativo para escolher o arquivo
        
        Returns:
            Dados escolhidos pelo usuário
        """
        arquivos = self.listar_arquivos_disponiveis()
        
        if not arquivos:
            print("❌ Nenhum arquivo encontrado!")
            return None
        
        print("\n" + "=" * 80)
        print("📂 ARQUIVOS DISPONÍVEIS")
        print("=" * 80)
        
        for i, arquivo in enumerate(arquivos, 1):
            nome = Path(arquivo).name
            print(f"  {i}. {nome}")
        
        print(f"  {len(arquivos) + 1}. 🌍 TODOS OS ANOS (consolidado)")
        
        print("=" * 80)
        
        try:
            escolha = input("\n👉 Escolha o número: ").strip()
            escolha_num = int(escolha)
            
            # Opção: TODOS
            if escolha_num == len(arquivos) + 1:
                print("\n⚙️  Carregando TODOS os arquivos...\n")
                pregacoes = self.consolidar_todas_pregacoes()
                
                return {
                    'modo': 'consolidado',
                    'total_pregacoes': len(pregacoes),
                    'pregacoes': pregacoes
                }
            
            # Opção: arquivo específico
            elif 1 <= escolha_num <= len(arquivos):
                arquivo = arquivos[escolha_num - 1]
                return self.carregar_arquivo(arquivo)
            
            else:
                print("❌ Opção inválida!")
                return None
                
        except ValueError:
            print("❌ Digite um número válido!")
            return None
        except KeyboardInterrupt:
            print("\n\n👋 Cancelado pelo usuário")
            return None


# ==================== FUNÇÕES AUXILIARES ====================


def carregar_simples(caminho: str) -> Optional[Dict]:
    """
    Função simples para carregar um JSON
    
    Args:
        caminho: Caminho do arquivo
        
    Returns:
        Dados do JSON
    """
    loader = PregacoesLoader()
    return loader.carregar_arquivo(caminho)


def carregar_todos() -> List[Dict]:
    """
    Carrega todos os JSONs encontrados
    
    Returns:
        Lista com pregações consolidadas
    """
    loader = PregacoesLoader()
    return loader.consolidar_todas_pregacoes()


# ==================== TESTE ====================


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("🧪 TESTE DO LOADER")
    print("=" * 80)
    
    loader = PregacoesLoader()
    
    # Teste: menu interativo
    dados = loader.menu_interativo()
    
    if dados:
        print("\n✅ Dados carregados com sucesso!")
        print(f"📊 Total de pregações: {dados.get('total_pregacoes')}")
