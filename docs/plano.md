# Plano de implementação

Oito fases. Três prontas, uma parcial, quatro pela frente.

| fase | o que é                                   | estado      |
| ---- | ------------------------------------------ | ----------- |
| 1    | Fundação: banco, schema, carga do acervo | ✅ pronta   |
| 2    | Ingestão incremental agendada             | ✅ pronta   |
| 3    | Curadoria manual: pregador e data          | ✅ pronta   |
| —   | Taxonomia de Grudem, 57 capítulos         | ✅ pronta   |
| 4    | YouTube: casar culto com a live, QR code   | ⬜ próxima |
| 5    | Classificação teológica                 | ⬜          |
| 6    | Geração dos devocionais                  | ⬜          |
| 7    | Análise e front                           | ⬜          |
| 8    | Montagem do livro                          | ⬜          |

---

## ✅ Fase 1 — Fundação

Node/TypeScript/Express/Prisma/PostgreSQL de pé, schema modelado, acervo
carregado.

- [X] Branch `backend-node`, MVP em Python movido para `legacy/`
- [X] Schema: `Culto`, `Resenha`, `Pregador`, `Doutrina`, `Classificacao`,
  `Devocional`, `Usuario`, `LivroBiblico`, `Versiculo`, `Subtema`
- [X] Bíblia Almeida Corrigida Fiel: 66 livros, 31.106 versículos
- [X] Proxy corporativo funcionando
- [X] **1.409 resenhas** carregadas, de 2012 a 2026

O acervo real era maior do que se pensava: os JSONs antigos tinham 956
registros, o blog tem 1.409. Ver [dados.md](dados.md).

## ✅ Fase 2 — Ingestão incremental

`ingerirNovos()` compara o sitemap com o banco e baixa só o que falta.

- [X] `npm run ingerir` para rodar na mão
- [X] Agendamento a cada 4 horas dentro do processo da API
- [X] Insistência em 503, para a carga inicial não perder resenha
- [X] Validado apagando uma resenha e vendo ela voltar sozinha

A mesma função serve para o arranque em produção, com o banco vazio, e para a
atualização diária — num banco vazio, todas as 1.409 são "novas".

## ✅ Fase 3 — Curadoria manual

Rotas para corrigir o que a ingestão não completa: **40 resenhas sem pregador**
e **297 sem data**. Ver [api.md](api.md).

- [X] Fila de revisão com filtros
- [X] `PATCH` de pregador, data, turno e natureza
- [X] Cadastro e fusão de pregadores
- [X] Escrita protegida por token; leitura aberta

Correção manual **não inventa pregador**: nome que não resolve pelos aliases é
recusado com sugestão, e cadastrar gente nova exige autorização explícita.

## ✅ Taxonomia de Grudem

Os 57 capítulos da *Teologia Sistemática*, cada um sob a doutrina que cobre.
A referência é o número do capítulo, então dá para dizer "trata de
Justificação, capítulo 36" em vez de só "trata de Salvação".

Fonte: relação de aulas do próprio autor em `waynegrudem.com`.

---

## ⬜ Fase 4 — YouTube e QR code

Casar cada culto com a live do canal [@ibps.muriae](https://www.youtube.com/@ibps.muriae/streams).

- Buscar as lives por data e horário pela YouTube Data API
- Confirmar ou corrigir pregador e data pelo título da live
- Gravar `youtubeVideoId` e `youtubeUrl` no `Culto`
- Gerar o QR code que vai na página do livro

Resolve parte das 297 resenhas sem data — mas só de 2020 em diante, quando o
canal passou a transmitir. Para 2012–2016 não há live.

## ⬜ Fase 5 — Classificação teológica

O risco central: **uma pregação pode citar Jesus do começo ao fim sem ser sobre
cristologia**. Contagem absoluta de marcadores erra nesse caso.

**Abordagem: score relativo ao corpus.** Uma pregação é "sobre" a doutrina X
quando a densidade de marcadores de X está anormalmente alta em relação à média
das 1.409 — não quando a contagem bruta é a maior. Como toda pregação cita
Jesus, a média de cristologia já é alta, e citar Jesus muito vira normal.

1. Densidade por doutrina: marcadores ponderados ÷ palavras
2. Média e desvio padrão de cada doutrina no corpus inteiro
3. `z = (densidade − média) / desvio`
4. Tema principal: maior `z`. Secundários: até 2 com `z ≥ 1.0`
5. Nenhum passa do mínimo → **indefinido**, vai para revisão

Continua auditável: dá para mostrar densidade, média e desvio de cada decisão.

Com os 57 subtemas, a classificação ganha alvos finos além das 8 doutrinas.

## ⬜ Fase 6 — Devocionais

A fila são as resenhas sem devocional, consumida por um runner local que chama
o **Claude Opus pelo CLI**, em lote — a assinatura em vez da chave de API.

Groq com llama foi testado e descartado: texto fraco.

Os campos de `Devocional` espelham os blocos da página do livro um a um.
O estilo de escrita é o de **A.W. Tozer**; a amostra e a anatomia da página
estão em `CONTEXTO/referencia-de-escrita.md`.

> **Grudem classifica, Tozer escreve.** São papéis distintos.

## ⬜ Fase 7 — Análise e front

- Endpoints de análise: temas por ano, por pregador, cobertura bíblica,
  progressão temporal
- Front em Vite + shadcn/ui
- **Login de verdade**, com os papéis `ADMIN`, `PASTOR` e `LIDER` que já estão
  no schema — substitui o token único da Fase 3

A análise temporal filtra `origemData = 'TEXTO'` e trabalha com dados
confiáveis; a classificação usa as 1.409, porque não depende de data.

## ⬜ Fase 8 — O livro

- Temas do mês
- Seleção manual de quais devocionais entram
- Diagramação A5, com o QR code do culto em cada página
- Crédito de redação a Elizabete Lacerda Paulo

## 🔭 Depois

Mapa vetorial dos textos bíblicos já pregados, para enxergar a linha teológica
e escatológica da igreja ao longo do tempo — e quais passagens nunca subiram ao
púlpito.
