# 📊 Projeto de Análise Teológica de Pregações

**Baseado no framework CRISP-DM e na Teologia Sistemática de Wayne Grudem**

---

## 🧭 Visão Geral

Este projeto tem como objetivo **organizar, estruturar e analisar pregações bíblicas** da igreja, transformando textos brutos em uma **base teológica estruturada**, fiel às Escrituras e útil para:

* análise histórica do ensino da igreja
* identificação de ênfases teológicas ao longo do tempo
* apoio ao planejamento pastoral e séries de mensagens
* preservação da memória doutrinária da comunidade

O projeto segue o **framework CRISP-DM**, adaptado para um contexto teológico-pastoral.

---

## 🎯 Objetivos do Projeto

* Classificar pregações segundo uma **taxonomia baseada em Wayne Grudem**
* Identificar temas principais e secundários por mensagem
* Extrair metadados bíblicos (livro, texto base)
* Analisar progressões e ciclos teológicos ao longo dos anos
* Criar uma base reutilizável para estudos futuros

---

## 🧠 Metodologia (CRISP-DM Adaptado)

### 1️⃣ Business Understanding

**Pergunta central:**

> O que estamos ensinando como igreja, ao longo do tempo?

Definição do propósito teológico, pastoral e histórico do projeto.

---

### 2️⃣ Data Understanding

* Compreensão dos dados disponíveis (JSON de pregações)
* Identificação de campos confiáveis e texto livre
* Avaliação de lacunas e inconsistências

---

### 3️⃣ Data Preparation (fase crítica)

* Normalização dos dados
* Limpeza do texto das pregações
* Extração de metadados bíblicos
* Classificação temática e teológica
* Aplicação da taxonomia de Grudem

---

### 4️⃣ Modeling

Criação de modelos simples e interpretáveis:

* Frequência de temas por ano
* Distribuição teológica por pregador
* Progressão espiritual ao longo do tempo

> Não é IA “caixa-preta”, mas **modelagem interpretável e pastoralmente responsável**.

---

### 5️⃣ Evaluation

Avaliação teológica dos resultados:

* A classificação reflete fielmente o conteúdo?
* Há distorções ou leituras enviesadas?
* Os dados fazem sentido à luz das Escrituras?

---

### 6️⃣ Deployment

Entrega dos resultados em formatos reutilizáveis:

* JSON estruturado
* CSV para análises
* Relatórios simples
* Base pronta para expansão futura

---

## 🧱 Taxonomia Teológica (Base)

Adaptada da **Teologia Sistemática de Wayne Grudem**, com linguagem pastoral e aplicável à análise de pregações.

Cada pregação recebe:

* **1 tema principal**
* **até 2 temas secundários**

A classificação segue três níveis:

* **Doutrina (nível 1)**
* **Subtemas (nível 2)**
* **Indicadores textuais (nível 3 – usados no script)**

---

## 1️⃣ Doutrina da Palavra de Deus

**Pergunta central:**

> O que esta pregação ensina sobre a Bíblia e sua autoridade?

### Subtemas

* Autoridade das Escrituras
* Suficiência da Palavra
* Revelação de Deus
* Pregação expositiva
* Aplicação da Palavra

### Indicadores textuais

* “A Palavra de Deus diz…”
* “A Bíblia nos ensina…”
* “Segundo as Escrituras…”
* Ênfase em leitura, explicação e aplicação do texto bíblico

---

## 2️⃣ Doutrina de Deus

**Pergunta central:**

> Quem Deus é, segundo esta mensagem?

### Subtemas

* Caráter de Deus
* Santidade de Deus
* Soberania de Deus
* Trindade
* Deus como Criador e Sustentador

### Indicadores textuais

* “Deus é santo…”
* “Deus é soberano…”
* “Nada foge do controle de Deus…”
* Ênfase nos atributos divinos

---

## 3️⃣ Doutrina do Homem

**Pergunta central:**

> O que esta pregação ensina sobre a condição humana?

### Subtemas

* Pecado
* Queda
* Consciência
* Idolatria do coração
* Necessidade de salvação

### Indicadores textuais

* “O coração do homem…”
* “Somos pecadores…”
* “Nossa inclinação ao pecado…”
* Ênfase na fragilidade e limitação humana

---

## 4️⃣ Doutrina de Cristo

**Pergunta central:**

> Quem é Jesus e qual é o Seu papel?

### Subtemas

* Encarnação
* Cruz
* Ressurreição
* Senhorio de Cristo
* Mediação

### Indicadores textuais

* “Cristo morreu por nós…”
* “Jesus é o Senhor…”
* “Somente em Cristo…”
* Ênfase na obra e na pessoa de Jesus

---

## 5️⃣ Doutrina da Salvação (Soteriologia)

**Pergunta central:**

> Como o ser humano é salvo?

### Subtemas

* Novo nascimento
* Justificação
* Graça
* Fé
* Santificação
* Perseverança dos santos

### Indicadores textuais

* “Nascer de novo…”
* “Somos salvos pela graça…”
* “Arrependimento e fé…”
* Chamados à conversão e mudança de vida

---

## 6️⃣ Doutrina do Espírito Santo

**Pergunta central:**

> Como o Espírito Santo atua na vida do crente?

### Subtemas

* Regeneração
* Convicção do pecado
* Vida no Espírito
* Santificação
* Consolação

### Indicadores textuais

* “O Espírito Santo nos convence…”
* “Deus habita em nós…”
* “Somos guiados pelo Espírito…”
* Ênfase na ação presente de Deus

---

## 7️⃣ Doutrina da Igreja

**Pergunta central:**

> O que significa viver como corpo de Cristo?

### Subtemas

* Corpo de Cristo
* Comunhão
* Disciplina
* Perdão
* Missão
* Vida comunitária

### Indicadores textuais

* “Como igreja…”
* “Corpo de Cristo…”
* “Relacionamentos restaurados…”
* Ênfase na vida comunitária e ética cristã

---

## 8️⃣ Doutrina das Últimas Coisas (Escatologia)

**Pergunta central:**

> Para onde caminha a história e a fé cristã?

### Subtemas

* Esperança cristã
* Juízo final
* Eternidade
* Segunda vinda de Cristo
* Nova criação

### Indicadores textuais

* “Vida eterna…”
* “Aguardamos a volta de Cristo…”
* “Nossa pátria está nos céus…”
* Ênfase na esperança futura

---

## 📌 Regra de Classificação

* **Tema principal:** doutrina dominante da mensagem
* **Temas secundários:** doutrinas claramente presentes, mas não centrais
* A classificação considera **conteúdo + título**, com prioridade para o conteúdo

---

> “Maneja bem a Palavra da verdade.”
> *(2 Timóteo 2:15)*


---

## 📁 Estrutura do Projeto

```
src/
├── data/                # JSONs brutos por ano
│   └── pregacoes_2016.json
│
├── services/            # Lógica de processamento
│   ├── loader.py
│   ├── normalizer.py
│   ├── text_cleaner.py
│   ├── metadata_extractor.py
│   ├── theology_mapper.py
│   └── pipeline.py
│
├── output/              # Dados processados e análises
│
└── README.md
```

---

## 🛠️ Tecnologias e Princípios

* Python (scripts simples e auditáveis)
* JSON como formato base
* Automação **semi-automática**, com revisão humana
* Fidelidade bíblica acima de performance técnica

---

## ✝️ Princípios Norteadores

* 📖 Submissão total às Escrituras
* 🧠 Clareza teológica
* 🫱🏽‍🫲🏾 Responsabilidade pastoral
* 🔍 Transparência metodológica
* 🏗️ Projeto replicável e sustentável

---

## 🚀 Próximos Passos

1. Implementar `loader.py` e `normalizer.py`
2. Gerar o primeiro JSON normalizado
3. Aplicar a taxonomia teológica
4. Iniciar a fase de modelagem

---

> “Tudo deve ser feito para edificação.”
> *(1 Coríntios 14:26)*

---

📌 **Este projeto é vivo** e pode crescer conforme novas pregações e novos objetivos surgirem.
