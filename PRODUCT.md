# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Backend existente: Node 22 · TypeScript 7 · Express 5 · Prisma 7 · PostgreSQL 17.

Front decidido pelo usuário: **Vite + React + TypeScript + Tailwind + shadcn/ui**,
com manifest para instalação na tela inicial do iPhone. **Projeto separado**, em
`D:\tempo-de-crescer\front-tempo_de_crescer`, irmão do backend.

## Users

Equipe interna da IBPS Muriaé — pastor, líderes e o mantenedor do projeto. Três
papéis já existem no banco: `ADMIN` (escreve), `PASTOR` e `LIDER` (leem).

**Não há público externo.** Membro da igreja não entra: o produto para ele é o
livro impresso, não o app. Toda tela exige login.

Duas situações de uso, confirmadas pelo usuário como igualmente reais:

- **Celular, em pé, minutos soltos** — conferir pendências, corrigir um pregador,
  ver como está a fila de devocionais.
- **Desktop, sessão longa** — análise doutrinária, curadoria em lote, montagem do
  mês do livro.

## Product Purpose

Transformar 1.409 resenhas de pregações da igreja (2012–2026) em um livro A5 de
devocionais, com curadoria humana no circuito. O front é a interface dessa
curadoria: revisar o que a ingestão automática não completou, enxergar a linha
teológica do púlpito e montar os meses do livro.

Sucesso: o pastor decide o conteúdo do livro olhando dado, não memória; e a fila
de pendências chega a zero sem ninguém abrir o Swagger.

## Positioning

Um acervo de pregação de uma igreja específica, classificado pela Teologia
Sistemática de Grudem com score relativo ao corpus e auditável em cada decisão
(z-score e densidade guardados). Nenhum produto genérico de gestão de igreja tem
isso, porque depende deste acervo e desta curadoria.

## Operating Context

- Backend em produção no EasyPanel; Postgres em serviço separado.
- Rede corporativa com proxy autenticado no ambiente de desenvolvimento.
- Geração de devocionais roda **local**, por CLI, em lote longo — não é operação
  do front. O front observa o progresso, não dispara.
- O produto final sai em PDF (A5) e `.idml` para o designer refinar no InDesign.

## Capabilities and Constraints

API v1 já pronta em `http://host/api/v1`, documentada em `docs/api.md` e no
Swagger (`/api/v1/docs`), gerada dos mesmos esquemas Zod que validam as rotas:

| recurso | rotas |
|---|---|
| sessão | `POST /sessao/login` · `GET /sessao/eu` |
| análise | `/analise/panorama` `/doutrinas` `/evolucao` `/pregadores` `/biblia` |
| resenhas | `GET /resenhas` `/pendentes` `/:id` · `PATCH /:id` 🔒 |
| cultos | `GET /cultos` · `GET /cultos/:id/qrcode.svg` |
| pregadores | `GET /` · `POST /` 🔒 · `POST /:id/fundir` 🔒 |
| temas | 8 rotas: CRUD do mês, sugestões, páginas, ordem |
| livro | `/livro/paginas` `/paginas/:id` `/imprimir.html` `/livro.idml` |

Restrições confirmadas:

- **Leitura hoje é aberta** (herança da fase pública) e precisa fechar, já que o
  app é interno. Decisão registrada no plano do front.
- Escrita exige `ADMIN`. `API_TOKEN` único ainda é aceito e deve sumir quando o
  front estiver de pé.
- Enums de domínio (`turno`, `natureza`, tipos de pregador) só existem em Zod no
  servidor; o front não pode duplicá-los à mão.
- Correção manual **nunca inventa pregador**: nome fora dos aliases é recusado
  pelo servidor com sugestão. O front mostra a sugestão, não decide.

## Brand Commitments

- Nome: **Tempo de Crescer**. Igreja: IBPS Muriaé.
- Nomenclatura de domínio em português (`Resenha`, `Culto`, `Pregador`,
  `Doutrina`, `Devocional`).
- Referências visuais fixadas pelo usuário em `CONTEXTO/front-end (4..15).png`.
  São vinculantes: definem tipografia, paleta, forma dos cards e a linguagem dos
  gráficos.
- Grudem classifica, Tozer escreve. São papéis distintos e não se misturam.

## Evidence on Hand

Dado real, no banco, nada inventado:

- 1.409 resenhas · 1.026 cultos · 51 pregadores · período 2012–2026
- 620 cultos com vídeo do YouTube e QR code em SVG guardado
- 1.138 resenhas classificadas, 271 indefinidas
- 40 resenhas sem pregador · 297 sem data
- 57 dos 66 livros bíblicos já pregados
- Devocionais em geração contínua por CLI local — 56 prontos até agora, dos 1.409

O que **não** existe e não pode ser fabricado: nota de leitor, métrica de
engajamento, contagem de membros, qualquer número de audiência.

## Product Principles

1. Fidelidade bíblica acima de performance técnica.
2. Toda classificação precisa ser explicável — z-score e densidade à vista.
3. Automação semi-automática, com revisão humana no circuito.
4. Nunca inventar dado ausente. Pregador desconhecido é `null`, não um chute.
5. O servidor é a autoridade. O front exibe e pede; não decide regra de domínio.

## Accessibility & Inclusion

Uso real inclui pastor lendo no celular, muitas vezes fora de casa e com pouca
luz de tela. Texto e número precisam de contraste real — a paleta pastel das
referências não pode virar texto claro sobre fundo claro.
