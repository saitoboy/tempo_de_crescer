# 🙏 Tempo de Crescer - Ferramentas para Devocionais

Conjunto de ferramentas para extrair pregações do blog IBPS e convertê-las automaticamente em devocionais usando IA.

## 📦 Ferramentas Incluídas

### 1. **Blog Scraper IBPS** (`blog_scraper_ibps.py`)

Extrai pregações do blog da IBPS Muriaé e salva em arquivos JSON organizados por ano.

### 2. **Conversor de Devocionais** (`conversor_devocional.py`)

Converte pregações (formato JSON) em devocionais formatados (Markdown) usando Groq API.

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/saitoboy/tempo_de_crescer.git
cd tempo_de_crescer

2. Crie um ambiente virtual

# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux/Mac
python3 -m venv .venv
source .venv/bin/activate

3. Instale as dependências
bash
pip install -r requirements.txt

4. Configure as variáveis de ambiente
Copie o arquivo de exemplo e configure:

# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env

Edite o arquivo .env e adicione sua chave da API Groq:
GROQ_API_KEY=sua_chave_aqui

🔑 Obtenha sua chave gratuita em: https://console.groq.com/keys

📖 Como Usar
🕷️ Extrair Pregações do Blog
O blog_scraper_ibps.py extrai todas as pregações do blog e organiza por ano:

python blog_scraper_ibps.py

O que ele faz:

✅ Acessa o blog: https://pregacoesibps.blogspot.com

✅ Extrai informações de todas as pregações

✅ Salva em arquivos JSON separados por ano (pregacoes_2016.json, pregacoes_2025.json, etc.)

✅ Gera também um arquivo completo com tudo (pregacoes_completo.json)

Estrutura do JSON gerado:

{
  "ano": 2025,
  "igreja": "IBPS Muriaé",
  "pastores": ["Pr. Nélio Monteiro", "Pr. Ryan Sousa"],
  "total_pregacoes": 42,
  "pregacoes": [
    {
      "id": 1,
      "titulo": "Título da Pregação",
      "data_pregacao": "01/02/2025",
      "url_blog": "https://...",
      "url_youtube": "https://...",
      "conteudo_completo": "Texto completo da pregação..."
    }
  ]
}


✝️ Converter Pregações em Devocionais
O conversor_devocional.py transforma as pregações em devocionais edificantes:

python conversor_devocional.py


O que ele faz:

✅ Lista todos os arquivos JSON de pregações disponíveis

✅ Permite escolher qual ano processar

✅ Usa IA (Groq API) para transformar em devocionais

✅ Gera arquivo Markdown formatado com todos os devocionais

✅ Suporte a proxy corporativo

Exemplo de uso interativo:


🙏 CONVERSOR EM BATCH: PREGAÇÕES → DEVOCIONAIS (GROQ API)
================================================================================

📂 Buscando arquivos JSON...

Arquivos encontrados:
  1. pregacoes_2016.json
  2. pregacoes_2025.json
  3. pregacoes_2026.json

👉 Escolha o número do arquivo: 2

✅ 42 pregações encontradas

🚀 PRONTO PARA PROCESSAR 42 PREGAÇÕES
❓ Continuar? (s/n): s

[1/42] Santos no Mundo - Colossenses 3:1-7
      🤖 Gerando com llama-3.3-70b-versatile...
      ✅ Devocional gerado

...

📊 RESUMO DO PROCESSAMENTO
   ✅ Sucesso: 42
   ❌ Erros: 0
   📝 Total: 42

✅ Arquivo salvo: devocionais_2025.md



📄 Formato do Output
O conversor gera um arquivo Markdown completo com:

📋 Índice com todas as pregações

✝️ Devocionais formatados com:

Título inspirador

Texto bíblico

Reflexão devocional

Pontos de aplicação prática

Oração

🔗 Links para blog e YouTube (quando disponíveis)

📅 Metadados (data, pastor, igreja)

Exemplo de saída: Ver devocionais_2025.md

⚙️ Configuração de Proxy (Redes Corporativas)
Se você está em uma rede corporativa com proxy, adicione ao arquivo .env:

HTTP_PROXY=http://usuario:senha@proxy.empresa.com:porta
HTTPS_PROXY=http://usuario:senha@proxy.empresa.com:porta


Ou o script perguntará interativamente ao executar.

🎯 Limites da API Groq (Plano Gratuito)
📊 100.000 tokens/dia no plano gratuito

⏰ Limite reseta a cada 24 horas

💡 Dica: Processe em lotes menores se tiver muitas pregações

Se atingir o limite:

Aguarde 24h para resetar

Use modelo mais econômico: llama-3.1-8b-instant

Faça upgrade: https://console.groq.com/settings/billing

📂 Estrutura do Projeto


tempo_de_crescer/
├── blog_scraper_ibps.py       # Extrai pregações do blog
├── conversor_devocional.py    # Converte em devocionais
├── requirements.txt           # Dependências Python
├── .env.example              # Modelo de configuração
├── .gitignore               # Arquivos ignorados pelo Git
├── README.md               # Este arquivo
├── pregacoes_*.json       # JSONs das pregações (gerados)
└── devocionais_*.md      # Devocionais gerados


🛠️ Tecnologias Utilizadas
Python 3.8+

BeautifulSoup4 - Web scraping

Requests - Requisições HTTP

Groq API - IA para gerar devocionais (llama-3.3-70b-versatile)

httpx - Cliente HTTP com suporte a proxy

📝 Exemplos Práticos
Processar apenas 2025

python conversor_devocional.py
# Escolha: 2 (pregacoes_2025.json)


Processar todos os anos
Execute o conversor várias vezes, escolhendo diferentes arquivos, ou modifique o código para processar em loop.

Re-processar pregações que falharam
O script mostra no resumo quantas falharam. Você pode rodar novamente após 24h se atingiu o limite de tokens.

🤝 Contribuindo
Contribuições são bem-vindas! Sinta-se livre para:

Fazer fork do projeto

Criar uma branch para sua feature (git checkout -b feature/NovaFuncionalidade)

Commitar suas mudanças (git commit -m 'Adiciona nova funcionalidade')

Push para a branch (git push origin feature/NovaFuncionalidade)

Abrir um Pull Request

👤 Autor
Guilherme Saito
Coordenador de Inovação | Gerente de Projetos
📍 Muriaé, Minas Gerais, Brasil

GitHub: @saitoboy

LinkedIn: Guilherme Saito

🙏 Créditos
IBPS Muriaé - Igreja Batista da Palavra Santificada

Blog: https://pregacoesibps.blogspot.com

Pastores: Pr. Nélio Monteiro e Pr. Ryan Sousa

📄 Licença
Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

⚠️ Observações
Este projeto é para uso educacional e ministerial

Respeite os limites da API Groq

Sempre revise os devocionais gerados antes de publicar

Os textos originais pertencem aos respectivos autores/pregadores


🆘 Problemas Comuns
Erro de conexão
bash
❌ Erro: Connection error
Solução: Configure o proxy no arquivo .env se estiver em rede corporativa.

Rate limit exceeded
bash
❌ Erro: Rate limit reached
Solução: Aguarde 24h ou use modelo mais econômico (llama-3.1-8b-instant).

Módulo não encontrado
bash
ModuleNotFoundError: No module named 'groq'
Solução: Instale as dependências:

bash
pip install -r requirements.txt
📞 Suporte
Encontrou algum problema ou tem sugestões? Abra uma issue!

<div align="center">
Feito com ❤️ e ☕ para a glória de Deus

⭐ Se este projeto foi útil, considere dar uma estrela!

</div> ```
```
