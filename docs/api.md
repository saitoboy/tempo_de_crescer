# API

**Documentação interativa: [`/api/v1/docs`](http://localhost:3003/api/v1/docs)**
Especificação crua: `/api/v1/openapi.json`

Base: `http://localhost:3003/api/v1`

> O Swagger é gerado a partir dos mesmos esquemas Zod que as rotas usam para
> validar, via `z.toJSONSchema()` — não há anotação duplicada, e a documentação
> não tem como divergir do que a API aceita.

**Leitura é aberta** — o conteúdo já é público no blog da igreja.
**Escrita exige token**: `Authorization: Bearer $API_TOKEN`.

> O token único é provisório. O login por usuário e senha, com os papéis
> `ADMIN`, `PASTOR` e `LIDER` que já estão no schema, entra na Fase 7.

---

## Saúde

### `GET /health` · `GET /api/v1/health`

O sem prefixo fica fora da versão de propósito: é o endereço que o EasyPanel
consulta para saber se o contêiner está vivo.

```json
{ "ok": true, "resenhas": 1409, "cultos": 1026, "pregadores": 51 }
```

---

## Resenhas

### `GET /api/v1/resenhas/pendentes`

A fila de revisão: o que a ingestão não conseguiu completar sozinha.

| filtro | tipo | efeito |
|---|---|---|
| `semPregador` | `true`/`false` | só as sem assinatura |
| `semData` | `true`/`false` | só as sem data no texto |
| `ano` | número | restringe ao ano |
| `pagina` | número | padrão 1 |
| `porPagina` | número | padrão 20, máximo 100 |

Sem filtro, devolve tudo que tem **alguma** lacuna. Com `semPregador` e
`semData` juntos, devolve só as que têm **as duas**.

```bash
curl "http://localhost:3003/api/v1/resenhas/pendentes?semPregador=true&porPagina=5"
```

```json
{
  "total": 40,
  "pagina": 1,
  "porPagina": 5,
  "paginas": 8,
  "resenhas": [
    {
      "id": "061e3d1a-…",
      "slug": "2026-04-cristo-rocha-eterna",
      "titulo": "Cristo, Rocha Eterna",
      "urlBlog": "https://pregacoesibps.blogspot.com/2026/04/…",
      "publicadoEm": "2026-04-14T00:00:00.000Z",
      "dataPregacao": "2026-04-12T00:00:00.000Z",
      "origemData": "TEXTO",
      "pregadorBruto": null,
      "textoBase": "Atos 1:1-12",
      "pregador": null,
      "culto": { "data": "…", "turno": "NOITE", "natureza": "CULTO" }
    }
  ]
}
```

### `GET /api/v1/resenhas`

Listagem geral. Filtros: `ano`, `pregadorId`, `pagina`, `porPagina`.

### `GET /api/v1/resenhas/:id`

Uma resenha completa, com `culto`, `pregador`, `classificacoes` (com a
doutrina) e `devocional`.

### `PATCH /api/v1/resenhas/:id` 🔒

Correção manual. Tudo que passa por aqui é marcado **`MANUAL`**, separado do
que o parser extraiu do texto (`TEXTO`).

| campo | tipo | observação |
|---|---|---|
| `pregadorId` | uuid | de quem já está cadastrado |
| `pregadorNome` | texto | resolvido pelos aliases |
| `criarSeNaoExistir` | booleano | autoriza cadastrar gente nova |
| `dataPregacao` | `AAAA-MM-DD` | data de calendário |
| `turno` | `DIA` \| `NOITE` | |
| `natureza` | `CULTO` \| `CELEBRACAO` \| `EBD` \| `ESTUDO` \| `VIGILIA` \| `CONFERENCIA` \| `FUNEBRE` | |

`pregadorId` e `pregadorNome` são mutuamente exclusivos. Ao menos um campo é
obrigatório. O `Culto` é reconstruído quando data, turno ou natureza mudam.

```bash
curl -X PATCH "http://localhost:3003/api/v1/resenhas/$ID" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pregadorNome":"Nélio","turno":"NOITE"}'
```

#### A correção não inventa pregador

Nome que não resolve pelos aliases é **recusado**, com sugestão:

```json
{
  "status": "erro",
  "mensagem": "\"Nelio Montero\" não está no cadastro de pregadores",
  "codigo": "VALIDATION",
  "detalhes": [{
    "campo": "pregadorNome",
    "mensagem": "você quis dizer: Nélio Monteiro? Se for alguém novo, envie criarSeNaoExistir: true"
  }]
}
```

Sem essa trava, um erro de digitação recria o problema que encheu o banco de
`Deus` e `Nélio Monteiro Noite`.

---

## Cultos

### `GET /api/v1/cultos`

Filtros: `ano`, `turno` (`DIA`/`NOITE`), `natureza`, `comVideo`, `pagina`, `porPagina`.

Cada culto vem com as resenhas dele e com `qrcode` já em forma embutível:

```json
{
  "data": "2026-08-09T00:00:00.000Z",
  "turno": "NOITE",
  "natureza": "CULTO",
  "youtubeUrl": "https://www.youtube.com/watch?v=CqiCTBDIRVc",
  "tituloLive": "AINDA HÁ LUGAR  I Pr. Nélio Monteiro",
  "qrcode": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0i…",
  "resenhas": [{ "titulo": "Ainda há lugar.", "textoBase": "Lucas 14:12-15" }]
}
```

### `GET /api/v1/cultos/:id/qrcode.svg`

O QR da transmissão, em SVG puro — para imprimir no livro.
Devolve **404** quando o culto não tem vídeo (todos antes de 2020).

---

## Pregadores

### `GET /api/v1/pregadores`

```json
[
  { "id": "…", "nomeCanonico": "Nélio Monteiro", "tipo": "PASTOR",
    "aliases": ["nelio monteiro", "nelio", "nélio"], "resenhas": 1035 }
]
```

Tipos: `PASTOR`, `SEMINARISTA`, `CONVIDADO`, `IRMAO`.

### `POST /api/v1/pregadores` 🔒

```json
{ "nomeCanonico": "João da Silva", "tipo": "CONVIDADO", "aliases": ["joao silva"] }
```

O nome canônico entra automaticamente como alias.

### `POST /api/v1/pregadores/:id/fundir` 🔒

Funde dois cadastros que são a mesma pessoa. As resenhas do absorvido passam
para o que fica, e as grafias dele viram aliases — para a próxima ingestão não
o recriar.

```json
{ "deId": "uuid-do-que-sera-absorvido" }
```

```json
{ "status": "ok", "mensagem": "\"Estevam\" virou \"Estevão Vianna\"", "resenhasMovidas": 1 }
```

---

## Erros

Formato único, traduzido pelo mapeamento do logger.

| código | HTTP | quando |
|---|---|---|
| `NAO_AUTORIZADO` | 401 | token ausente ou inválido |
| `SEM_TOKEN_CONFIGURADO` | 503 | `API_TOKEN` não definido no servidor |
| `VALIDATION` | 400 | corpo inválido, com a lista de campos |
| `NOT_FOUND` | 404 | recurso não existe |
| `FORBIDDEN` | 403 | papel sem permissão *(Fase 7)* |
| `INTERNAL_ERROR` | 500 | falha nossa |

O 500 nunca traz detalhe: o erro completo vai para o log, e a resposta não
vaza caminho de arquivo nem estrutura do banco.

```json
{
  "status": "erro",
  "mensagem": "Dados inválidos",
  "codigo": "VALIDATION",
  "detalhes": [{ "campo": "dataPregacao", "mensagem": "Invalid ISO date" }],
  "timestamp": "2026-08-12T13:33:39.823Z"
}
```
