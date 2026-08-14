# Plano do front

Fase 7 do [plano geral](plano.md). Interface interna da equipe sobre a API v1 que
já está pronta. Nada de público: toda tela exige login.

> Documento de decisão, não de código. O que está aqui é para não ser inventado
> na hora de construir.

---

## 1. O que é

**Modo: operar.** Ninguém vem ser convencido — vem terminar uma tarefa. Beleza
aqui não é enfeite, é a diferença entre enxergar 40 pendências e afogar nelas.

Três trabalhos, nessa ordem de frequência:

| trabalho | quem | onde |
|---|---|---|
| Revisar pendência (pregador, data) | ADMIN | celular, minutos soltos |
| Ler o acervo e a análise doutrinária | PASTOR, LIDER | desktop, sessão longa |
| Montar o mês do livro | ADMIN | desktop, sessão longa |

**As duas topologias são de verdade** — não é "desktop com breakpoint". Celular
tem barra inferior em pílula e cartão empilhado; desktop tem barra lateral fixa e
grade de 12 colunas. Mesmo sistema visual, navegação diferente, porque o uso é
diferente.

---

## 2. Decisões travadas

| assunto | decisão | motivo |
|---|---|---|
| Stack | Vite + React + TypeScript + Tailwind v4 + shadcn/ui | escolha do usuário; componente pronto, tema por token |
| Onde mora | `D:\tempo-de-crescer\front-tempo_de_crescer`, ao lado do back | projeto separado: deploy, versão e histórico independentes |
| Dados | TanStack Query | ~20 endpoints com carga, erro e cache; a alternativa é `useEffect` repetido 20 vezes |
| Rotas | React Router | padrão da stack |
| Formulário | estado controlado + Zod | só há dois formulários de verdade (login e correção). React Hook Form seria dependência para nada |
| Gráfico | Recharts, via o `chart` do shadcn | uma biblioteca só, cor vinda de variável CSS |
| Fonte | Urbanist, auto-hospedada (`@fontsource-variable/urbanist`) | é a fonte da referência; auto-hospedar tira a chamada externa e sobrevive ao proxy |
| Ícone | Lucide | já vem com o shadcn |
| Estado global | nenhum | sessão em um contexto de 30 linhas; o resto é cache do Query |
| PWA | `manifest.webmanifest` estático, sem service worker | o pedido é "adicionar à tela inicial"; SW só entra se offline virar requisito |

**Fora por enquanto (YAGNI):** tema escuro, i18n, exportação para planilha,
notificação push, upload de imagem, edição do texto do devocional na tela.

---

## 3. Mundo visual

Fixado pelas referências em `CONTEXTO/front-end (4..15).png`. Não é inspiração
solta — é o sistema a ser executado.

O que as referências estabelecem: fundo off-white, cartão branco de canto muito
arredondado com sombra baixa e difusa, faixa de gradiente azul-bebê no topo,
número grande e fino como protagonista, muito ar entre blocos, e gráfico feito de
traço fino em vez de barra cheia.

### Cor

```
--fundo        #F4F5F7   ambiente, nunca branco puro
--superficie   #FFFFFF   cartão
--borda        #ECEEF1   hairline; separação sem linha preta
--tinta        #2B3641   texto principal (13.2:1 no fundo)
--tinta-2      #66727E   rótulo, legenda (5.4:1)
--tinta-3      #A3AEB8   marca d'água, eixo, desabilitado — nunca texto útil

--azul         #ACCDEA   marca, preenchimento, gradiente
--verde        #9DDA8F   confirmado, completo
--coral        #F79090   pendente, divergente
--amarelo      #F6D55D   atenção, parcial

--azul-tinta   #2F6F9E   texto/ícone sobre claro, foco, ação (4.9:1)
--verde-tinta  #3F7F35   idem
--coral-tinta  #B44343   idem
--ambar-tinta  #8A6A00   idem

--cabecalho    linear-gradient(#DCEBF8 → #F4F8FC)
--sombra       0 1px 2px rgba(30,45,60,.04), 0 8px 24px rgba(30,45,60,.06)
--raio         cartão 24px · controle 12px · pílula 999px
```

**A regra que impede o desastre:** os quatro pastéis são *preenchimento*. Texto,
ícone e borda de foco usam a versão `-tinta`. `#ACCDEA` sobre branco dá 1,6:1 —
lindo como área, ilegível como letra. É por isso que a paleta tem oito entradas e
não quatro.

### Tipografia

Urbanist, três pesos: Light 300, Regular 400, Medium 500. Nunca Bold — a
referência inteira vive nos pesos finos, e engrossar mata o mundo.

| papel | desktop | celular | peso |
|---|---|---|---|
| número herói | 64px | 40px | 300 |
| título de página | 32px | 26px | 300 |
| título de cartão | 20px | 18px | 500 |
| corpo | 16px | 16px | 400 |
| rótulo | 13px, maiúscula, tracking 0.08em | idem | 500 |

Número sempre com `font-variant-numeric: tabular-nums`. Coluna de número que
dança na atualização é defeito.

### Movimento

Só três, e nenhum decorativo: cartão entra com fade de 160ms na primeira carga;
número conta até o valor em 400ms quando ele muda; barra de gráfico cresce do
zero uma vez. `prefers-reduced-motion` desliga os três.

---

## 4. Sistema de gráficos

Consistência vem de **haver poucos tipos**, não de cada tela inventar o seu. São
três componentes, e nenhuma tela usa outro:

| componente | forma | serve para |
|---|---|---|
| `Pente` | dezenas de barras de 2px, espaçadas | série longa: pregação por mês, cobertura por livro bíblico |
| `Anel` | donut de trilho cinza com um arco | proporção de uma coisa só: devocionais prontos, cultos com vídeo |
| `Ranking` | barra horizontal, rótulo à esquerda, número à direita | comparação nomeada: doutrinas, pregadores, livros mais pregados |

### As regras de cor do dado

1. **Cor categórica só até 4 categorias.** Acima disso, uma cor só e a ordem faz
   o trabalho. Oito doutrinas em oito cores viram confete — e a ordem já diz o
   que interessa.
2. **Cor com significado é reservada:** verde = pronto, coral = pendente,
   amarelo = parcial. Nunca usar verde só porque é bonito ali.
3. **Série neutra é azul.** Um azul, com opacidade variando entre 100% e 35% para
   dar profundidade sem virar arco-íris.
4. **Nunca só cor.** Todo estado tem rótulo ou ícone junto. Daltonismo, e também
   impressão em preto e branco.
5. **Eixo é `--tinta-3`, grade é hairline ou não existe.** A referência quase não
   tem grade; o número fica ao lado do gráfico, não dentro dele.

### Cada análise vira qual gráfico

| endpoint | gráfico |
|---|---|
| `/analise/panorama` | 4 números herói + `Anel` de devocionais prontos |
| `/analise/doutrinas` | `Ranking` de 8 barras, azul, ordenado |
| `/analise/evolucao` | `Pente` empilhado por ano — um pente por ano, 8 segmentos |
| `/analise/pregadores` | tabela com `Pente` embutido por linha (mini) |
| `/analise/biblia` | `Pente` de 66 posições, AT e NT separados; nunca pregado em `--tinta-3` |

O achado dos nove livros nunca pregados é o momento memorável do app. Ele merece
tratamento próprio: bloco com os nove nomes por extenso, não uma barra de valor
zero que ninguém enxerga.

---

## 5. Arquitetura de pastas

Projeto separado, irmão do back:

```
D:\tempo-de-crescer\
├── back-tempo_de_crescer\     API, banco, scripts (este repositório)
└── front-tempo_de_crescer\    ↓
```

```
front-tempo_de_crescer/
├── .env                     VITE_API_URL — a única variável, e ela não é segredo
├── public/
│   ├── manifest.webmanifest
│   ├── icone-192.png · icone-512.png · apple-touch-icon.png
├── src/
│   ├── app/
│   │   ├── main.tsx            entrada
│   │   ├── rotas.tsx           mapa de rotas + guarda de sessão
│   │   └── provedores.tsx      Query + Sessão
│   ├── paginas/
│   │   ├── entrar/
│   │   ├── painel/
│   │   ├── curadoria/          fila, correção, pregadores
│   │   ├── acervo/             lista + detalhe da resenha
│   │   ├── analise/            panorama, doutrinas, evolução, pregadores, bíblia
│   │   └── livro/              temas do mês, escolha, ordem, impressão
│   ├── componentes/
│   │   ├── ui/                 shadcn — gerado, não editar à mão
│   │   ├── grafico/            Pente · Anel · Ranking
│   │   ├── layout/             Casca · BarraLateral · BarraInferior · Cabecalho
│   │   └── estado/             Vazio · Carregando · Erro · SemPermissao
│   ├── api/
│   │   ├── cliente.ts          fetch + token + tradução de erro
│   │   ├── esquemas.ts         Zod das respostas
│   │   └── recursos/           umPorArquivo: resenhas.ts, temas.ts, analise.ts…
│   ├── lib/
│   │   ├── sessao.ts · formatar.ts · cn.ts
│   └── estilos/
│       ├── tokens.css          as variáveis da seção 3
│       └── index.css
```

### O que a separação custa, e como se paga

| custa | pago com |
|---|---|
| contrato pode divergir sem ninguém ver | tipos gerados do `openapi.json` (seção 6) |
| CORS deixa de ser opcional | `FRONT_ORIGEM` no back, obrigatório |
| dois deploys, duas versões | back é compatível com o front anterior; nenhuma rota some sem aviso |
| este plano mora no repositório do back | é aqui que ele nasceu; o front leva um `README.md` curto apontando para cá |

Regra de arrumação: **página não chama `fetch`**. Página usa hook de `api/recursos`.
Componente de `ui/` não sabe o que é uma resenha. Se um componente precisa saber,
ele não é `ui/`.

---

## 6. Segurança

O princípio: **o front é uma vitrine burra sobre um servidor que decide tudo.**

### Nada de regra no cliente

Alias de pregador, validação de nome, reconstrução de culto, escolha do versículo,
z-score, geração do HTML do livro — tudo já vive no servidor e continua lá. O
front manda o que o usuário digitou e mostra a resposta, inclusive a recusa com
sugestão ("você quis dizer: Nélio Monteiro?").

Enum também não se duplica. `turno`, `natureza`, tipo de pregador e papel só
existem em Zod no servidor hoje — **o front precisa de um `GET /api/v1/meta`**
que devolva essas listas. Sem isso, o primeiro `<select>` já nasce com regra
copiada à mão, que envelhece calada.

### Token magro

O JWT já carrega `sub`, `email`, `papel` — só isso, e continua assim. Nada de
nome, foto ou permissão detalhada dentro do token.

- O front **nunca decodifica o JWT.** Quem sou eu vem de `GET /sessao/eu`.
- Token guardado em memória, com cópia em `sessionStorage` só para sobreviver ao
  F5. Some ao fechar a aba.
- 401 em qualquer resposta → limpa sessão e volta para o login. Um lugar só, no
  `cliente.ts`.
- Esconder botão por papel é conveniência. **A trava é o servidor** — e é ele que
  responde 403.

### Entrada e saída

- **Nenhum `dangerouslySetInnerHTML` no projeto.** Vira regra de lint.
- **QR code entra por `<img src="data:image/svg+xml;base64,…">`**, nunca inline.
  SVG inline é DOM e executa script; dentro de `<img>` é inerte. O dado vem do
  nosso banco, mas a diferença custa zero e fecha a porta.
- `/livro/imprimir.html` abre em aba nova (`rel="noopener"`), não em `iframe` que
  compartilha origem.
- Todo corpo enviado passa por Zod no cliente antes de sair: rejeita cedo, com
  mensagem melhor. Não substitui a validação do servidor — duplica de propósito.
- **O tipo das respostas vem do `openapi.json`**, não de interface escrita à mão.
  `npm run tipos` roda `openapi-typescript` contra `/api/v1/openapi.json` e grava
  `src/api/tipos.ts`. O Swagger já nasce dos mesmos Zod que validam as rotas, então
  o contrato viaja sozinho entre os dois repositórios. Custo em execução: zero.
- CSP: `default-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' <api>`.
  Fonte auto-hospedada e ícone local existem também por isso.

### O que muda no backend

Três mudanças pequenas, todas necessárias para o app ser interno de verdade:

| # | mudança | por quê |
|---|---|---|
| 1 | Fechar os GET de JSON com `exigirPapel('LIDER','PASTOR')` | hoje leitura é aberta, herança de quando o front seria público |
| 2 | CORS por origem, via `FRONT_ORIGEM` no ambiente | `cors()` sem argumento libera qualquer site a chamar a API com o token do usuário |
| 3 | `GET /api/v1/meta` com os enums | para o front não ter lista de domínio escrita à mão |

Duas rotas ficam **abertas de propósito**: `/cultos/:id/qrcode.svg` e
`/livro/imprimir.html`. O navegador as busca fora do `fetch` — `<img>` e aba nova
não mandam cabeçalho `Authorization`. O conteúdo delas já é público (o QR aponta
para o YouTube da igreja), e fechá-las exigiria token assinado na query string,
que é mais superfície do que o problema pede.

O `API_TOKEN` sai quando as telas de escrita estiverem no ar. Fica um caminho de
autenticação só, como o comentário `ponytail:` em `autenticacao.ts` já pede.

---

## 7. PWA

O pedido é instalar na tela inicial do iPhone. Isso são quatro arquivos e uma
tag — não um framework:

- `manifest.webmanifest` com `name`, `short_name: "Tempo de Crescer"`,
  `display: standalone`, `theme_color: #DCEBF8`, `background_color: #F4F5F7`,
  ícones 192/512 e maskable.
- `apple-touch-icon.png` 180×180 — o iOS ignora o ícone do manifest.
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">` para a
  barra de status casar com o gradiente.
- `viewport-fit=cover` e `env(safe-area-inset-bottom)` na barra inferior, senão a
  pílula fica embaixo da barra do iPhone.

**Sem service worker.** Offline não é requisito: o dado é do servidor e muda. No
dia em que a fila de curadoria precisar funcionar no estacionamento da igreja,
entra `vite-plugin-pwa` — está anotado, não construído.

---

## 8. As telas

| rota | o que faz | come de | papel |
|---|---|---|---|
| `/entrar` | login | `POST /sessao/login` | — |
| `/` | painel: números do acervo, o que está pendente, progresso dos devocionais | `/analise/panorama` | todos |
| `/curadoria` | fila de pendências com filtro (sem pregador, sem data, ano) | `/resenhas/pendentes` | todos veem, ADMIN corrige |
| `/curadoria/:id` | correção: pregador, data, turno, natureza | `PATCH /resenhas/:id` | ADMIN |
| `/curadoria/pregadores` | cadastro, contagem, fusão de grafias | `/pregadores` | ADMIN |
| `/acervo` | lista com filtro por ano e pregador | `/resenhas` | todos |
| `/acervo/:id` | resenha inteira: culto, vídeo, QR, classificação com z-score, devocional | `/resenhas/:id` | todos |
| `/analise` | as cinco visões da seção 4 | `/analise/*` | todos |
| `/livro` | meses, com quantas páginas cada um tem | `/temas` | todos |
| `/livro/:id` | escolha dos devocionais do mês, ordem, prévia | `/temas/:id/*`, `/livro/*` | ADMIN |

### Estados que não podem ser esquecidos

Cada lista tem quatro: **carregando** (esqueleto com a forma do cartão, não
rodinha), **vazio** (frase que diz o que fazer, não "sem dados"), **erro** (a
mensagem do servidor, com botão de tentar de novo), **sem permissão** (LIDER numa
tela de escrita: mostra o conteúdo, esconde o botão, explica em uma linha).

Casos reais que a tela precisa aguentar:

- 271 resenhas indefinidas na classificação — "indefinido" é resposta legítima e
  precisa aparecer como tal, não como buraco.
- 297 resenhas sem data: a lista ordenada por data precisa de um balde "sem data"
  em vez de jogá-las no fim como se fossem antigas.
- 406 cultos sem vídeo, todos anteriores a 2020. O bloco de QR não aparece
  quebrado — some, com uma linha explicando que não houve transmissão.
- Divergência de pregador entre assinatura e título da live: mostrar as duas
  fontes lado a lado, e o botão decide. O servidor nunca escolheu sozinho.
- Devocionais em geração agora, 56 de 1.409. O painel mostra progresso, e nada no
  front dispara geração — ela é local, por CLI.

---

## 9. Entregas

| # | entrega | o que entra |
|---|---|---|
| E0 | Fundação | `front/` de pé, `tokens.css`, casca com barra lateral e barra inferior, login funcionando, `cliente.ts` com token e tradução de erro |
| E1 | **Painel** | a prova visual: números herói, `Anel` de devocionais, pendências, tudo com dado real da API |
| E2 | Curadoria | fila, filtros, tela de correção, pregadores e fusão |
| E3 | Acervo | lista, detalhe com classificação, vídeo e QR |
| E4 | Análise | as cinco visões e os três gráficos |
| E5 | Livro | meses, sugestões (inclusive busca semântica), ordem, prévia e IDML |
| E6 | Acabamento | manifest, ícones, área segura do iPhone, revisão de acessibilidade e desempenho |

**E1 é a prova visual**, e existe antes de E2 a E5 de propósito: trava o mundo
visual (cor, tipo, cartão, gráfico) numa tela real, com dado real, antes de
espalhá-lo por vinte outras. Refazer uma tela é barato; refazer vinte não é.

As três mudanças de backend da seção 6 entram junto com E0.

---

## 10. O que ainda não está decidido

- **Ícone e marca.** Não há logotipo do "Tempo de Crescer" no repositório — há um
  PDF do livro em `CONTEXTO/`. O ícone do PWA precisa de alguém que decida: sai
  do livro, é feito, ou é uma letra na cor da marca por enquanto?
- **Onde o front é servido.** Mesmo domínio da API (mais simples, CORS deixa de
  existir) ou serviço separado no EasyPanel?
- **Fechar a leitura fecha o Swagger também?** O `/api/v1/docs` é público hoje.

Nenhuma delas bloqueia E0 e E1.
