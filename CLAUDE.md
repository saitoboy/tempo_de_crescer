# Tempo de Crescer — Backend

Banco de dados e API das pregações da IBPS Muriaé (Igreja Batista da Parque Safira).
O produto final é um livro A5 de devocionais, alimentado por uma base curada de pregações
classificadas segundo a Teologia Sistemática de Wayne Grudem.

Blog de origem: https://pregacoesibps.blogspot.com
Canal do YouTube: https://www.youtube.com/@ibps.muriae/streams

---

## Estado atual (o que está sendo substituído)

O repositório hoje é um MVP em Python:

- `blog_scraper_ibps.py` — raspa o blog com BeautifulSoup, gera `pregacoes_<ano>.json`
- `conversor_devocional.py` — converte resenha em devocional via Groq/llama-3.3-70b
- `src/services/*.py` — loader, normalizer, metadata_extractor, thematic_classifier,
  bible_coverage_analyzer, temporal_analyzer, pipeline
- `src/web/app.py`, `deploy_dashboard/` — dashboard Streamlit

Problemas que motivam a reescrita:

1. **Sem banco.** Toda execução re-raspa o blog inteiro e regera todos os JSONs.
2. **Encoding corrompido.** Os JSONs têm mojibake (`informa��o`, `f�`) — a raspagem
   original leu a página com o charset errado. O dado atual não é confiável como fonte.
3. **Sem estado de curadoria.** Não há como corrigir um pregador errado e manter a correção.
4. **Qualidade do devocional.** Groq/llama não entrega texto à altura do produto.

O Python será removido. Antes disso ele serve como referência para portar dois ativos:
o mapa de nomes canônicos de pregadores em `src/services/normalizer.py` e a taxonomia
de Grudem (n-grams, subtemas) em `src/services/thematic_classifier.py`.

---

## Alvo

Backend Node.js + TypeScript + Express + Prisma 7 + PostgreSQL.

Versões em uso: Node 22.21, Prisma 7.9, Express 5.2, TypeScript 7. **Sempre PostgreSQL**
— `@prisma/adapter-pg`. Postgres 17 local via `docker-compose.yml` (`npm run db:up`).

Particularidades do Prisma 7 (o script bash em `CONTEXTO/` está desatualizado nesses pontos):

- O generator é `prisma-client`, não `prisma-client-js`. Saída em `src/generated/prisma`,
  que é gitignored. O import do client é `./generated/prisma/client`, não `@prisma/client`.
- O `datasource` do schema **não leva `url`**. A connection string fica em `prisma.config.ts`.
- O `PrismaClient` exige driver adapter na instanciação — ver `src/connection.ts`.
- Enums do client vêm de `src/generated/prisma/enums`.

TypeScript 7 removeu `moduleResolution: "node"` (node10). O `tsconfig.json` usa
`module`/`moduleResolution: "node16"` com `"type": "commonjs"` no package.json.

O seed fica em `src/seeds/seed.ts`, não em `prisma/seed.ts` — o `rootDir` é `./src` e
o TypeScript não aceita fonte fora dele. O caminho está apontado em `prisma.config.ts`.

O código Python está em `legacy/` e é apagado quando o seed estiver validado.

---

## Decisões tomadas

| Assunto                 | Decisão                                               | Motivo                                              |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Stack                   | Node/TS/Express/Prisma 7/Postgres; Python morre        | Um runtime só; scaffold já existe                 |
| Scraping                | Firecrawl, não BeautifulSoup                          | Markdown limpo, sem o problema de charset           |
| Seed                    | Re-raspar as 956 pregações do zero                   | Os JSONs atuais têm encoding quebrado              |
| Geração do devocional | Claude Code CLI local, em lote                         | Usa a assinatura; a chave de API é cara            |
| Classificação Grudem  | Score relativo ao corpus (z-score / lift)              | Ver seção "Classificação" abaixo                |
| Modelo de dados         | `Culto` e `Resenha` separados                      | A live tem louvor e mais coisas além da pregação |
| Nomenclatura            | O texto do blog é**Resenha**, não "Pregação" | É o que ele é: resenha humana do culto            |
| QR code                 | Aponta para o vídeo do YouTube do culto               | Única URL que já existe; zero infra nova          |
| Pregador ausente        | Fica`null` e entra na fila de PATCH                  | Nunca inventar pregador                             |

---

## Fatos apurados sobre os dados

Sondagem feita sobre os 956 registros existentes (2016–2026):

- **Total:** 956 resenhas. 2025 é o ano mais cheio (130).
- **O pregador fica no FIM da resenha**, em assinatura:
  `...Palavra de Deus, norteando a vida.\nPastor Nélio Monteiro\nIBPS`
  Só 17 das 956 mencionam o pregador nos primeiros 600 caracteres — qualquer parser
  que olhe o começo do texto falha.
- **82 resenhas (8,6%) não têm pregador em lugar nenhum.** São essas que entram na
  fila de PATCH manual.
- **Distribuição:** Nélio Monteiro ~604, Gabriel Monteiro ~90, Ryan Sousa ~25,
  Silvio Farias ~11, Robson Soares ~7, e uma cauda de visitantes.
- **Variações do mesmo nome:** `Ryan Sousa` / `Ryan Souza`, `Silvio Faria` / `Silvio Farias`,
  `Pastor Nélio` / `Pastor Nélio Monteiro`. Exige mapa de aliases → nome canônico.
- **Mesma pessoa muda de título ao longo do tempo:** `Seminarista Gabriel Monteiro`
  vira `Pastor Gabriel Monteiro`. O título é um atributo da época, não da pessoa.
- **O tipo de culto está no início da resenha:** `Resenha do Culto da noite de Domingo\n28/12/2025`.
  Dá para derivar `Culto.tipo` e `Culto.data` do próprio texto, sem depender do YouTube.
- **O texto base está no título:** `Desafios para o novo ano - Lucas 2:41-52`.
- `url_youtube` está vazio em praticamente tudo — o casamento com o canal ainda precisa ser feito.

Cultos acontecem às **quartas**, **domingo de manhã** e **domingo à noite**.

---

## Modelo de dados (rascunho)

```
Culto
  id, data, tipo (QUARTA | DOMINGO_MANHA | DOMINGO_NOITE)
  youtubeVideoId?, youtubeUrl?, tituloLive?
  resenhas[]

Resenha
  id, slug (unique), urlBlog (unique)   <- urlBlog é a chave de deduplicação da ingestão
  titulo, dataPregacao
  conteudoBruto (markdown do Firecrawl), conteudoLimpo
  cultoId?
  pregadorId?                            <- null = fila de PATCH
  pregadorOrigem (ASSINATURA | YOUTUBE | MANUAL)
  textoBase?, livro?, capitulo?, versiculos?
  status (INGERIDA | CLASSIFICADA | REVISADA)

Pregador
  id, nomeCanonico, tipo (PASTOR | SEMINARISTA | VISITANTE | IRMAO)
  aliases[]                              <- resolve Sousa/Souza, Faria/Farias

Doutrina                                 <- seed fixo: as 8 de Grudem
  id, numero (1-8), nome, perguntaCentral

Classificacao
  resenhaId, doutrinaId, papel (PRINCIPAL | SECUNDARIO)
  zscore, densidade, subtemasDetectados (json)

Devocional
  resenhaId (unique), titulo, textoBiblico?, corpo, oracao?
  status (GERADO | REVISADO), modelo, geradoEm
```

**A fila de geração são as resenhas SEM devocional** (`WHERE devocional IS NULL`), não
um status. Por isso `Devocional` não tem `PENDENTE`: linha de devocional só existe quando
há texto de verdade. Menos estado para manter sincronizado.

Fora de escopo por enquanto (YAGNI): `TemaMes`, `Livro`, `PaginaLivro`. Entram na Fase 8.

---

## Classificação (o ponto delicado)

O risco central: **uma pregação pode citar Jesus do começo ao fim sem ser sobre
cristologia.** Contagem absoluta de marcadores classifica errado nesse caso.

O `thematic_classifier.py` v3.1 tenta resolver com TF-IDF + n-grams, mas não resolve,
e tem defeitos concretos:

- `tokens_simples` pontua `freq × idf` de palavras onipresentes (`jesus`, `cristo`,
  `deus`, `senhor`, `fé`). O IDF amortece, mas uma palavra que aparece 40 vezes com
  IDF baixo ainda supera um n-gram raro e preciso.
- `regras_contexto` e o peso `contexto_direcional` estão declarados e **nunca são
  usados**. A desambiguação de "santificação" (Salvação vs. Espírito Santo) e de
  "graça" (Deus vs. Salvação) nunca roda.
- `normalizar_por_tamanho` multiplica **todas** as categorias pelo mesmo fator, então
  não altera o ranking em nada. Só muda o número de confiança exibido.
- `"vida eterna"` aparece na categoria 5 (média) e na 8 (alta) — conta duas vezes.

**Abordagem adotada — score relativo ao corpus:**

1. Densidade por doutrina `d` na resenha `r`:
   `dens(r,d) = soma ponderada dos matches de d em r / número de palavras de r`
2. Sobre o corpus inteiro, calcular média `μ(d)` e desvio padrão `σ(d)` de cada doutrina.
3. `z(r,d) = (dens(r,d) − μ(d)) / σ(d)`
4. Tema principal = maior `z`. Secundários = até 2 doutrinas com `z ≥ 1.0`.
5. Se nenhum `z` passa do mínimo, o tema fica **indefinido** e a resenha entra para
   revisão manual. Não forçar classificação.

Por que isso resolve o caso do usuário: como toda pregação fala de Jesus, `μ(cristologia)`
já é alto. Falar de Jesus o tempo todo produz `z ≈ 0` — é o comportamento normal do corpus,
não sinal. Só o **excesso acima da linha de base** pontua. E continua auditável: dá para
mostrar densidade, média do corpus e desvio de cada decisão.

Efeito colateral bom: com z-score, manter palavras genéricas no vocabulário deixa de ser
problema — elas se anulam sozinhas pela média alta.

**Baseline é global, não por pregador.** Nélio tem 604 resenhas e todos os outros têm
poucas dezenas; baseline por pregador seria estatisticamente frágil. A divisão por
pregador é de **análise** (agregar temas por quem pregou), não de baseline.

---

## Fases

**Fase 1 — Fundação (em andamento)**

- [x] Branch `backend-node`
- [x] Python movido para `legacy/`
- [x] Scaffold Node/TS/Express/Prisma 7/Postgres, typecheck limpo
- [x] Schema modelado, client gerado
- [x] `docker-compose.yml` com Postgres 17
- [x] Seed das 8 doutrinas de Grudem + 8 pregadores com aliases
- [ ] Rodar a primeira migration (precisa do banco de pé)
- [ ] Re-raspar as 956 resenhas com Firecrawl e gravar no banco
- [ ] Validar: contagem por ano bate com os JSONs de `legacy/`, zero mojibake

**Fase 2 — Ingestão incremental**
Job que busca só o que ainda não está no banco (dedupe por `urlBlog`) e insere.
O blog sempre atrasa em relação ao culto; isso é aceito.

**Fase 3 — Pregador**
Parser da assinatura no fim do texto, resolução de aliases para nome canônico,
endpoint `PATCH /resenhas/:id/pregador` para as 82 pendentes.

**Fase 4 — YouTube e QR**
Casar culto com stream do canal por data e horário via YouTube Data API.
Validar/corrigir pregador e data com o título da live. Gerar o QR code
apontando para o vídeo.

**Fase 5 — Classificação Grudem**
Implementar o score relativo, gravar tema principal, secundários e z-score.

**Fase 6 — Devocional**
Fila `Devocional.status = PENDENTE` consumida por um runner local que chama o
Claude Code CLI em lote e grava o resultado. Estilo de escrita: Grudem como referência.

**Fase 7 — Análise**
Endpoints de análise (temas por ano, por pregador, cobertura bíblica, progressão
temporal) e front em Vite + shadcn/ui.

**Fase 8 — Livro**
Temas do mês, seleção manual de quais devocionais entram, diagramação A5.

**Futuro**
Mapa vetorial dos textos bíblicos já pregados, para enxergar a linha teológica e
escatológica da igreja ao longo do tempo.

---

## Variáveis de ambiente

```
PORT=3003
DATABASE_URL="postgresql://user:senha@host:5432/tempo_de_crescer"
FIRECRAWL_API_KEY=
YOUTUBE_API_KEY=
CHANNEL_HANDLE=@ibps.muriae
HTTP_PROXY=      # opcional, rede corporativa
HTTPS_PROXY=
```

---

## Princípios

Vêm do documento original do projeto e valem para o código também:

- Fidelidade bíblica acima de performance técnica.
- Modelagem interpretável, não caixa-preta. Toda classificação precisa ser explicável.
- Automação semi-automática, com revisão humana no circuito.
- Nunca inventar dado ausente. Pregador desconhecido é `null`, não um chute.

## Convenções para agentes

- Ferramentas: internet via **Firecrawl** ou **Playwright**; documentação de biblioteca
  via **Context7**. Não usar WebFetch/WebSearch para isso.
- Nomenclatura de domínio em português (`Resenha`, `Culto`, `Pregador`, `Doutrina`),
  código e chaves em inglês onde for convenção da stack.
- Antes de portar qualquer lógica do `legacy/`, ler o arquivo original — vários mapas
  (aliases de pregador, n-grams de Grudem) são conteúdo curado que não deve ser reescrito
  de memória.
