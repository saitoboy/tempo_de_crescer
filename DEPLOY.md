# Deploy no EasyPanel

Guia do backend do Tempo de Crescer. Os valores reais das variáveis **não estão
aqui** — ficam em `CREDENCIAIS.md`, que é ignorado pelo git e deve ser apagado
depois que você colar tudo no painel.

Domínios:

| o quê | endereço |
|---|---|
| front | `tempodecrescer.ibps.org` |
| API | `api-tempodecrescer.ibps.org` |

---

## O que a imagem faz sozinha

O contêiner sobe populado. `docker-entrypoint.sh` roda quatro passos, nesta
ordem, e cada um se anuncia no log:

1. `prisma migrate deploy` — aplica as migrations já criadas. Nunca altera o
   schema por conta própria e nunca apaga dado.
2. `seed.js` — as 8 doutrinas de Grudem, os pregadores canônicos com aliases, os
   devocionais de `prisma/dados/devocionais.json`, as páginas do livro de
   `prisma/dados/curadoria.json` e o usuário administrador.
3. `biblia.js` — importa a ACF. Pula sozinho quando os 31.106 versículos já
   estão no banco.
4. `node build/index.js` — sobe a API.

Todos são idempotentes: reiniciar o contêiner não duplica nada.

Qualquer passo que falhe **para a partida** (`set -e`). É de propósito — subir a
API com o schema desatualizado é pior do que não subir, porque o erro apareceria
depois, na primeira consulta, longe da causa.

### E as pregações?

O servidor chama a ingestão **na subida, em segundo plano**, sem bloquear o
boot. Num banco recém-criado ela baixa as 1.409 resenhas do blog; num banco já
populado não baixa nada. Depois disso o cron repete de 4 em 4 horas
(`CRON_INGESTAO`).

Erro no blog ou no proxy não derruba o servidor — a passada seguinte tenta de
novo.

> **A primeira subida tem duas fases.** O seed roda antes do servidor, quando
> ainda não há resenha nenhuma no banco, e a importação casa devocional com
> resenha **pelo slug**. Então na primeira subida os devocionais e as páginas do
> livro não têm com o que casar. Quem completa é a própria ingestão: assim que
> ela grava resenha nova, reimporta os dois arquivos e o acervo se monta. É
> automático, mas não é instantâneo — dê uns minutos antes de concluir que deu
> errado.

### E gerar devocional?

**Não gera sozinho por padrão.** `CRON_DEVOCIONAIS` vem `off`. Para produção
escrever, precisa de duas coisas:

- `CRON_DEVOCIONAIS` com uma expressão cron (ex.: `0 8 * * *`)
- chave da Groq — no painel (`GROQ_API_KEYS`) ou cadastrada pela rota
  `/api/v1/chaves`, que guarda no banco cifrada

`DEVOCIONAIS_POR_EXECUCAO` controla quantos por vez (padrão 5).

---

## Passo a passo no painel

### 1. Serviço PostgreSQL

Crie um serviço **PostgreSQL** (Postgres 17). Anote usuário, senha e nome do
banco — vão montar a `DATABASE_URL`.

### 2. Serviço App

Crie um serviço **App** apontando para este repositório, com build por
**Dockerfile**.

### 3. Variáveis de ambiente

Cole o bloco de `CREDENCIAIS.md`. As obrigatórias:

| variável | o que é |
|---|---|
| `DATABASE_URL` | `postgresql://usuario:senha@NOME_DO_SERVICO_DE_BANCO:5432/banco` |
| `JWT_SEGREDO` | assina os tokens de sessão. Mínimo 32 caracteres |
| `CHAVES_SEGREDO` | cifra as chaves de API guardadas no banco. Mínimo 16 |
| `ADMIN_EMAIL` / `ADMIN_SENHA` | o primeiro administrador, criado pelo seed |
| `FRONT_ORIGEM` | `https://tempodecrescer.ibps.org` |

> **O host da `DATABASE_URL` é o nome do serviço de banco, não `localhost`.**
> Senha com `@ : / # ?` precisa vir escapada (`%40 %3A %2F %23 %3F`), senão a
> URL quebra em silêncio.

> **`FRONT_ORIGEM` vazio deixa o CORS aberto para qualquer site.** Em
> desenvolvimento isso é conveniência (Swagger, curl); em produção significa que
> qualquer página na internet pode chamar esta API com o token de quem está
> logado. Preencher não é opcional.

As opcionais e seus padrões estão em `.env.example`.

### 4. Domínio

Em **Domains & Proxy**, aponte `api-tempodecrescer.ibps.org` com **proxy port
3003**. O EasyPanel configura o proxy e emite o certificado Let's Encrypt
sozinho.

### 5. Subir

Faça o deploy e acompanhe o log. Os quatro passos aparecem marcados com `==>`.

---

## Conferir se deu certo

```bash
curl https://api-tempodecrescer.ibps.org/health
```

Devolve `{"ok":true,"resenhas":N,"cultos":N,"pregadores":N}`. É o mesmo endereço
do `HEALTHCHECK` da imagem, e ele consulta o banco — então "saudável" significa
API de pé **e** Postgres respondendo.

Logo depois da primeira subida `resenhas` vem baixo e sobe sozinho conforme a
ingestão anda. Espere ela terminar antes de checar o acervo:

```bash
# quantos devocionais e páginas do livro casaram
curl -u ... https://api-tempodecrescer.ibps.org/api/v1/meta
```

O esperado no fim: **1.409 resenhas**, os devocionais do arquivo e **365 páginas**
no livro de 2027.

---

## Antes de cada deploy

Os devocionais viajam como **dado**, dentro da imagem, em `prisma/dados/`. Quem
gerou texto novo localmente precisa exportar e commitar **antes** de buildar,
senão produção nasce com o acervo da última exportação:

```bash
npm run exportar:devocionais
git add prisma/dados && git commit -m "chore: exporta devocionais" && git push
```

Isso vale também para a curadoria do livro: o mesmo comando exporta os dois
arquivos.

---

## Se algo der errado

| sintoma | causa provável |
|---|---|
| contêiner reinicia sem log de `==>` | `DATABASE_URL` inválida — o `config` valida na partida e derruba o processo com a mensagem |
| `==> aplicando migrations` e para | banco inacessível: host, senha ou serviço de Postgres fora do ar |
| API de pé, `/health` responde, acervo vazio | ingestão ainda rodando, ou `CRON_INGESTAO=off` |
| resenhas no banco mas nenhum devocional | a reimportação ainda não rodou; ela acontece quando a ingestão grava resenha nova |
| front recebe erro de CORS | `FRONT_ORIGEM` não bate com o domínio exato, com `https://` e sem barra no fim |
| `exec /app/docker-entrypoint.sh: no such file or directory` | o arquivo foi para o repositório com CRLF. O `.gitattributes` previne isso |
