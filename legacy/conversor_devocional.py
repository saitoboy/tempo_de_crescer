#!/usr/bin/env python3
"""
Conversor INTELIGENTE de Pregações para Devocionais usando Groq API
✅ Sistema de CHECKPOINT: salva progresso e retoma de onde parou
✅ Filtragem por ANO e MÊS
✅ Não reprocessa o que já foi feito
✅ Salva automaticamente quando atinge limite de tokens
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import sys
import hashlib

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

# ==================== CACHE E CHECKPOINT ====================

PASTA_CACHE = ".cache_devocionais"
ARQUIVO_CHECKPOINT = os.path.join(PASTA_CACHE, "checkpoint.json")

def criar_pasta_cache():
    """Cria pasta para cache se não existir"""
    os.makedirs(PASTA_CACHE, exist_ok=True)

def gerar_hash_pregacao(pregacao: Dict) -> str:
    """Gera hash único para uma pregação"""
    conteudo = f"{pregacao.get('titulo', '')}{pregacao.get('data_pregacao', '')}{pregacao.get('conteudo_completo', '')}"
    return hashlib.md5(conteudo.encode()).hexdigest()

def carregar_checkpoint() -> Dict:
    """Carrega checkpoint salvo"""
    if os.path.exists(ARQUIVO_CHECKPOINT):
        try:
            with open(ARQUIVO_CHECKPOINT, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def salvar_checkpoint(checkpoint: Dict):
    """Salva checkpoint atual"""
    criar_pasta_cache()
    with open(ARQUIVO_CHECKPOINT, 'w', encoding='utf-8') as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)

def cache_existe(hash_pregacao: str, checkpoint: Dict) -> bool:
    """Verifica se devocional já foi gerado"""
    return hash_pregacao in checkpoint.get('devocionais', {})

def obter_do_cache(hash_pregacao: str, checkpoint: Dict) -> Optional[str]:
    """Obtém devocional do cache"""
    return checkpoint.get('devocionais', {}).get(hash_pregacao)

def salvar_no_cache(hash_pregacao: str, devocional: str, checkpoint: Dict):
    """Salva devocional no cache"""
    if 'devocionais' not in checkpoint:
        checkpoint['devocionais'] = {}

    checkpoint['devocionais'][hash_pregacao] = devocional
    checkpoint['ultima_atualizacao'] = datetime.now().isoformat()

    salvar_checkpoint(checkpoint)

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

# ==================== FILTROS ====================

def extrair_data_pregacao(pregacao: Dict) -> Optional[datetime]:
    """Extrai data da pregação em vários formatos"""
    data_str = pregacao.get('data_pregacao', '')

    if not data_str:
        return None

    # Formatos possíveis
    formatos = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
        "%d %B %Y",
        "%B %d, %Y"
    ]

    for formato in formatos:
        try:
            return datetime.strptime(data_str, formato)
        except:
            continue

    return None

def filtrar_pregacoes_por_periodo(pregacoes: List[Dict], ano: Optional[int] = None, mes: Optional[int] = None) -> List[Dict]:
    """Filtra pregações por ano e/ou mês"""
    if not ano and not mes:
        return pregacoes

    filtradas = []

    for pregacao in pregacoes:
        data = extrair_data_pregacao(pregacao)

        if not data:
            continue

        if ano and data.year != ano:
            continue

        if mes and data.month != mes:
            continue

        filtradas.append(pregacao)

    return filtradas

def listar_anos_disponiveis(pregacoes: List[Dict]) -> List[int]:
    """Lista anos disponíveis nas pregações"""
    anos = set()

    for pregacao in pregacoes:
        data = extrair_data_pregacao(pregacao)
        if data:
            anos.add(data.year)

    return sorted(list(anos))

def menu_filtro_periodo(pregacoes: List[Dict]) -> List[Dict]:
    """Menu interativo para filtrar período"""
    anos = listar_anos_disponiveis(pregacoes)

    print("\n" + "=" * 80)
    print("📅 FILTRO DE PERÍODO")
    print("=" * 80)

    if not anos:
        print("⚠️  Nenhuma data válida encontrada. Processando todas as pregações.")
        return pregacoes

    print(f"\nAnos disponíveis: {', '.join(map(str, anos))}")
    print("\nOpções:")
    print("  1. Processar TODAS as pregações")
    print("  2. Filtrar por ANO")
    print("  3. Filtrar por ANO e MÊS")

    escolha = input("\n👉 Sua escolha (1-3): ").strip()

    if escolha == '1':
        return pregacoes

    elif escolha == '2':
        ano = input(f"\n   Digite o ano ({min(anos)}-{max(anos)}): ").strip()
        try:
            ano = int(ano)
            filtradas = filtrar_pregacoes_por_periodo(pregacoes, ano=ano)
            print(f"   ✅ {len(filtradas)} pregações encontradas em {ano}")
            return filtradas
        except:
            print("   ❌ Ano inválido!")
            return pregacoes

    elif escolha == '3':
        ano = input(f"\n   Digite o ano ({min(anos)}-{max(anos)}): ").strip()
        mes = input("   Digite o mês (1-12): ").strip()
        try:
            ano = int(ano)
            mes = int(mes)
            filtradas = filtrar_pregacoes_por_periodo(pregacoes, ano=ano, mes=mes)
            meses_nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
            mes_nome = meses_nomes[mes-1] if 1 <= mes <= 12 else str(mes)
            print(f"   ✅ {len(filtradas)} pregações encontradas em {mes_nome}/{ano}")
            return filtradas
        except:
            print("   ❌ Período inválido!")
            return pregacoes

    return pregacoes

# ==================== API GROQ ====================

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

    return None

def criar_cliente_groq(api_key: str, proxy_url: str = None):
    """Cria cliente Groq com ou sem proxy"""
    try:
        if proxy_url:
            http_client = httpx.Client(
                proxy=proxy_url,
                verify=False,
                timeout=120.0
            )
            client = Groq(api_key=api_key, http_client=http_client)
            print("✅ Cliente Groq criado com proxy\n")
        else:
            client = Groq(api_key=api_key)
            print("✅ Cliente Groq criado\n")

        return client
    except Exception as e:
        print(f"❌ Erro ao criar cliente: {e}")
        return None

def gerar_devocional_groq(client, resenha: str, modelo: str = "llama-3.3-70b-versatile") -> Optional[str]:
    """Gera devocional usando Groq API"""
    try:
        prompt = PROMPT_DEVOCIONAL.format(resenha=resenha)

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
        erro_str = str(e).lower()

        # Detecta erro de limite de taxa
        if 'rate_limit' in erro_str or '429' in erro_str or 'limit' in erro_str:
            print(f"      ⚠️  LIMITE DE TOKENS ATINGIDO!")
            return "RATE_LIMIT"

        print(f"      ❌ Erro: {e}")
        return None

# ==================== FUNÇÕES AUXILIARES ====================

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

def gerar_markdown_completo(dados: Dict, devocionais: List[Dict], nome_arquivo: str, periodo_filtrado: str = ""):
    """Gera arquivo Markdown completo com todos os devocionais"""

    mes_ano = extrair_mes_ano(nome_arquivo)
    igreja = dados.get('igreja', 'Igreja')
    pastores = ', '.join(dados.get('pastores', ['Pastor']))
    total = len(devocionais)
    data_geracao = datetime.now().strftime("%d/%m/%Y às %H:%M")

    titulo_periodo = f"{mes_ano} {periodo_filtrado}" if periodo_filtrado else mes_ano

    conteudo = f"""# Devocionais – {titulo_periodo}
{igreja} · {pastores}  
Compilado em: {data_geracao}

---

## 📋 Índice

"""

    for i, dev in enumerate(devocionais, 1):
        pregacao = dev['pregacao']
        titulo = pregacao.get('titulo', 'Sem título')
        conteudo += f"{i}. {formatar_titulo_md(titulo)}\n"

    conteudo += "\n---\n\n"

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

def processar_json_com_checkpoint():
    """Processa JSON com sistema de checkpoint"""

    print("\n" + "=" * 80)
    print("🙏 CONVERSOR INTELIGENTE: PREGAÇÕES → DEVOCIONAIS")
    print("   ✅ Sistema de Checkpoint Ativo")
    print("=" * 80)

    criar_pasta_cache()
    checkpoint = carregar_checkpoint()

    if checkpoint.get('devocionais'):
        total_cache = len(checkpoint['devocionais'])
        print(f"\n📦 {total_cache} devocionais já processados encontrados no cache")

    proxy_url = configurar_proxy()
    api_key = obter_api_key()

    if not api_key:
        print("❌ Chave API necessária!")
        return

    client = criar_cliente_groq(api_key, proxy_url)
    if not client:
        return

    print("📂 Buscando arquivos JSON...")
    arquivos_json = [f for f in os.listdir('.') if f.endswith('.json') and 'pregacoes' in f.lower()]

    if not arquivos_json:
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

    print(f"\n📖 Carregando {caminho_json}...")
    dados = carregar_json(caminho_json)

    if not dados:
        return

    pregacoes_originais = dados.get('pregacoes', [])

    # FILTRO DE PERÍODO
    pregacoes = menu_filtro_periodo(pregacoes_originais)

    total = len(pregacoes)

    if total == 0:
        print("❌ Nenhuma pregação encontrada no período!")
        return

    print(f"\n✅ {total} pregações selecionadas\n")

    print("=" * 80)
    print(f"🚀 PRONTO PARA PROCESSAR {total} PREGAÇÕES")
    print("=" * 80)
    confirma = input("\n❓ Continuar? (s/n): ").strip().lower()

    if confirma != 's':
        print("⏭️  Cancelado pelo usuário")
        return

    print("\n" + "=" * 80)
    print("⚙️  PROCESSANDO PREGAÇÕES...")
    print("=" * 80 + "\n")

    devocionais = []
    erros = 0
    cache_hits = 0
    novos = 0
    limite_atingido = False

    for i, pregacao in enumerate(pregacoes, 1):
        titulo = pregacao.get('titulo', 'Sem título')
        resenha = pregacao.get('conteudo_completo', '')
        hash_preg = gerar_hash_pregacao(pregacao)

        print(f"[{i}/{total}] {titulo}")

        if not resenha:
            print(f"      ⚠️  Sem conteúdo - pulando\n")
            erros += 1
            continue

        # VERIFICA CACHE
        if cache_existe(hash_preg, checkpoint):
            devocional = obter_do_cache(hash_preg, checkpoint)
            devocionais.append({
                'pregacao': pregacao,
                'devocional': devocional
            })
            print(f"      ♻️  Recuperado do cache\n")
            cache_hits += 1
            continue

        # GERA NOVO
        devocional = gerar_devocional_groq(client, resenha)

        if devocional == "RATE_LIMIT":
            print(f"      🛑 Limite de tokens atingido!")
            print(f"      💾 Salvando progresso atual...\n")
            limite_atingido = True
            break

        if devocional:
            # SALVA NO CACHE
            salvar_no_cache(hash_preg, devocional, checkpoint)

            devocionais.append({
                'pregacao': pregacao,
                'devocional': devocional
            })
            print(f"      ✅ Devocional gerado e salvo no cache\n")
            novos += 1
        else:
            print(f"      ❌ Erro ao gerar\n")
            erros += 1

    sucesso = len(devocionais)

    print("\n" + "=" * 80)
    print("📊 RESUMO DO PROCESSAMENTO")
    print("=" * 80)
    print(f"   ✅ Total processado: {sucesso}")
    print(f"   🆕 Novos gerados: {novos}")
    print(f"   ♻️  Do cache: {cache_hits}")
    print(f"   ❌ Erros: {erros}")
    print(f"   📝 Total no período: {total}")

    if limite_atingido:
        print(f"\n   ⚠️  LIMITE DE TOKENS ATINGIDO")
        print(f"   💡 Execute o script novamente para continuar de onde parou!")

    print("=" * 80 + "\n")

    if sucesso == 0:
        print("❌ Nenhum devocional para salvar!")
        return

    print("📝 Gerando arquivo Markdown...\n")

    nome_base = caminho_json.replace('.json', '')
    nome_saida = f"devocionais_{nome_base.replace('pregacoes_', '')}.md"

    conteudo_md = gerar_markdown_completo(dados, devocionais, caminho_json)
    salvar_markdown(conteudo_md, nome_saida)

    print("\n🎉 PROCESSAMENTO CONCLUÍDO!")
    print(f"   📂 Arquivo: {nome_saida}")

    if limite_atingido:
        print(f"\n💡 DICA: Execute novamente para processar o restante!")

# ==================== EXECUÇÃO ====================

if __name__ == "__main__":
    try:
        processar_json_com_checkpoint()
    except KeyboardInterrupt:
        print("\n\n👋 Programa interrompido pelo usuário")
        print("   💾 Progresso salvo no checkpoint!")
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
