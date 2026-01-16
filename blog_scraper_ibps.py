import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import time
import re


class BlogScraperIBPS:
    def __init__(self, base_url, proxy_config=None):
        self.base_url = base_url
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # Configuração de proxy
        self.proxies = None
        if proxy_config:
            proxy_url = f"http://{proxy_config['user']}:{proxy_config['password']}@{proxy_config['host']}:{proxy_config['port']}"
            self.proxies = {'http': proxy_url, 'https': proxy_url}
            print(f"🔐 Usando proxy: {proxy_config['host']}:{proxy_config['port']}")
        
        self.all_pregacoes = {}
    
    def extrair_posts_do_mes(self, ano, mes):
        '''Extrai todos os posts de um mês específico usando URL /YYYY/MM/'''
        try:
            # URL simplificada como você indicou
            url = f'{self.base_url}/{ano}/{mes:02d}/'
            print(f'   📡 Acessando: {url}')
            
            response = requests.get(url, headers=self.headers, proxies=self.proxies, timeout=30)
            
            # Se retornar 404, mês não existe
            if response.status_code == 404:
                return []
            
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            posts = []
            
            # Busca posts
            posts_divs = soup.find_all('div', class_='post')
            
            print(f'   📄 Encontrados {len(posts_divs)} posts')
            
            for post_div in posts_divs:
                post_data = self.extrair_dados_post(post_div)
                if post_data:
                    posts.append(post_data)
            
            return posts
        
        except Exception as e:
            print(f'   ⚠️  Erro ao extrair posts de {mes}/{ano}: {e}')
            return []
    
    def extrair_dados_post(self, post_div):
        '''Extrai dados de um post individual'''
        try:
            post_data = {}
            
            # Título
            titulo_elem = post_div.find('h3', class_='post-title')
            if titulo_elem:
                post_data['titulo'] = titulo_elem.get_text(strip=True)
                link = titulo_elem.find('a', href=True)
                if link:
                    post_data['url_blog'] = link['href']
            
            # Conteúdo
            conteudo_elem = post_div.find('div', class_='post-body')
            if conteudo_elem:
                for script in conteudo_elem(['script', 'style']):
                    script.decompose()
                conteudo = conteudo_elem.get_text(separator='\n', strip=True)
                post_data['conteudo_completo'] = conteudo
                
                # Extrair data do conteúdo
                data_pregacao = self.extrair_data_do_conteudo(conteudo)
                if data_pregacao:
                    post_data['data_pregacao'] = data_pregacao.strftime('%d/%m/%Y')
            
            post_data['url_youtube'] = ''
            post_data['tags'] = []
            
            return post_data if 'titulo' in post_data else None
        
        except Exception as e:
            print(f'   ⚠️  Erro ao extrair dados do post: {e}')
            return None
    
    def extrair_data_do_conteudo(self, conteudo):
        '''Extrai a data da pregação do conteúdo'''
        if not conteudo:
            return None
        
        match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', conteudo)
        if match:
            try:
                dia = int(match.group(1))
                mes = int(match.group(2))
                ano = int(match.group(3))
                return datetime(ano, mes, dia)
            except:
                return None
        return None
    
    def scrapar_ano_completo(self, ano):
        '''Extrai todos os posts de um ano (todos os 12 meses)'''
        print(f'\n📖 Processando ano: {ano}')
        print('-'*70)
        
        todos_posts = []
        
        # Itera pelos 12 meses
        for mes in range(1, 13):
            nome_mes = [
                'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
            ][mes - 1]
            
            print(f'\n   📅 Mês: {nome_mes.capitalize()} ({mes}/12)')
            
            posts_mes = self.extrair_posts_do_mes(ano, mes)
            
            if posts_mes:
                print(f'   ✅ {len(posts_mes)} pregações encontradas')
                todos_posts.extend(posts_mes)
            else:
                print(f'   ⚪ Nenhuma pregação')
            
            time.sleep(1)  # Pausa entre requisições
        
        # Reorganiza por data (mais recente primeiro)
        todos_posts = self.reorganizar_por_data(todos_posts)
        
        print(f'\n   🎯 TOTAL {ano}: {len(todos_posts)} pregações')
        
        return todos_posts
    
    def reorganizar_por_data(self, posts):
        '''Reorganiza posts por data'''
        for post in posts:
            if 'data_pregacao' in post:
                try:
                    data_obj = datetime.strptime(post['data_pregacao'], '%d/%m/%Y')
                    post['data_obj'] = data_obj
                except:
                    post['data_obj'] = None
            else:
                post['data_obj'] = None
        
        posts_com_data = [p for p in posts if p.get('data_obj')]
        posts_sem_data = [p for p in posts if not p.get('data_obj')]
        
        posts_com_data.sort(key=lambda x: x['data_obj'], reverse=True)
        
        posts_ordenados = posts_com_data + posts_sem_data
        
        for idx, post in enumerate(posts_ordenados, 1):
            post['id'] = idx
            if 'data_obj' in post:
                del post['data_obj']
        
        return posts_ordenados
    
    def scrapar_blog(self, anos=[2025]):
        '''Função principal'''
        print('🚀 Iniciando scraping do blog pregacoesibps.blogspot.com...')
        print('='*70)
        
        for ano in anos:
            posts = self.scrapar_ano_completo(ano)
            
            if posts:
                ano_data = {
                    'ano': ano,
                    'igreja': 'IBPS Muriaé',
                    'pastores': ['Nélio Monteiro', 'Ryan Sousa', 'Gabriel Monteiro'],
                    'total_pregacoes': len(posts),
                    'data_compilacao': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'pregacoes': posts
                }
                
                self.all_pregacoes[str(ano)] = ano_data
                
                # Salva arquivo individual
                filename = f'pregacoes_{ano}.json'
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(ano_data, f, ensure_ascii=False, indent=2)
                print(f'\n   💾 Salvo: {filename}')
            
            time.sleep(2)
        
        # Salva consolidado
        with open('pregacoes_completo.json', 'w', encoding='utf-8') as f:
            json.dump(self.all_pregacoes, f, ensure_ascii=False, indent=2)
        
        print(f'\n✅ Scraping concluído!')
        print(f'📊 Total: {sum(len(v["pregacoes"]) for v in self.all_pregacoes.values())} pregações')
        
        return self.all_pregacoes


def menu_interativo():
    '''Menu interativo para escolher anos'''
    print('\n' + '='*70)
    print('📖 SCRAPER DE PREGAÇÕES - IBPS MURIAÉ')
    print('='*70)
    print('\nOpções de extração:')
    print('  1. Ano específico (ex: 2025)')
    print('  2. Múltiplos anos (ex: 2023,2024,2025)')
    print('  3. Intervalo de anos (ex: 2020-2025)')
    print('  4. Todos os anos disponíveis')
    print('  0. Sair')
    print('-'*70)
    
    opcao = input('\nEscolha uma opção (0-4): ').strip()
    
    if opcao == '0':
        print('👋 Saindo...')
        return None
    
    elif opcao == '1':
        ano = input('Digite o ano (ex: 2025): ').strip()
        try:
            return [int(ano)]
        except:
            print('❌ Ano inválido!')
            return menu_interativo()
    
    elif opcao == '2':
        anos_str = input('Digite os anos separados por vírgula (ex: 2023,2024,2025): ').strip()
        try:
            anos = [int(a.strip()) for a in anos_str.split(',')]
            return anos
        except:
            print('❌ Anos inválidos!')
            return menu_interativo()
    
    elif opcao == '3':
        intervalo = input('Digite o intervalo (ex: 2020-2025): ').strip()
        try:
            inicio, fim = intervalo.split('-')
            anos = list(range(int(inicio), int(fim) + 1))
            return anos
        except:
            print('❌ Intervalo inválido!')
            return menu_interativo()
    
    elif opcao == '4':
        # Anos do blog (baseado na imagem que você enviou)
        anos_disponiveis = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
        print(f'\n📅 Anos disponíveis: {anos_disponiveis}')
        confirma = input('Deseja extrair TODOS esses anos? (s/n): ').strip().lower()
        if confirma == 's':
            return anos_disponiveis
        else:
            return menu_interativo()
    
    else:
        print('❌ Opção inválida!')
        return menu_interativo()


# ============== USO ==============
if __name__ == '__main__':
    blog_url = 'https://pregacoesibps.blogspot.com'
    
    proxy_config = {
        'host': '10.10.30.9',
        'port': '3128',
        'user': 'guilherme.saito',
        'password': '@159357gS'
    }
    
    # OPÇÃO 1: Menu interativo
    anos_escolhidos = menu_interativo()
    
    if anos_escolhidos:
        scraper = BlogScraperIBPS(blog_url, proxy_config=proxy_config)
        dados = scraper.scrapar_blog(anos=anos_escolhidos)
        print('\n🎉 Processamento finalizado!')
    
    # ============================================
    # OPÇÃO 2: Definir direto no código (comentado)
    # ============================================
    # scraper = BlogScraperIBPS(blog_url, proxy_config=proxy_config)
    # 
    # # Exemplo 1: Um ano específico
    # dados = scraper.scrapar_blog(anos=[2025])
    # 
    # # Exemplo 2: Múltiplos anos
    # dados = scraper.scrapar_blog(anos=[2023, 2024, 2025])
    # 
    # # Exemplo 3: Intervalo
    # dados = scraper.scrapar_blog(anos=list(range(2020, 2026)))  # 2020 até 2025
