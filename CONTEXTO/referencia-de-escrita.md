# Referência de escrita do devocional

Dois autores, dois papéis distintos — não confundir:

- **Wayne Grudem** é a referência de **classificação**: a taxonomia das 8
  doutrinas que categoriza cada pregação. Nada a ver com estilo de texto.
- **A.W. Tozer** é a referência de **escrita**: é assim que o devocional deve
  soar.

## Amostra de estilo (A.W. Tozer)

> **2 de Janeiro — No Princípio (João 1:1)**
>
> *"No princípio era o Verbo... e o Verbo era Deus" (João 1:1).*
>
> Nenhum de nós pode refletir sobre a natureza eterna e a Pessoa de Jesus
> Cristo sem sentir e confessar a inadequação humana à luz da revelação
> divina. João, em seu evangelho, fornece uma bela imagem do Cristo eterno,
> começando com essas palavras contundentes e incríveis: "No princípio"!
> Meus irmãos, é aqui que começa o entendimento e a revelação do cristianismo!
>
> Muitos outros fizeram variadas alegações, mas somente nosso Cristo é o
> Cristo de Deus. Certamente Buda, Maomé, José Smith, Sra. Eddy ou George
> Baker não o eram! Todos esses e incontáveis outros como eles tiveram um
> início, mas também tiveram um fim.
>
> Que incrível diferença! Nossa vida cristã começa com o eterno Filho de Deus.
> Esse é o nosso Senhor Jesus Cristo: o Verbo que estava com o Pai no
> princípio; o Verbo que era Deus; e o Verbo que é Deus! Ele é o único que
> pode nos garantir: "...ninguém vem ao Pai senão por mim" (João 14:6).
>
> Amado Pai celestial, ajuda-me a viver todos os dias como um humilde e grato
> filho do Deus eterno.

## O que caracteriza esse estilo

- Abre pelo peso teológico do texto, não por anedota.
- Fala com a igreja, em segunda pessoa do plural: "meus irmãos", "nossa vida".
- Frases curtas e afirmativas, com exclamação usada de verdade.
- Sustenta a afirmação com outra passagem, citada entre aspas e referenciada.
- Fecha em oração curta e direta, em primeira pessoa.
- Não modera o que a Escritura afirma, nem suaviza contraste doutrinário.

## A página do livro

O modelo escaneado está em `modelo-pagina.jpeg`. Os blocos, na ordem:

| bloco | campo em `Devocional` | origem |
|---|---|---|
| Título, caixa alta | `titulo` | gerado |
| Versículo em itálico + referência | `versiculo`, `referencia` | gerado; texto vem da tabela `Versiculo` |
| **Data** | — | `Culto.data` ou `Resenha.dataPregacao` |
| **Pastor** | — | `Resenha.pregador.nomeCanonico` |
| **REFLEXÃO DEVOCIONAL** | `reflexao` | gerado |
| **PONTOS DE APLICAÇÃO PRÁTICA** | `pontosAplicacao` | gerado, 3 a 5 itens |
| **ASSISTA ON-LINE** (QR code) | — | `Culto.youtubeUrl` |
| **ORAÇÃO** | `oracao` | gerado, primeira pessoa do plural |
| **ANOTAÇÕES** | — | espaço em branco impresso |
| Número da página | — | diagramação |

Repare que a oração da página do livro está em primeira pessoa do **plural**
("Deus, nosso Pastor, te agradecemos"), enquanto a de Tozer está no singular.
Vale a da página: o livro é lido pela igreja reunida.

## Motor de geração

Groq com llama entregava texto fraco e foi descartado. A geração usa o
**Claude Opus pelo CLI local**, consumindo a assinatura em vez da chave de
API. A fila são as resenhas sem devocional.
