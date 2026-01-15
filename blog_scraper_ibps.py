import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import time
import re
from urllib.parse import urljoin


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
            self.proxies = {
                'http': proxy_url,
                'https': proxy_url
            }
            print(f"🔐 Usando proxy: {proxy_config['host']}:{proxy_config['port']}")

        self.all_pregacoes = {}

    def extrair_anos_disponiveis(self):
        '''Extrai todos os anos disponíveis no blog'''
        try:
            response = requests.get(self.base_url, headers=self.headers, proxies=self.proxies, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            anos = set()

            # Busca por links com padrão /YYYY/
            archive_widget = soup.find('div', {'id': 'BlogArchive1'})
            if archive_widget:
                links = archive_widget.find_all('a', href=True)
                for link in links:
                    match = re.search(r'/(\d{4})/', link['href'])
                    if match:
                        anos.add(int(match.group(1)))

            # Se não encontrou, busca em todos os links
            if not anos:
                all_links = soup.find_all('a', href=re.compile(r'/\d{4}/'))
                for link in all_links:
                    match = re.search(r'/(\d{4})/', link['href'])
                    if match:
                        anos.add(int(match.group(1)))

            # Retorna anos em ordem decrescente (mais recente primeiro)
            return sorted(list(anos), reverse=True)

        except Exception as e:
            print(f'Erro ao extrair anos: {e}')
            return []

    def extrair_posts_do_ano(self, ano):
        '''Extrai todos os posts de um ano específico'''
        try:
            url = f'{self.base_url}/{ano}/'
            print(f'   📡 Acessando: {url}')

            response = requests.get(url, headers=self.headers, proxies=self.proxies, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            posts = []

            # Encontra todos os posts
            posts_divs = soup.find_all('div', class_='post-outer')

            if not posts_divs:
                posts_divs = soup.find_all('article')

            if not posts_divs:
                posts_divs = soup.find_all('div', class_=re.compile('post'))

            print(f'   📄 Encontrados {len(posts_divs)} posts')

            for post_div in posts_divs:
                post_data = self.extrair_dados_post(post_div)
                if post_data:
                    posts.append(post_data)

            return posts

        except Exception as e:
            print(f'Erro ao extrair posts do ano {ano}: {e}')
            return []

    def extrair_dados_post(self, post_div):
        '''Extrai dados de um post individual'''
        try:
            post_data = {}

            # Título
            titulo_elem = post_div.find(['h1', 'h2', 'h3'], class_=re.compile('post-title|entry-title'))
            if titulo_elem:
                post_data['titulo'] = titulo_elem.get_text(strip=True)
                link = titulo_elem.find('a', href=True)
                if link:
                    post_data['url_blog'] = link['href']

            # Data (do HTML - pode ser data de postagem)
            data_elem = post_div.find(['abbr', 'time', 'span'], class_=re.compile('date|timestamp'))
            if data_elem:
                post_data['data_postagem'] = data_elem.get_text(strip=True)

            # Conteúdo (preview)
            conteudo_elem = post_div.find(['div'], class_=re.compile('post-body|entry-content'))
            if conteudo_elem:
                for script in conteudo_elem(['script', 'style']):
                    script.decompose()
                post_data['conteudo_preview'] = conteudo_elem.get_text(separator='\n', strip=True)

            # URL YouTube
            youtube_link = post_div.find('a', href=re.compile(r'youtube\.com|youtu\.be'))
            if youtube_link:
                post_data['url_youtube'] = youtube_link['href']
            else:
                post_data['url_youtube'] = ''

            post_data['tags'] = []

            return post_data if 'titulo' in post_data else None

        except Exception as e:
            print(f'Erro ao extrair dados do post: {e}')
            return None

    def extrair_post_completo(self, url):
        '''Acessa URL individual do post para conteúdo completo'''
        try:
            response = requests.get(url, headers=self.headers, proxies=self.proxies, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            conteudo_elem = soup.find('div', class_=re.compile('post-body|entry-content'))
            if conteudo_elem:
                for script in conteudo_elem(['script', 'style']):
                    script.decompose()
                return conteudo_elem.get_text(separator='\n', strip=True)

            return ''

        except Exception as e:
            print(f'Erro ao extrair post completo de {url}: {e}')
            return ''

    def extrair_data_do_conteudo(self, conteudo):
        '''Extrai a data da pregação do conteúdo (formato DD/MM/YYYY)'''
        if not conteudo:
            return None

        # Procura por padrão DD/MM/YYYY
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

    def reorganizar_por_data(self, posts):
        '''Reorganiza posts por data (Z-A: mais recente primeiro)'''
        # Adiciona objeto datetime para ordenação
        for post in posts:
            data_pregacao = self.extrair_data_do_conteudo(
                post.get('conteudo_completo', '') or post.get('conteudo_preview', '')
            )
            post['data_pregacao_obj'] = data_pregacao

        # Ordena por data (mais recente primeiro)
        # Posts sem data vão para o final
        posts_com_data = [p for p in posts if p['data_pregacao_obj']]
        posts_sem_data = [p for p in posts if not p['data_pregacao_obj']]

        posts_com_data.sort(key=lambda x: x['data_pregacao_obj'], reverse=True)

        # Reorganiza IDs e formata data
        posts_ordenados = posts_com_data + posts_sem_data

        for idx, post in enumerate(posts_ordenados, 1):
            post['id'] = idx
            if post['data_pregacao_obj']:
                post['data_pregacao'] = post['data_pregacao_obj'].strftime('%d/%m/%Y')
            else:
                post['data_pregacao'] = post.get('data_postagem', '')

            # Remove objeto datetime (não serializável em JSON)
            del post['data_pregacao_obj']
            # Remove data de postagem (já temos data_pregacao)
            if 'data_postagem' in post:
                del post['data_postagem']

        return posts_ordenados

    def scrapar_todo_blog(self, extrair_conteudo_completo=True, anos_especificos=None):
        '''Função principal - extrai todo o blog por ano'''
        print('🚀 Iniciando scraping do blog pregacoesibps.blogspot.com...')
        print('='*60)

        # 1. Extrai anos disponíveis
        if anos_especificos:
            anos = anos_especificos
            print(f'\n📅 Anos especificados: {anos}')
        else:
            print('\n📅 Extraindo anos disponíveis...')
            anos = self.extrair_anos_disponiveis()
            print(f'✓ Encontrados {len(anos)} anos: {anos}\n')

        if not anos:
            print('❌ Nenhum ano encontrado!')
            return {}

        # 2. Para cada ano, extrai os posts
        for idx, ano in enumerate(anos):
            print(f'\n📖 [{idx+1}/{len(anos)}] Processando ano: {ano}')
            print('-'*60)

            posts = self.extrair_posts_do_ano(ano)

            if not posts:
                print(f'   ⚠️ Nenhum post encontrado em {ano}')
                continue

            # 3. Busca conteúdo completo
            if extrair_conteudo_completo:
                print(f'   🔄 Extraindo conteúdo completo...')
                for i, post in enumerate(posts):
                    if 'url_blog' in post:
                        titulo_curto = post.get('titulo', '')[:50]
                        print(f'   ⏳ [{i+1}/{len(posts)}] {titulo_curto}...')
                        conteudo = self.extrair_post_completo(post['url_blog'])
                        if conteudo:
                            post['conteudo_completo'] = conteudo
                        time.sleep(1)

            # 4. REORGANIZA por data (Z-A) antes de salvar
            print(f'   🔄 Reorganizando posts por data (Z-A)...')
            posts_ordenados = self.reorganizar_por_data(posts)

            # 5. Organiza dados do ano
            ano_data = {
                'ano': ano,
                'igreja': 'IBPS Muriaé',
                'pastores': ['Nélio Monteiro', 'Ryan Sousa', 'Gabriel Monteiro'],
                'total_pregacoes': len(posts_ordenados),
                'data_compilacao': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'pregacoes': posts_ordenados
            }

            self.all_pregacoes[str(ano)] = ano_data

            # 6. Salva arquivo individual por ano
            filename = f'pregacoes_{ano}.json'
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(ano_data, f, ensure_ascii=False, indent=2)
            print(f'   ✅ Salvo: {filename} ({len(posts_ordenados)} pregações)\n')

            time.sleep(2)

        # 7. Salva consolidado
        print('='*60)
        print('💾 Salvando arquivo consolidado...')
        with open('pregacoes_completo.json', 'w', encoding='utf-8') as f:
            json.dump(self.all_pregacoes, f, ensure_ascii=False, indent=2)

        print(f'\n✅ Scraping concluído!')
        print(f'📊 Total: {len(self.all_pregacoes)} anos processados')
        print(f'📁 Arquivos gerados: {len(self.all_pregacoes) + 1}')

        return self.all_pregacoes


# ============== USO DO SCRIPT ==============
if __name__ == '__main__':
    blog_url = 'https://pregacoesibps.blogspot.com'

    # CONFIGURAÇÃO DE PROXY CORPORATIVO
    proxy_config = {
        'host': 'ip',
        'port': 'porta',
        'user': 'usuario',
        'password': 'senha'
    }

    # Cria scraper com proxy
    scraper = BlogScraperIBPS(blog_url, proxy_config=proxy_config)

    # Executa scraping
    # extrair_conteudo_completo=True: busca conteúdo completo (mais lento)
    # extrair_conteudo_completo=False: apenas preview (mais rápido)
    # anos_especificos=[2025, 2026]: extrai apenas anos específicos
    dados = scraper.scrapar_todo_blog(
        extrair_conteudo_completo=True,
        anos_especificos=None  # None = todos os anos, ou [2025, 2026] para específicos
    )

    print('\n🎉 Processamento finalizado com sucesso!')
