
#!/usr/bin/env python3
"""
Conversor em Batch de Pregações para Devocionais usando Groq API
Processa um arquivo JSON completo e gera um único arquivo Markdown
"""

import json
import os
from datetime import datetime
from typing import Dict, List
import sys

# ==================== CONFIGURAÇÃO ====================

def carregar_env():
    """Carrega variáveis do arquivo .env"""
    env_path = '.env'
    if os.path.exists(env_path):
        print("📄 Carregando variáveis do arquivo .env...")
        with open(env_path, 'r', encoding='utf-8') as f:
            for linha in f:
                linha = linha.strip()
                if linha and not linha.startswith('#') and '=' in linha:
                    chave, valor = linha.split('=', 1)
                    os.environ[chave.strip()] = valor.strip()
        print("✅ Variáveis carregadas do .env\n")
    else:
        print("⚠️  Arquivo .env não encontrado\n")

carregar_env()

# ==================== IMPORTS ====================

try:
    from groq import Groq
    import httpx
    HAS_GROQ = True
except ImportError:
    print("❌ Bibliotecas não encontradas!")
    print("   Instalando... Execute: pip install groq httpx")
    os.system("pip install groq httpx")
    from groq import Groq
    import httpx
    HAS_GROQ = True

# ==================== PROMPT ====================

PROMPT_DEVOCIONAL = """Você é um Redator Devocional Editorial, especializado em transformar conteúdos informativos em textos devocionais cristãos.

Sua função principal é ler resenhas de pregações e reescrevê-las no formato de devocionais, mantendo a ideia central do texto original, mas adaptando-o para reflexão espiritual e aplicação prática.

Diretrizes de atuação:
- Preserve a mensagem essencial do texto original
- Converta linguagem informativa em linguagem devocional
- Utilize tom pastoral, acolhedor e reflexivo
- Evite clichês religiosos excessivos
- Mantenha profundidade bíblica e claridade teológica
- Não invente doutrinas ou interpretações sem base bíblica

Estrutura padrão do devocional:
1. Título devocional curto e inspirador (formato: TÍTULO EM CAPS)
2. Texto bíblico (se o original não trouxer, escolha um versículo coerente com o tema)
3. Reflexão devocional (reescrita do conteúdo da pregação)
4. Aplicação prática para a vida diária (seção com título "PONTOS DE APLICAÇÃO PRÁTICA")
5. Oração curta e objetiva (seção com título "Oração")

Estilo de escrita:
- Claro, reverente e acessível
- Inspirador sem ser emocionalmente exagerado
- Adequado para leitura diária
- Linguagem respeitosa e contemporânea

Tom de resposta:
- Formal leve e pastoral
- Compassivo e encorajador
- Focado em edificação espiritual

Regras importantes:
- Não cite o texto como "pregação" ou "resenha"
- Não mencione o processo de reescrita
- Entregue sempre o devocional completo e pronto para publicação

RESENHA DA PREGAÇÃO:

{resenha}

Agora, transforme esta resenha em um devocional seguindo exatamente a estrutura acima."""

# ==================== FUNÇÕES ====================

def obter_api_key() -> str:
    """Obtém a chave da API Groq"""
    api_key = os.getenv('GROQ_API_KEY')
    
    if api_key:
        print("✅ Chave GROQ_API_KEY encontrada no .env\n")
        return api_key
    
    print("\n🔑 Chave GROQ_API_KEY não encontrada!")
    print("   📌 Groq é GRATUITO e muito rápido!")
    print("   🌐 Acesse: https://console.groq.com/keys")
    api_key = input("\n   Cole sua chave API aqui: ").strip()
    
    if api_key:
        os.environ['GROQ_API_KEY'] = api_key
        print("   ✅ Chave salva para esta sessão\n")
    
    return api_key


def configurar_proxy():
    """Configura proxy se necessário"""
    proxy_url = os.getenv('HTTP_PROXY') or os.getenv('HTTPS_PROXY')
    
    if proxy_url:
        print(f"🌐 Proxy detectado: {proxy_url}")
        return proxy_url
    
    # Perguntar se precisa de proxy
    usar_proxy = input("\n❓ Você está atrás de um proxy corporativo? (s/n): ").strip().lower()
    
    if usar_proxy == 's':
        host = input("   Host do proxy (ex: 10.10.30.9): ").strip()
        porta = input("   Porta (ex: 3128): ").strip()
        usuario = input("   Usuário (ou Enter para pular): ").strip()
        
        if usuario:
            senha = input("   Senha: ").strip()
            proxy_url = f"http://{usuario}:{senha}@{host}:{porta}"
        else:
            proxy_url = f"http://{host}:{porta}"
        
        os.environ['HTTP_PROXY'] = proxy_url
        os.environ['HTTPS_PROXY'] = proxy_url
        print(f"   ✅ Proxy configurado: {host}:{porta}\n")
        return proxy_url
    
    return None


def criar_cliente_groq(api_key: str, proxy_url: str = None):
    """Cria cliente Groq com ou sem proxy"""
    try:
        if proxy_url:
            # Cliente com proxy
            http_client = httpx.Client(
                proxy=proxy_url,
                verify=False,
                timeout=120.0
            )
            client = Groq(api_key=api_key, http_client=http_client)
            print("✅ Cliente Groq criado com proxy\n")
        else:
            # Cliente sem proxy
            client = Groq(api_key=api_key)
            print("✅ Cliente Groq criado\n")
        
        return client
    except Exception as e:
        print(f"❌ Erro ao criar cliente: {e}")
        return None


def gerar_devocional_groq(client, resenha: str, modelo: str = "llama-3.3-70b-versatile") -> str:
    """
    Gera devocional usando Groq API
    
    Modelos disponíveis:
    - llama-3.3-70b-versatile (recomendado - rápido e preciso)
    - llama-3.1-70b-versatile
    - mixtral-8x7b-32768
    """
    try:
        prompt = PROMPT_DEVOCIONAL.format(resenha=resenha)
        
        print(f"      🤖 Gerando com {modelo}...")
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "Você é um redator devocional cristão especializado em transformar pregações em devocionais edificantes."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model=modelo,
            temperature=0.2,
            max_tokens=2048,
            top_p=0.9
        )
        
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        print(f"      ❌ Erro: {e}")
        return None


def carregar_json(caminho: str) -> Dict:
    """Carrega o arquivo JSON de pregações"""
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Arquivo não encontrado: {caminho}")
        return None
    except json.JSONDecodeError:
        print(f"❌ Erro ao decodificar JSON: {caminho}")
        return None


def formatar_titulo_md(titulo: str) -> str:
    """Formata título para Markdown"""
    return titulo.upper().strip()


def gerar_markdown_completo(dados: Dict, devocionais: List[Dict], nome_arquivo: str):
    """Gera arquivo Markdown completo com todos os devocionais"""
    
    # Extrai metadados
    mes_ano = extrair_mes_ano(nome_arquivo)
    igreja = dados.get('igreja', 'Igreja')
    pastores = ', '.join(dados.get('pastores', ['Pastor']))
    total = len(devocionais)
    data_geracao = datetime.now().strftime("%d/%m/%Y às %H:%M")
    
    # Monta conteúdo
    conteudo = f"""# Devocionais – {mes_ano}
{igreja} · {pastores}  
Compilado em: {data_geracao}

---

## 📋 Índice

"""
    
    # Adiciona índice
    for i, dev in enumerate(devocionais, 1):
        pregacao = dev['pregacao']
        titulo = pregacao.get('titulo', 'Sem título')
        conteudo += f"{i}. {formatar_titulo_md(titulo)}\n"
    
    conteudo += "\n---\n\n"
    
    # Adiciona devocionais
    for i, dev in enumerate(devocionais, 1):
        pregacao = dev['pregacao']
        devocional = dev['devocional']
        
        titulo = pregacao.get('titulo', 'Sem título')
        data = pregacao.get('data_pregacao', 'Data não informada')
        url_blog = pregacao.get('url_blog', '')
        url_youtube = pregacao.get('url_youtube', '')
        pastor = pregacao.get('pastor', dados.get('pastores', [''])[0] if dados.get('pastores') else '')
        
        conteudo += f"""## {i}. {formatar_titulo_md(titulo)}

- **Data:** {data}
"""
        
        if pastor:
            conteudo += f"- **Pastor:** {pastor}\n"
        
        if url_blog:
            conteudo += f"- **Blog:** {url_blog}\n"
        
        if url_youtube:
            conteudo += f"- **YouTube:** {url_youtube}\n"
        
        conteudo += f"\n### Devocional\n\n{devocional}\n\n---\n\n"
    
    # Rodapé
    conteudo += f"""---

*Devocionais gerados automaticamente usando IA (Groq API)*  
*Baseados nas pregações da {igreja}*  
*Total: {total} devocionais*
"""
    
    return conteudo


def extrair_mes_ano(nome_arquivo: str) -> str:
    """Extrai mês e ano do nome do arquivo"""
    nome = nome_arquivo.replace('.json', '').replace('pregacoes_', '')
    
    if nome.isdigit():
        return nome
    
    partes = nome.split('_')
    if len(partes) >= 2:
        mes = partes[0].capitalize()
        ano = partes[1]
        return f"{mes} {ano}"
    
    return nome.capitalize()


def salvar_markdown(conteudo: str, nome_saida: str):
    """Salva o arquivo Markdown"""
    with open(nome_saida, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    
    print(f"\n✅ Arquivo salvo: {nome_saida}")
    print(f"   📄 {len(conteudo)} caracteres")


# ==================== PROCESSAMENTO PRINCIPAL ====================

def processar_json_completo():
    """Processa um arquivo JSON completo e gera Markdown"""
    
    print("\n" + "=" * 80)
    print("🙏 CONVERSOR EM BATCH: PREGAÇÕES → DEVOCIONAIS (GROQ API)")
    print("=" * 80)
    
    # Configurar proxy
    proxy_url = configurar_proxy()
    
    # Obter API key
    api_key = obter_api_key()
    if not api_key:
        print("❌ Chave API necessária!")
        return
    
    # Criar cliente Groq
    client = criar_cliente_groq(api_key, proxy_url)
    if not client:
        print("❌ Não foi possível criar o cliente Groq!")
        return
    
    # Testar conexão
    print("🧪 Testando conexão com Groq API...")
    try:
        test = client.chat.completions.create(
            messages=[{"role": "user", "content": "Olá"}],
            model="llama-3.3-70b-versatile",
            max_tokens=10
        )
        print("✅ Conexão com Groq OK!\n")
    except Exception as e:
        print(f"❌ Falha no teste de conexão: {e}")
        print("   Verifique sua chave API e configurações de proxy\n")
        return
    
    # Buscar arquivos JSON
    print("📂 Buscando arquivos JSON...")
    arquivos_json = [f for f in os.listdir('.') if f.endswith('.json') and 'pregacoes' in f.lower()]
    
    if not arquivos_json:
        print("❌ Nenhum arquivo JSON encontrado!")
        caminho_json = input("\n   Digite o caminho do arquivo JSON: ").strip()
    else:
        print("\nArquivos encontrados:")
        for i, arq in enumerate(arquivos_json, 1):
            print(f"  {i}. {arq}")
        
        escolha = input("\n👉 Escolha o número do arquivo: ").strip()
        
        if escolha.isdigit() and 1 <= int(escolha) <= len(arquivos_json):
            caminho_json = arquivos_json[int(escolha) - 1]
        else:
            caminho_json = escolha
    
    # Carregar JSON
    print(f"\n📖 Carregando {caminho_json}...")
    dados = carregar_json(caminho_json)
    
    if not dados:
        return
    
    pregacoes = dados.get('pregacoes', [])
    total = len(pregacoes)
    
    if total == 0:
        print("❌ Nenhuma pregação encontrada no JSON!")
        return
    
    print(f"✅ {total} pregações encontradas\n")
    
    # Confirmar processamento
    print("=" * 80)
    print(f"🚀 PRONTO PARA PROCESSAR {total} PREGAÇÕES")
    print("=" * 80)
    confirma = input("\n❓ Continuar? (s/n): ").strip().lower()
    
    if confirma != 's':
        print("⏭️  Cancelado pelo usuário")
        return
    
    # Processar cada pregação
    print("\n" + "=" * 80)
    print("⚙️  PROCESSANDO PREGAÇÕES...")
    print("=" * 80 + "\n")
    
    devocionais = []
    erros = 0
    
    for i, pregacao in enumerate(pregacoes, 1):
        titulo = pregacao.get('titulo', 'Sem título')
        resenha = pregacao.get('conteudo_completo', '')
        
        print(f"[{i}/{total}] {titulo}")
        
        if not resenha:
            print(f"      ⚠️  Sem conteúdo - pulando\n")
            erros += 1
            continue
        
        # Gerar devocional
        devocional = gerar_devocional_groq(client, resenha)
        
        if devocional:
            devocionais.append({
                'pregacao': pregacao,
                'devocional': devocional
            })
            print(f"      ✅ Devocional gerado\n")
        else:
            print(f"      ❌ Erro ao gerar\n")
            erros += 1
    
    # Resumo
    sucesso = len(devocionais)
    print("\n" + "=" * 80)
    print("📊 RESUMO DO PROCESSAMENTO")
    print("=" * 80)
    print(f"   ✅ Sucesso: {sucesso}")
    print(f"   ❌ Erros: {erros}")
    print(f"   📝 Total: {total}")
    print("=" * 80 + "\n")
    
    if sucesso == 0:
        print("❌ Nenhum devocional foi gerado!")
        return
    
    # Gerar Markdown
    print("📝 Gerando arquivo Markdown...\n")
    
    nome_base = caminho_json.replace('.json', '')
    nome_saida = f"devocionais_{nome_base.replace('pregacoes_', '')}.md"
    
    conteudo_md = gerar_markdown_completo(dados, devocionais, caminho_json)
    salvar_markdown(conteudo_md, nome_saida)
    
    print("\n🎉 PROCESSAMENTO CONCLUÍDO!")
    print(f"   📂 Arquivo: {nome_saida}")


# ==================== EXECUÇÃO ====================

if __name__ == "__main__":
    try:
        processar_json_completo()
    except KeyboardInterrupt:
        print("\n\n👋 Programa interrompido pelo usuário")
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
