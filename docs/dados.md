# O que o acervo ensinou

Tudo aqui foi apurado olhando os dados, não suposto. Cada item mudou uma
decisão de código, e vários viraram teste.

---

## O acervo é maior do que parecia

Os JSONs do MVP em Python tinham **956** registros. O blog tem **1.409**.
O scraper antigo perdeu quase um terço do acervo.

| 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|------|------|------|------|------|------|------|------|------|------|------|
| 320  | 125  | 98   | 82   | 117  | 111  | 103  | 86   | 134  | 145  | 88   |

Contagem confirmada por duas fontes independentes: o widget de arquivo do blog
e o `sitemap.xml`.

> **`sitemap.xml` é a fonte canônica de enumeração.** Vem paginado em `?page=1`
> e `?page=2`.

O feed JSON do Blogger é tentador — devolve título, data e conteúdo
estruturados — mas **não devolve tudo**: a paginação por `start-index` traz
1.285 e a busca por faixa de data traz números ainda diferentes, com o buraco
todo em 2017–2019. Serve para inspeção rápida, não para ingestão.

## O acervo começa em 2012, não em 2016

43 posts publicados em 2016 carregam datas de **2012 a 2015**, em lotes — 16
num dia, 10 em outro. O dia da semana dessas datas é domingo 26 e quarta 14,
exatamente a agenda da igreja.

Não é erro: é a igreja tendo digitado sermões antigos e publicado em bloco em
meados de 2016. Por isso `dataPregacao` (2012‑2015) é a verdade e `publicadoEm`
(2016) é só quando foi digitado.

## 2016 usa outro formato

Quase todo post de 2016 é pregação, mas **sem o cabeçalho padrão**. O título é
a referência bíblica (`Josué 10:13-14 e Lucas 2:8-12`) e o texto começa direto
no tema. O formato só se padroniza a partir de 2019.

> Filtrar por "Resenha do Culto" descarta **296 dos 320** posts de 2016.

Variações do cabeçalho ao longo dos anos: `Resenha do Culto da noite de
Domingo`, `Resenha da Manhã de`, `Culto da Noite de`, `Resenha da Vigília de
Ano Novo`, `EBD da Manhã de Domingo`, `Reflexão de sexta-feira`. A data e o
tipo aparecem ora no início, ora no fim.

---

## O pregador fica no fim, em assinatura

```
...Palavra de Deus, norteando a vida.
Pastor Nélio Monteiro
IBPS
```

Só 17 das 956 resenhas antigas mencionavam o pregador nos primeiros 600
caracteres. Qualquer parser que olhe o começo do texto falha.

**Distribuição:** Nélio Monteiro 1.035 · Gabriel Monteiro 136 · Ryan Souza 51 ·
Silvio Farias 24 · Jaine Feliciano 19 · Daniel Monteiro 13 · Robson Soares 12 ·
e uma cauda de 44 convidados.

### O mesmo nome, escrito de várias formas

| o blog escreve | o correto |
|---|---|
| Ryan Sousa / Ryan Souza | Ryan Souza |
| Silvio Faria / Sílvio Farias | Silvio Farias |
| Fernando Arede / Fernando Arêde | **Fernando Arêdes** |
| Eliel / Eliel Marins | **Eliel Martins** |
| Estevam / Estevão | Estevão Vianna |
| Thales / Thalles | Thales |
| Giovani Glória / Geovane Glória | Geovane Glória |

Alguns o blog escreve **errado** — `Arêdes` e `Martins` foram confirmados pela
igreja. O cadastro guarda o nome certo; as grafias do blog viram aliases.

Missionários de fora vinham com o lugar de origem grudado no nome:
`Abdulay São Tomé e Príncipe`, `Liliane de Passo Fundo RS`.

### Uma pessoa muda de título ao longo do tempo

`Seminarista Gabriel Monteiro` vira `Pastor Gabriel Monteiro`. O título é
atributo da época, não da pessoa.

---

## As armadilhas do parser

Cada uma virou teste, porque cada uma corrompeu dado antes de ser pega.

### Tags no meio das palavras

O blog tem tags HTML dentro das palavras, resquício de edição no editor do
Blogger. Trocar tag por espaço produz:

```
R esenha      Rese nha      1 9/10/2025
```

**Remover as tags inline sem inserir espaço.** Só `<br>`, `<p>`, `<div>` e
cabeçalhos viram quebra de linha.

### A flag `i` do regex anulava a exigência de maiúscula

O padrão do nome exigia inicial maiúscula, mas a flag `i` fazia
`[A-ZÀ-Ý]` casar com minúscula também — então **qualquer palavra depois de um
título virava pregador**. A capitalização passou a ser conferida no texto
original.

### `Sem.` também é a palavra "sem"

A abreviação de "Seminarista" sem exigir o ponto casava com a preposição:
*"ninguém se salva sem Cristo"* criava um pregador chamado **Cristo**.
Abreviações agora exigem o ponto.

### Sigla e turno grudavam no nome

O banco chegou a ter pregadores chamados `Nélio Monteiro Noite`,
`Gabriel Monteiro IPBS`, `Deus` e `Evangelho`. Uma lista de palavras que nunca
são nome corta o rodapé.

### Em culto fúnebre, o citado é o homenageado

`Culto Fúnebre do irmão Souza` cadastrava o **falecido** como pregador do
próprio funeral. `FUNEBRE` virou natureza própria e o homenageado é descartado.

### 73 slugs colidem

A igreja prega o mesmo texto em anos diferentes, e o Blogger repete o slug:
`joao-81-11` aparece em 2017, 2020, 2021 e 2024. O slug passou a sair do
caminho inteiro da URL — `2024-09-joao-81-11`.

Isso **não é duplicação**: são pregações distintas sobre a mesma passagem, e é
matéria-prima da análise temporal.

### 94 títulos guardavam entidades HTML

`&quot;Quando a graça nos constrange&quot;` e `&#8220;` cruas no banco.

---

## O calendário resolve o que o texto cala

Cultos são **quarta à noite**, **domingo de manhã** e **domingo à noite**.

Dia da semana pelas datas escritas: domingo 772, quarta 305, e **35 fora da
agenda** — sábado 6, segunda 9, terça 10, quinta 5, sexta 5. Eventos especiais
existem mesmo.

> **Não existe culto de manhã na quarta.** Essa regra sozinha resolveu o turno
> de 295 posts que não o diziam.

### Erro de ano na virada

Sete posts têm o ano errado. Cinco se confirmam sozinhos: trocando o ano, o dia
da semana passa a bater com o que o próprio cabeçalho afirma.

| escrito | corrigido | cabeçalho diz | |
|---|---|---|---|
| 07/01/**2025** (terça) | 07/01/**2026** (quarta) | quarta-feira | ✅ |
| 05/01/**2024** (sexta) | 05/01/**2025** (domingo) | domingo | ✅ |
| 08/01/**2024** (segunda) | 08/01/**2025** (quarta) | quarta-feira | ✅ |
| 01/05/**2024** (quarta) | 01/05/**2022** (domingo) | domingo | ✅ |

Os outros dois não têm cabeçalho para confirmar e **ficam como estão**.

### A data de publicação não salva os órfãos

265 resenhas não têm data no texto nem marcador de turno. Tentador usar a data
de publicação — mas o blog atrasa de 0 a 5 dias, e a publicação desses 265 cai
em quinta (53), sexta (46) e sábado (21) tanto quanto em domingo (58).

A regra "último domingo ou quarta antes da publicação" foi medida contra os
1.061 posts com data confiável:

| publicação | acerto |
|---|---|
| domingo, segunda, terça | **98%** |
| quarta | 89% |
| quinta | 87% |
| sexta | 76% |
| sábado | 71% |

Aplicada aos 265, acertaria ~233 e erraria ~32. **Decisão: não inferir.**
A data fica `null`, a resenha inteira é preservada, e a análise temporal filtra
`origemData = 'TEXTO'`.

> Apagar os 265 destruiria 84% de 2016 — pregações completas, com título, texto,
> pregador e referência bíblica. O único campo ruim é a data.

---

## Cobertura do parser sobre as 1.409

| campo | preenchido |
|---|---|
| pregador | **1.369** — 97% |
| referência bíblica | **1.385** — 98% |
| data | **1.112** — 79% |
| turno | **1.075** — 76% |
| crédito de redação | 147 |

O que falta está na fila de revisão: **40 sem pregador**, **297 sem data**,
**24 sem referência**.

A referência bíblica subiu de 80% para 98% quando o parser passou a buscar no
corpo — o texto base costuma vir logo depois do cabeçalho e da data, e não no
título.

---

## O blog limita a taxa

Baixar 1.409 páginas com 6 requisições em paralelo, sem pausa, rende **98 erros
HTTP 503**. Com insistência (4 tentativas, espera dobrando), concorrência 4 e
pausa entre lotes: **zero**.

## O encoding do blog está correto

O mojibake dos JSONs antigos (`informa��o`, `f�`) era defeito do scraper, não
do blog. A página renderizada vem em UTF-8 íntegro.
