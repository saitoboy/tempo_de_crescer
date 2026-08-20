# Imagem para o EasyPanel.
#
# O contêiner sobe populado: na partida aplica as migrations, roda os seeds
# (doutrinas, pregadores, devocionais, livro, Bíblia) e o servidor busca o
# acervo do blog em segundo plano. Todos os passos são idempotentes, então
# reiniciar não duplica nada nem recarrega o que já está no banco.
#
# Ver DEPLOY.md para o passo a passo do painel.

# ---------------------------------------------------------------- build ----

FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src

# prisma.config.ts exige DATABASE_URL só para carregar. `generate` não conecta
# em banco nenhum — lê o schema e escreve o client — mas o config falha antes
# disso se a variável não existir. Este valor vale só neste estágio; quem roda
# de verdade é o runtime, com a variável do EasyPanel.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Gera depois de copiar o src: o client sai em src/generated/prisma, e copiar
# o src por cima de uma geração anterior é pedir confusão.
RUN npx prisma generate
RUN npx tsc

# -------------------------------------------------------------- runtime ----

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

# `tini` como PID 1.
#
# O `node` em PID 1 não recebe SIGTERM como um processo comum: sem tratador
# explícito o sinal é ignorado, o EasyPanel espera o tempo de graça e mata o
# contêiner com SIGKILL. Em redeploy isso corta requisição no meio e, pior,
# pode interromper uma ingestão a meio caminho. O tini repassa o sinal e
# ainda recolhe processo zumbi.
RUN apk add --no-cache tini

# O CLI do Prisma fica na imagem de propósito: é ele que aplica as migrations
# na partida. Por isso as dependências não são podadas.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY package*.json ./
COPY docker-entrypoint.sh ./

# Roda como `node`, não como root.
#
# A imagem oficial já traz o usuário; o que faltava era usá-lo. Vale mesmo
# atrás do proxy do EasyPanel: se um dia uma dependência for comprometida, a
# diferença entre escrever em /app e escrever em /etc é esta linha.
#
# O `chown` é necessário porque tudo acima foi copiado como root, e a ingestão
# grava cache em disco dentro de /app.
RUN chmod +x docker-entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3003

# O EasyPanel mostra o contêiner como saudável ou não a partir daqui, e o
# /health já existe fora do prefixo de versão justamente para isto — não deve
# depender de qual versão da API está no ar. Ele consulta o banco, então
# "saudável" significa API de pé **e** Postgres respondendo.
#
# `start-period` largo de propósito: a primeira subida aplica migrations e
# importa 31.106 versículos antes de abrir a porta.
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3003)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker-entrypoint.sh"]
