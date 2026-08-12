# Plano de implementação

Oito fases. Três prontas, uma parcial, quatro pela frente.

| fase | o que é                                   | estado      |
| ---- | ------------------------------------------ | ----------- |
| 1    | Fundação: banco, schema, carga do acervo | ✅ pronta   |
| 2    | Ingestão incremental agendada             | ✅ pronta   |
| 3    | Curadoria manual: pregador e data          | ✅ pronta   |
| —   | Taxonomia de Grudem, 57 capítulos         | ✅ pronta   |
| 4    | YouTube: casar culto com a live, QR code   | ✅ pronta   |
| 5    | Classificação teológica                 | ⬜ próxima |
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

## ✅ Fase 4 — YouTube e QR code

`npm run youtube` casa cada culto com a transmissão do canal.

- [x] 934 vídeos lidos, com o **horário real** da live (`actualStartTime`)
- [x] **620 dos 1.026 cultos** ganharam vídeo — 60%
- [x] Pregador extraído do título da live
- [x] QR code em SVG, gerado sob demanda

### O horário da live dá o turno

O YouTube devolve UTC; convertido para São Paulo, o culto da manhã começa por
volta das 09h30 e o da noite às 19h20. A conversão importa: sem ela, um culto
de domingo à noite viraria segunda-feira.

### O pregador está no título

```
SEMENTES I Pr. Nélio Monteiro
```

O separador é um **I maiúsculo isolado**, não uma barra vertical. Preencheu 5
resenhas que estavam sem assinatura.

### Cobertura por ano

| ano | cultos | com vídeo |
|---|---:|---:|
| 2012–2019 | 291 | 0 |
| 2020 | 108 | 12 |
| 2021 | 108 | 102 |
| 2022 | 99 | 97 |
| 2023 | 77 | 77 |
| 2024 | 125 | 123 |
| 2025 | 134 | 131 |
| 2026 | 84 | 78 |

O canal começou a transmitir em 2020, na pandemia. Antes disso não há live, e
nenhuma quantidade de código resolve isso.

### Divergência não sobrescreve

Quando a assinatura da resenha e o título da live discordam sobre quem pregou,
**nada é alterado** — a divergência é registrada para revisão humana. São duas
fontes falíveis, e nenhuma é boa o bastante para calar a outra sozinha.

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

### Dois formatos de saída

| formato | para quê |
|---|---|
| **PDF** | ver o resultado, revisar, imprimir prova |
| **`.idml`** | abrir no InDesign e o designer refinar o que falta |

O `.idml` é o que fecha o ciclo: o backend gera a diagramação base — texto nos
blocos certos, QR no lugar, paginação — e o designer recebe um arquivo **vivo**,
não uma imagem achatada. Ele ajusta tipografia, viúvas e órfãs, respiros, e
manda para a gráfica.

`.idml` é um pacote ZIP de XML, então dá para gerar sem InDesign: monta-se a
estrutura a partir de um template exportado uma vez pelo designer, com os
blocos de `Devocional` preenchendo os quadros de texto nomeados.

## 🔭 Depois

Mapa vetorial dos textos bíblicos já pregados, para enxergar a linha teológica
e escatológica da igreja ao longo do tempo — e quais passagens nunca subiram ao
púlpito.
