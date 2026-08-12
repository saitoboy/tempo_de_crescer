# Imagem para o EasyPanel.
#
# O contêiner sobe populado: na partida aplica as migrations, roda os seeds
# (doutrinas, pregadores, Bíblia) e o servidor busca o acervo do blog em
# segundo plano. Todos os passos são idempotentes, então reiniciar não
# duplica nada nem recarrega o que já está no banco.

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

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

# O CLI do Prisma fica na imagem de propósito: é ele que aplica as migrations
# na partida. Por isso as dependências não são podadas.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY package*.json ./

EXPOSE 3003

# migrate deploy só aplica migrations já criadas, nunca altera o schema sozinho.
CMD ["sh", "-c", "npx prisma migrate deploy && node build/seeds/seed.js && node build/seeds/biblia.js && node build/index.js"]
