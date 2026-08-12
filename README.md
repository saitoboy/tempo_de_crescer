<div align="center">

# 🌱 Tempo de Crescer

**O acervo de pregações da Igreja Batista do Parque Safira, virando livro.**

Backend que guarda, cura, classifica e transforma em devocional
quinze anos de pregações — de 2012 a 2026.

[![Node](https://img.shields.io/badge/Node-22-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Testes](https://img.shields.io/badge/testes-84%20passando-3FB950)](#)

</div>

---

## O que é

A igreja publica no blog uma **resenha** de cada culto, escrita à mão por uma
redatora. São quinze anos disso — um patrimônio doutrinário espalhado em 1409
posts, sem busca, sem estrutura e sem memória.

Este projeto transforma esse acervo em base de dados curada, para três coisas:

| | |
|---|---|
| 📖 **Livro** | devocionais diários, diagramados em A5, com QR code para o culto |
| 📊 **Análise** | o que a igreja tem ensinado ao longo do tempo, por doutrina e por pregador |
| 🗺️ **Mapa bíblico** | quais textos já foram pregados, e quais nunca foram |

> *"O que estamos ensinando como igreja, ao longo do tempo?"*
> — a pergunta que originou o projeto

---

## O acervo hoje

<div align="center">

| | | | |
|---:|:---|---:|:---|
| **1.409** | resenhas | **1.026** | cultos |
| **51** | pregadores | **57** | capítulos de Grudem |
| **66** | livros da Bíblia | **31.106** | versículos |

*de 2012 a 2026*

</div>

---

## Começando

```bash
npm install
cp .env.example .env          # preencha DATABASE_URL e ADMIN_*
npm run db:up                 # Postgres 17 no Docker (opcional)
npx prisma migrate deploy     # cria as tabelas
npm run seed                  # doutrinas, subtemas, pregadores, admin
npm run seed:biblia           # Bíblia ACF completa
npm run ingerir               # busca o acervo no blog
npm run dev                   # http://localhost:3003
```

Pronto: a API sobe em `/api/v1` e a documentação interativa fica em
**http://localhost:3003/api/v1/docs**.

---

## Como funciona

```
  blog da igreja                    ┌─────────────┐
  sitemap.xml ──── 1409 posts ─────▶│  ingestão   │  a cada 4h
                                    └──────┬──────┘
                                           │
                    ┌──────────────────────▼──────────────────────┐
                    │  parser: data · turno · pregador · texto     │
                    │  o que não dá para afirmar, fica null        │
                    └──────────────────────┬──────────────────────┘
                                           │
            ┌──────────────┬───────────────┼───────────────┬──────────────┐
            ▼              ▼               ▼               ▼              ▼
        ┌───────┐    ┌──────────┐    ┌──────────┐   ┌────────────┐  ┌──────────┐
        │ Culto │    │ Pregador │    │ Resenha  │   │ Doutrina   │  │  Bíblia  │
        │  QR   │    │  aliases │    │          │   │ 57 subtemas│  │   ACF    │
        └───────┘    └──────────┘    └────┬─────┘   └────────────┘  └──────────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │  Devocional │ ──▶ página do livro
                                   └─────────────┘
```

**O princípio que governa tudo:** nunca inventar. Quando o texto não diz quem
pregou ou em que dia, o campo fica `null` e entra na fila de revisão manual —
em vez de receber um chute que depois vira estatística.

---

## Comandos

| comando | o que faz |
|---|---|
| `npm run dev` | servidor com recarga automática |
| `npm test` | 84 testes |
| `npm run ingerir` | busca no blog o que ainda não está no banco |
| `npm run seed` | doutrinas, subtemas de Grudem, pregadores, admin |
| `npm run seed:biblia` | importa a Bíblia ACF |
| `npm run prisma:studio` | navegador do banco em :5555 |
| `npm run build` | compila para `build/` |

---

## Documentação

| documento | conteúdo |
|---|---|
| [docs/plano.md](docs/plano.md) | as 8 fases, o que está pronto e o que falta |
| [docs/dados.md](docs/dados.md) | o que o acervo ensinou — e as armadilhas |
| [docs/api.md](docs/api.md) | as rotas — ou abra `/api/v1/docs` |
| [docs/operacao.md](docs/operacao.md) | deploy no EasyPanel, variáveis, proxy |
| [CLAUDE.md](CLAUDE.md) | contexto para agentes de IA |

---

## Stack

**Node 22** · **TypeScript 7** · **Express 5** · **Prisma 7** · **PostgreSQL 17**
· **Zod** · **Vitest** · **node-cron** · **undici**

Sem ORM alternativo, sem framework de teste pesado, sem dependência que uma
função de dez linhas resolva. O código roda em um contêiner que sobe populado
e se atualiza sozinho.

---

## Créditos

**Igreja Batista do Parque Safira** — Muriaé, Minas Gerais
Blog: [pregacoesibps.blogspot.com](https://pregacoesibps.blogspot.com)

Pregações de **Pr. Nélio Monteiro**, **Pr. Gabriel Monteiro**, **Pr. Ryan Souza**
e outros 48 pregadores ao longo de quinze anos.
Resenhas redigidas por **Elizabete Lacerda Paulo**.

Bíblia Almeida Corrigida Fiel via [thiagobodruk/biblia](https://github.com/thiagobodruk/biblia).
Taxonomia doutrinária da *Teologia Sistemática* de **Wayne Grudem**.

Desenvolvido por [Guilherme Saito](https://github.com/saitoboy).

<div align="center">

*"Tudo deve ser feito para edificação."* — 1 Coríntios 14:26

</div>
