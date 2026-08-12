# Operação

## Variáveis de ambiente

O `.env` é validado por Zod na partida: faltar `DATABASE_URL` ou escrever um
cron inválido derruba o processo **agora**, com mensagem clara, em vez de
falhar quatro horas depois no meio de uma execução agendada.

| variável | padrão | para quê |
|---|---|---|
| `PORT` | `3003` | |
| `TZ` | `America/Sao_Paulo` | |
| `DATABASE_URL` | — | **obrigatória**, precisa começar com `postgresql://` |
| `CRON_INGESTAO` | `0 */4 * * *` | `off` desliga o agendamento |
| `API_TOKEN` | — | rotas de escrita; sem ele, escrever fica bloqueado |
| `ADMIN_EMAIL` / `ADMIN_SENHA` | — | admin criado pelo seed |
| `ADMIN_NOME` | `Administrador` | |
| `YOUTUBE_API_KEY` | — | Fase 4 |
| `CHANNEL_HANDLE` | `@ibps.muriae` | |
| `PROXY_HOST` / `PORT` / `USER` / `PASS` | — | rede corporativa |

> ⚠️ **`.env.example` é versionado.** Senha escrita nele vai para o
> repositório. Os valores reais ficam no `.env`, que é ignorado, e no painel do
> EasyPanel.

### Senha com caractere especial

Na `DATABASE_URL`, senha com `@ : / # ? %` precisa ser escapada:

| caractere | escrever como |
|---|---|
| `@` | `%40` |
| `:` | `%3A` |
| `/` | `%2F` |
| `#` | `%23` |
| `?` | `%3F` |
| `%` | `%25` |

O **proxy** não tem esse problema: as variáveis são em componentes
(`PROXY_HOST`, `PROXY_USER`, `PROXY_PASS`) justamente porque uma senha
começando com `@` quebra a forma `http://user:pass@host:port`.

---

## Proxy corporativo

A rede exige proxy autenticado; sem ele, chamadas externas voltam **407**.
Qualquer script que use rede chama `aplicarProxy()` antes do primeiro `fetch`.

Dois detalhes que custaram tempo:

- O `ProxyAgent` do undici **não lê credenciais embutidas na URI** — precisa do
  header `Proxy-Authorization`. E o Basic usa a **senha crua**, não a versão
  escapada da URL.
- A flag `--use-env-proxy` do Node não serve: lê o ambiente no boot, antes de o
  dotenv carregar o `.env`.

O MCP do Firecrawl não passa pelo proxy e por isso falha aqui — as chamadas ao
Firecrawl saem do nosso próprio código.

---

## Deploy no EasyPanel

Um serviço **PostgreSQL** e uma aplicação apontando para o `Dockerfile`.
`DATABASE_URL` usa o **nome do serviço de banco** como host, não `localhost`.

### O contêiner sobe populado

Sem passo manual. Na partida:

1. `prisma migrate deploy` aplica as migrations
2. `seed.js` grava doutrinas, os 57 subtemas de Grudem, pregadores e o admin
3. `biblia.js` importa a ACF — e **pula** quando os 31.106 versículos já estão lá
4. o servidor sobe e dispara a ingestão **em segundo plano**

A ingestão fica fora do caminho do boot de propósito: se o blog ou o proxy
estiverem fora, o servidor sobe assim mesmo.

Num banco vazio, `ingerirNovos()` considera todas as 1.409 como novas e carrega
o acervo inteiro. Num banco cheio, não baixa nada. É a mesma função da
atualização diária.

### Validado de verdade

| cenário | resultado |
|---|---|
| banco vazio | migrations, seeds, Bíblia e 1.409 resenhas em **4 minutos** |
| restart | **5 segundos**, sem pendência, sem duplicar, senha do admin preservada |

### Detalhes que não podem ser desfeitos

- O generator do Prisma 7 precisa de `moduleFormat = "cjs"`. Sem isso o client
  sai em ESM, usa `import.meta`, e o build compilado quebra com `node`. **O tsx
  disfarça em desenvolvimento — o erro só aparece no contêiner.**
- O estágio de build define um `DATABASE_URL` de mentira: o `prisma.config.ts`
  exige a variável só para carregar, e `generate` não conecta em banco nenhum.
- `prisma generate` roda **depois** de copiar o `src`, porque o client é gerado
  dentro de `src/generated`.
- O CLI do Prisma fica na imagem final de propósito — é ele que aplica as
  migrations na partida. Por isso as dependências não são podadas.

---

## Ingestão

```bash
npm run ingerir    # busca no blog o que ainda não está no banco
```

Roda sozinha a cada 4 horas. A publicação no blog é **manual** e a janela é
larga: o culto de quarta à noite costuma aparecer na quinta de manhã, e o de
domingo pode sair até as 20h da segunda.

Insistir sai mais barato — e mais simples — do que acertar o horário: cada
passada custa duas requisições ao sitemap e uma consulta ao banco, e só baixa o
que ainda não está gravado.

Uma execução não começa enquanto a anterior não termina, e erro na ingestão não
derruba o servidor.

---

## Comandos

| comando | o que faz |
|---|---|
| `npm run dev` | servidor com recarga automática |
| `npm run build` / `npm start` | compila e roda o build |
| `npm test` | 84 testes |
| `npm run typecheck` | só a checagem de tipos |
| `npm run ingerir` | ingestão incremental |
| `npm run seed` | doutrinas, subtemas, pregadores, admin |
| `npm run seed:biblia` | Bíblia ACF (`--forcar` recarrega) |
| `npm run seed:resenhas` | recarrega do cache em disco |
| `npm run baixar:posts` | cache local dos 1.409 posts |
| `npm run prisma:studio` | navegador do banco em `:5555` |
| `npm run db:up` / `db:down` | Postgres 17 no Docker |

---

## Migrations

`prisma migrate dev` exige terminal interativo e não roda por aqui. O caminho é
gerar o SQL e aplicar:

```bash
mkdir -p prisma/migrations/AAAAMMDDHHMMSS_nome
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
  > prisma/migrations/AAAAMMDDHHMMSS_nome/migration.sql
npx prisma migrate deploy
npx prisma generate
```

Depois de mudar enum ou model, **regenerar o client** — senão o typecheck
acusa campos que já existem no banco.

---

## Logs

Barra de progresso que se adapta ao destino: **animada no terminal**, marcos de
25% no log do contêiner. Sem TTY o `\r` não apaga nada e a linha viraria um
paredão.

```
2026-08-12 10:19:55 🏷️ [CLASSIFICACAO] 8 doutrinas de Grudem prontas
2026-08-12 10:19:56 🔐 [AUTH] administrador criado: saito.inovacao@gmail.com
2026-08-12 10:20:00 📖 [BIBLIA] Bíblia completa: 31106 versículos em 66 livros
2026-08-12 10:24:20 📥 [INGESTAO] 1409 resenhas gravadas
```

O horário é local, não UTC.
