# Plano de implementação

Oito fases. Sete prontas no backend; falta o front.

| fase | o que é                                   | estado      |
| ---- | ------------------------------------------ | ----------- |
| 1    | Fundação: banco, schema, carga do acervo | ✅ pronta   |
| 2    | Ingestão incremental agendada             | ✅ pronta   |
| 3    | Curadoria manual: pregador e data          | ✅ pronta   |
| —   | Taxonomia de Grudem, 57 capítulos         | ✅ pronta   |
| 4    | YouTube: casar culto com a live, QR code   | ✅ pronta   |
| 5    | Classificação teológica                 | ✅ pronta   |
| 6    | Geração dos devocionais                  | ✅ pronta   |
| 7    | Análise e login                            | ✅ backend  |
| 8    | Montagem do livro                          | ✅ pronta   |

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
- [x] QR code em SVG, **guardado no banco** — 620 códigos, 1,4 MB no total

### O QR fica guardado

2,4 KB por culto em SVG. Guardado, e não gerado a cada leitura, porque a
montagem do livro empacota centenas de páginas de uma vez para o designer —
regerar tudo nessa hora seria desperdício, e guardar garante que o arquivo
entregue e o banco mostrem o mesmo código.

**SVG cru, não base64 de PNG:** é vetor, não perde na impressão em A5 e ocupa
menos. A API devolve a forma embutível (`data:image/svg+xml;base64,…`) na
listagem, que é o que o front e o InDesign consomem; a rota `qrcode.svg`
devolve o vetor puro.

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

## ✅ Fase 5 — Classificação teológica

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

Continua auditável: `Classificacao` guarda o z-score e a densidade de cada
decisão.

### Resultado sobre as 1.409

`npm run classificar` — **1.138 classificadas**, 271 indefinidas.

| doutrina | como tema principal |
|---|---:|
| Cristo | 192 |
| Homem | 163 |
| Salvação | 161 |
| Igreja | 140 |
| Últimas Coisas | 138 |
| Palavra de Deus | 133 |
| Deus | 125 |
| Espírito Santo | 86 |

Cristo lidera, mas com 17% — não engole tudo, que é o que aconteceria com
contagem bruta. **É a prova de que a abordagem funciona.**

Aferição por amostra: a pneumatologia pegou Atos 1, Atos 2, Romanos 8 e
Efésios 1:13-14 (o selo do Espírito); a eclesiologia pegou as Ceias do Senhor.
São os textos canônicos de cada doutrina.

### Duas correções que a execução real expôs

**`vida eterna` mandava João 3 para escatologia.** O texto do novo nascimento
virava Últimas Coisas porque a expressão só valia para lá. Virou ambígua,
resolvida por contexto: com "nascer de novo" perto, é Salvação; com "juízo",
é escatologia. João 3:1-10 agora é Salvação (z=5,5) com Espírito Santo como
secundário — a regeneração é obra do Espírito.

**A desambiguação não rodava.** `santificação`, `fé` e `vida eterna` estavam
nas regras mas em nenhuma lista de marcadores, e o código só desambiguava o
que já estava numa lista — o mesmo defeito do classificador antigo, onde as
regras existiam e nunca eram chamadas. Agora as ambíguas são varridas à parte.
Corrigir isso levou as classificadas de 1.061 para 1.138.

### Ainda por fazer

Os 57 subtemas são alvos finos que o classificador ainda não usa. Detectar
"trata de Justificação, capítulo 36" exige vocabulário por capítulo, não só
por doutrina.

## ✅ Fase 6 — Devocionais

A fila são as resenhas sem devocional, consumida por um runner local que chama
o **Claude Opus pelo CLI**, em lote — a assinatura em vez da chave de API.

Groq com llama foi testado e descartado: texto fraco.

Os campos de `Devocional` espelham os blocos da página do livro um a um.
O estilo de escrita é o de **A.W. Tozer**; a amostra e a anatomia da página
estão em `CONTEXTO/referencia-de-escrita.md`.

> **Grudem classifica, Tozer escreve.** São papéis distintos.

```bash
npm run devocionais          # 5 resenhas
npm run devocionais -- 20    # 20 resenhas
```

Cerca de 22 segundos por devocional. Interromper no meio não perde nada: cada
um é gravado assim que fica pronto, e a execução seguinte continua de onde
parou — a fila é "resenha sem devocional", não um status.

### O versículo nunca é escrito pelo modelo

Ele indica a **referência**; o texto vem da tabela `Versiculo`, que tem a ACF
inteira. Modelo citando Escritura de memória troca palavra, e num livro
devocional isso é grave.

### O devocional nasce da resenha

A resenha vai inteira no prompt, junto com o texto base, o pregador e a
doutrina que a classificação apontou. O que o devocional diz tem de ser o que
foi pregado naquele culto, não teologia genérica sobre a passagem.

Funciona: no primeiro gerado, sobre Gênesis 13, a frase "andar de altar em
altar, não de vitrine em vitrine" veio da pregação do Pr. Nélio — não do
modelo.

### O prompt vai pelo stdin

Passar milhares de caracteres com quebras de linha e aspas na linha de comando
do Windows não sobrevive: o CLI recebia vazio e respondia "Fala. Que precisa?".
Pelo stdin não há o que escapar.

O CLI também roda de uma **pasta vazia**, para não carregar o `CLAUDE.md` do
projeto a cada chamada — eram 23 mil tokens de contexto desperdiçados, e ainda
arriscava misturar as instruções do repositório com as do devocional.

## ✅ Fase 7 — Análise e login *(backend)*

- [x] `/analise/panorama` — números do acervo
- [x] `/analise/doutrinas` — distribuição pelas 8
- [x] `/analise/evolucao` — ênfase ano a ano
- [x] `/analise/pregadores` — o que cada um enfatiza
- [x] `/analise/biblia` — cobertura, e o que nunca foi pregado
- [x] **Login com JWT** e os papéis `ADMIN`, `PASTOR`, `LIDER`
- [ ] Front em Vite + shadcn/ui

### O achado da cobertura bíblica

**57 dos 66 livros já foram pregados (86%).** Nunca subiram ao púlpito:
Esdras, Cânticos, Lamentações de Jeremias, Amós, Obadias, 2 Tessalonicenses,
2 João, 3 João e Judas.

Mais pregados: Mateus 154 · João 127 · Atos 108 · Lucas 94 · Salmos 76.

### Regras da análise

Só o tema **PRINCIPAL** conta nas distribuições — somar os secundários faria o
total passar do número de pregações. E a série histórica usa apenas
`origemData = 'TEXTO'`, para não misturar o que é firme com o que foi
corrigido à mão.

### O login

JWT assinado com HMAC-SHA256 usando só a stdlib. Uma biblioteca de JWT traria
verificação de algoritmo, `jku`, `kid` e uma dúzia de coisas que este projeto
não usa — e cada uma já foi vetor de CVE. Aqui só existe um algoritmo, fixo no
código. Há teste para o ataque do `alg: none`.

O `API_TOKEN` continua aceito, para não quebrar quem já integrou. Some quando
o front estiver de pé.

## ✅ Fase 8 — O livro

- [x] `/livro/paginas` — os blocos da página, em JSON
- [x] `/livro/imprimir.html` — A5 pronto para imprimir
- [x] `/livro/livro.idml` — para o designer refinar
- [ ] Temas do mês e seleção manual de quais devocionais entram

### Dois modelos de miolo

`?modelo=compacto` e `?modelo=largo`.

| | compacto | largo |
|---|---|---|
| pontos de aplicação | coluna, ao lado do QR | largura total |
| QR code | 25 mm, ao lado dos pontos | 14 mm, discreto no rodapé |
| oração | metade da largura | largura total |
| anotações | tem | não tem |

O segundo dispensa o campo "Blog" do modelo escaneado: a URL ocupava três
linhas e ninguém digita endereço de blog. O QR faz o mesmo trabalho em 14 mm.

Título em **Bebas Neue**, com queda para Haettenschweiler e Arial Narrow. A
fonte não é embutida — instalada na máquina, o navegador usa.

### O que a medição na página revelou

Renderizando o A5 de verdade e medindo com o navegador:

- Os blocos fixos ocupavam **699px dos 695px úteis** — estouravam a página
  **antes de qualquer texto**. Título a 27pt, QR de 34 mm e anotações de 30 mm
  eram grandes demais. Reduzidos, os fixos caíram para **501px**.
- Sobram **194px** para a reflexão, o que dá cerca de **1.250 caracteres**.
  O prompt pedia 900 a 1400 e o modelo entregava até 1.864 — todas as páginas
  estouravam. Agora pede 900 a 1100, com teto de 1.200 no Zod.
- Depois do ajuste: 547px e 648px de 695. Cabe.

O navegador **não imprime fundo por padrão**, então a faixa do cabeçalho e o
bloco da oração saíam em branco. `print-color-adjust: exact` resolve sem o
leitor precisar marcar nada.

### Por que HTML, e não uma biblioteca de PDF

A página tem texto justificado com hifenização, viúvas e órfãs controladas e um
bloco de anotações. O motor de texto do navegador faz isso bem; montar em
coordenadas à mão levaria muito mais código para um resultado pior. Abrir no
navegador e imprimir para PDF dá o A5 final, e o QR vai embutido como SVG — o
arquivo é autossuficiente.

### Dois formatos de saída

| formato | para quê |
|---|---|
| **PDF** | ver o resultado, revisar, imprimir prova |
| **`.idml`** | abrir no InDesign e o designer refinar o que falta |

O `.idml` é o que fecha o ciclo: o backend gera a diagramação base — texto nos
blocos certos, QR no lugar, paginação — e o designer recebe um arquivo **vivo**,
não uma imagem achatada. Ele ajusta tipografia, viúvas e órfãs, respiros, e
manda para a gráfica.

### O IDML

Um spread por página, com os quadros de texto nomeados: `Titulo`, `Versiculo`,
`Creditos`, `Reflexao`, `PontosAplicacao`, `QRCode`, `Oracao`, `Anotacoes`.
O pacote sai com `mimetype`, `designmap.xml`, `META-INF/container.xml`,
`Resources/Styles.xml` e `Resources/Preferences.xml`.

**Aberto e conferido no InDesign.** A primeira versão abriu, com os quadros na
posição certa, e expôs três defeitos — todos corrigidos:

| defeito | causa | correção |
|---|---|---|
| páginas em branco na frente | `PagesPerDocument` com o total criava as páginas do documento **além** dos spreads | fixo em 1; as páginas vêm dos spreads |
| parágrafos colados numa linha | faltava o `<Br/>`, terminador de parágrafo do IDML | `<Br/>` ao fim de cada parágrafo |
| marcador saía como caractere inválido | `▪` não existe nas fontes padrão | `•` |

### Uma ou duas páginas por devocional

`?formato=auto` (padrão), `uma` ou `duas`.

O acervo tem pregações curtas e longas, e forçar o mesmo formato deixaria umas
apertadas e outras com metade da página vazia. O `auto` decide **por
devocional**: até 1.150 caracteres de reflexão mais aplicação, cabe numa
página; acima disso, abre em duas encaradas — a esquerda com título, versículo
e reflexão, a direita com aplicação, oração e QR.

Sobre 6 devocionais: `auto` deu 11 páginas, `uma` deu 6, `duas` deu 12.

### Fidelidade ao modelo do designer

O segundo print do InDesign mostrou três desvios do modelo, todos corrigidos:

| defeito | causa |
|---|---|
| `REFLEXÃO DEVOCIONAL:` espalhado de ponta a ponta | era parágrafo próprio e justificado; no modelo é **negrito inline** abrindo o texto |
| `PONTOS DE APLICAÇÃO PRÁTICA:` idem | cabeçalho de seção não pode ser justificado |
| `FixeoolharemCristoantesdetentar…` | sem `MinimumWordSpacing`, o InDesign espremia os espaços até sumirem |

Também entraram `SpaceAfter` para separar parágrafos e recuo pendente nos
marcadores, como no escaneado.

O QR fica como **link escrito** no quadro `QRCode`: o designer gera o código na
diagramação. Foi a preferência da igreja.

O caminho ainda mais seguro seria inverter: o designer exporta um template do
InDesign uma vez, e o código preenche os quadros dele. Está marcado no código
com um comentário `ponytail:`.

O QR entra como URL no quadro, não como imagem embutida: embutir exigiria um
`Graphic` com `Link` para um arquivo que o designer não teria, e o documento
abriria quebrado.

## ✅ Busca semântica

`npm run vetorizar` — 1.409 resenhas em 2min20s.

Existe por causa dos meses que **não são doutrina**: Novos Recomeços, As
Mulheres da Bíblia, Família, Novas Gerações. Grudem não os cobre; o significado
do texto, sim.

O modelo roda **local**, pelo transformers.js: 384 dimensões, ~9 ms por texto,
nada sai da máquina, sem chave e sem custo por uso.

### Sem pgvector, de propósito

1.409 vetores de 384 dimensões dão 4 MB. Cabem na memória, e o cosseno sobre
eles leva milissegundos. O índice vetorial só passa a compensar com dezenas de
milhares de registros — e o Postgres local nem tem a extensão. Fica como
caminho de upgrade documentado no schema.

### A porcentagem é relativa, não absoluta

O cosseno deste modelo **se agrupa entre 85% e 90%** — tudo parece parecido com
tudo, e o número absoluto não informa nada. O que vale é a ordem. Por isso a
API devolve `afinidade`: o melhor do conjunto vira 100, o pior vira 0.

### O que funciona, e o que não

| tema | achou |
|---|---|
| Novos Recomeços | *"Ano Novo - Tempo de recomeçar"*, *"Ano Novo, vida nova"* ✅ |
| As Mulheres da Bíblia | *2 Reis 4:1-7* (a viúva e o azeite), *Provérbios 31* ✅ |
| Família | *"Família sob pressão"*, *Atos 2:46* (as casas) ✅ |
| Novas Gerações | Josué 3, Apocalipse 21 — **não convenceu** ⚠️ |

Três de quatro acertam. "Novas Gerações" é abstrato demais para o vetor pegar
sozinho; ali a busca por palavra ("filhos", "criança", "jovens") ajuda mais.

## 🔭 Depois

Mapa vetorial dos textos bíblicos já pregados, para enxergar a linha teológica
e escatológica da igreja ao longo do tempo — e quais passagens nunca subiram ao
púlpito. Os vetores das resenhas já estão no banco; falta cruzar com a tabela
`Versiculo`.
