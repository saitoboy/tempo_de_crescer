#!/bin/sh
#
# A partida do contêiner, em quatro passos.
#
# Era uma linha só no CMD, com `&&` encadeando tudo. Funcionava, mas quando
# falhava só sobrava o código de saída: descobrir se quebrou a migration, o
# seed ou a Bíblia exigia ler o log inteiro de trás para frente. Aqui cada
# passo se anuncia antes de rodar.
#
# `set -e` mantém o comportamento do `&&`: qualquer passo que falhe para a
# partida. É de propósito — subir a API com o schema desatualizado é pior do
# que não subir, porque o erro aparece depois, na primeira consulta, e não no
# deploy.

set -e

passo() {
  echo ""
  echo "==> $1"
}

passo "aplicando migrations"
# `migrate deploy` só aplica migrations já criadas, nunca altera o schema
# sozinho e nunca apaga dado.
npx prisma migrate deploy

passo "seed: doutrinas, pregadores, devocionais, livro e admin"
# Idempotente e não destrutivo. Num banco novo, os devocionais e as páginas do
# livro ainda não têm resenha para casar — quem completa isso é a ingestão,
# que roda depois e reimporta o que passou a ter par. Ver
# `carregarOQueDependeDasResenhas` em src/services/agendamento.ts.
node build/seeds/seed.js

passo "seed: Bíblia ACF"
# Pula sozinho quando os 31.106 versículos já estão no banco.
node build/seeds/biblia.js

passo "subindo a API"
exec node build/index.js
