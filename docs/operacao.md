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
| `FRONT_ORIGEM` | — | origens do CORS, separadas por vírgula; **vazio libera tudo** |
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

### Subprocesso não herda o dispatcher

`aplicarProxy()` troca o dispatcher do undici, e isso vale só para o `fetch`
**deste** processo. O CLI do Claude é outro processo: sai pela rede sozinho e
lê `HTTPS_PROXY` do ambiente. Por isso `gerarDevocionais.ts` monta o env do
filho com a URL do proxy.

Sem isso o script funcionava ou não conforme o terminal de onde foi chamado —
num que já tivesse a variável exportada, sim; num terminal limpo, o CLI voltava
**407 em ~5 segundos**, com o erro no **stdout** e o stderr vazio. Ler só o
stderr dava `CLI saiu com código 1:` e mais nada.

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

## Devocionais

**Produção passou a escrever.** Era impossível enquanto a geração dependia do
CLI do Claude, que autentica com a sessão da máquina de quem escreve — dentro
do contêiner não há login nenhum. Uma chave de API não tem esse problema, e é
por isso que `GROQ_API_KEYS` mudou o que é possível, não só o custo.

| variável | para quê |
|---|---|
| `GROQ_API_KEYS` | chaves separadas por vírgula; o limite é **por chave** |
| `GROQ_MODELO` | `openai/gpt-oss-120b` |
| `CRON_DEVOCIONAIS` | `off` por padrão; escrever sozinho é decisão de quem opera |
| `DEVOCIONAIS_POR_EXECUCAO` | `5` |

O lote é pequeno de propósito: a igreja produz três cultos por semana, e cinco
por execução mantém o acervo em dia com folga. Encher os 1.300 pendentes
automaticamente seria escrever texto que nenhum mês do livro vai usar — o mês
se monta pelo script, com a curadoria junto.

**O que sai daqui nasce em `status: GERADO`.** Publicar continua sendo do
pastor, e é ele quem lê tudo antes de imprimir.

### O arquivo versionado continua valendo

```
sua máquina                    repositório              produção
npm run devocionais       →    devocionais.json    →    npm run seed
npm run exportar:devocionais   (versionado)             (carrega o arquivo)
```

Não é mais a única via, mas continua sendo a que leva **o texto revisado** para
produção — a importação nunca sobrescreve o que já existe lá.

### Gerar por tema do mês, não a fila inteira

Medido: **~28k tokens de entrada por devocional**, e a cota rende cerca de
**18 por janela** de 5 horas. A fila inteira levaria meses — e não faz sentido,
porque o livro usa doze meses por edição, não mil páginas.

```bash
npm run devocionais -- 20 2027-5 --listar
npm run devocionais -- 20 2027-5
```

Com um mês, a fila deixa de ser "as mais recentes" e passa a ser "as que mais
se parecem com o tema", pelo mesmo vetor que a curadoria usa. `--listar` mostra
a escolha sem gastar nada — 20 devocionais são ~560k tokens, mais do que cabe
numa janela.

O grosso dos 28k é o system prompt do próprio CLI: o nosso prompt são ~3k.
Encurtar a resenha não adianta; o custo é por invocação. As duas alavancas
reais são gerar menos e gerar o certo.

### A chave é o slug, nunca o id

O `id` de um devocional é um uuid gerado por banco: o daqui não existe em
produção. Se a importação casasse por id, criaria devocional órfão ou apontado
para a resenha errada — no livro, isso é **o texto de uma pregação sob o
título de outra**. Por isso a chave é `resenha.slug`, que é derivado da URL do
blog e igual em qualquer banco.

### A importação não sobrescreve

Devocional que já existe no destino é preservado. Se alguém revisou um texto
pela API, uma nova carga não desfaz a revisão: o arquivo é o ponto de partida,
não a verdade final.

### A fila de um mês não repete assunto

```bash
npm run devocionais -- 20 2027-8             # só do Nélio, por padrão
npm run devocionais -- 20 2027-8 --listar    # confere sem gastar cota
npm run devocionais -- 20 --todos            # abre para todos os pregadores
```

**O pregador é padrão, não flag.** O livro é do pastor Nélio, e devocional
escrito a partir da pregação de outra pessoa não pertence a ele. Depender de
alguém lembrar de digitar `--pregador` significa que uma distração contamina o
acervo — e o erro só apareceria na diagramação.

Com um mês, a fila deixa de ser "as mais recentes" e passa a ser "as que mais
se parecem com o tema". Só que semelhança pura agrupa: Agosto/2027 é
"Eclesiologia", e a busca devolvia **oito das vinte falando de Ceia do
Senhor** — todas boas, todas a mesma mensagem, e um mês do livro com oito
páginas iguais.

A escolha agora é gulosa: percorre o ranking do mais parecido para o menos e
descarta quem já se parece demais com algo escolhido, ou com o que já virou
devocional em outro mês. **O melhor de cada grupo sobrevive** e o resto cede
lugar ao próximo assunto. Agosto caiu de oito páginas de Ceia para uma.

O limiar é **0,92**, medido — não estimado. Sobre 190 pares do topo de
Eclesiologia, o cosseno deste modelo ocupa a faixa de 0,857 a 0,943: o bloco da
Ceia fica todo acima de 0,923, assuntos distintos ficam entre 0,857 e 0,87.
Num espaço que começa em 0,857, os 0,95 que a intuição sugeriria não filtrariam
quase nada.

### Se a chave da API entrar um dia

Aí a geração pode subir para produção sem mudar mais nada além de trocar a
chamada do CLI por uma chamada de API em `gerarDevocionais.ts`. O resto do
caminho — fila, validação, gravação — já está pronto e não depende de quem
escreve o texto.

---

## A API é interna

**Leitura deixou de ser aberta.** Era herança de quando o front seria público:
o conteúdo já está no blog, então expor o JSON não vazava nada. Com o app
interno, o que a API devolve passa a incluir a fila de curadoria, o que ainda
não foi revisado e os devocionais antes de o pastor aprovar — nada disso é para
a internet.

Todo GET de JSON exige `exigirPapel('LIDER', 'PASTOR')`; ADMIN passa em tudo.
Entre em `POST /sessao/login` e mande `Authorization: Bearer <token>`.

Duas rotas continuam **abertas de propósito**:

| rota | por quê |
|---|---|
| `/cultos/{id}/qrcode.svg` | o navegador busca em `<img>`, que não manda `Authorization` |
| `/livro/imprimir.html` | abre em aba nova, mesmo motivo |

O conteúdo das duas já é público — o QR aponta para o YouTube da igreja — e
fechá-las exigiria token assinado na query string, que é mais superfície do que
o problema pede. `/health` e `/sessao/login` também ficam abertas, pelo óbvio.

> ⚠️ **`/livro/livro.idml` ficou fechada.** É download, e link `<a href>` não
> manda cabeçalho — o front precisa buscar com `fetch` e abrir o blob. Se a
> intenção era um link direto para o designer, esta é a rota a reabrir.

### O contrato viaja tipado

`GET /api/v1/openapi.json` publica **esquema de resposta** em toda operação de
sucesso, não só `description`. Sem isso o `openapi-typescript` gerava
`content?: never` em todo 200, o front tirava dali só o tipo do corpo da
requisição, e precisava de um `esquemas.ts` escrito à mão para o resto — duas
fontes para o mesmo contrato, uma sem ninguém verificando.

Os esquemas de saída ficam em `src/docs/respostas.ts`. Três testes seguram:
toda resposta 2xx publica esquema, toda rota fechada declara 401, e onde o
serviço tem tipo próprio (`PaginaDoLivro`, `Candidato`) o `expectTypeOf`
compara os dois — campo a mais no esquema quebra o `npm run typecheck`.

### `GET /meta`

Os enums do domínio e as 8 doutrinas, com rótulo pronto para exibir. Existe
para o front não escrever `['DIA', 'NOITE']` à mão: lista copiada envelhece, e
acrescentar um turno no schema sem lembrar do front produz um filtro que não
encontra nada — sem erro nenhum para denunciar.

Os valores vêm do client gerado pelo Prisma, isto é, do próprio
`schema.prisma`. Não há terceira cópia.

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

### Cópia do mesmo post

A deduplicação é por `urlBlog`, e o blog republica o mesmo texto em endereços
diferentes: `Efésios 5:22-32` estava lá **seis vezes**, todas de 2017-11-12,
byte a byte iguais. URL distinta, então passavam todas.

O custo não era disco: eram seis páginas idênticas no livro e ~166 mil tokens
de cota escrevendo o mesmo devocional seis vezes. Agora a ingestão compara
também o **texto limpo** (não o HTML — o Blogger varia atributo entre uma cópia
e outra) e ignora o que já está gravado sob outra URL.

---

## Comandos

| comando | o que faz |
|---|---|
| `npm run dev` | servidor com recarga automática |
| `npm run build` / `npm start` | compila e roda o build |
| `npm test` | 153 testes |
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
