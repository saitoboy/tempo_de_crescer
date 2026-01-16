#!/usr/bin/env python3
"""
🏷️ THEMATIC_CLASSIFIER.PY v3.1 - Classificador Híbrido (TF-IDF + Heurístico)

METODOLOGIA:
Este é um sistema híbrido que combina:
1. TF-IDF estatístico para tokens individuais
2. Scoring heurístico para n-grams teológicos (frases-chave)
3. Contextualização semântica para desambiguação

DECISÃO METODOLÓGICA:
Escolhemos modelo híbrido porque:
- Teologia usa frases técnicas ("novo nascimento", "justificação pela fé")
- TF-IDF puro não captura semântica teológica
- Heurística pura não generaliza
- Híbrido maximiza interpretabilidade + acurácia contextual

CIENTISTA RESPONSÁVEL: Guilherme Saito
VERSÃO: 3.1 (Rigorosa)
DATA: Janeiro 2026
"""

import json
import re
import math
from typing import Dict, List, Optional, Tuple, Set
from collections import Counter, defaultdict
from pathlib import Path
import statistics


class ThematicClassifier:
    """
    Classificador Temático Híbrido (TF-IDF + Heurístico)
    
    Combina análise estatística (TF-IDF) com conhecimento teológico especialista
    para classificar pregações na Taxonomia de Wayne Grudem.
    """
    
    def __init__(self):
        """Inicializa o classificador"""
        
        # ========== TAXONOMIA DE GRUDEM ==========
        self.taxonomia_grudem = {
            1: {
                "nome": "Doutrina da Palavra de Deus",
                "pergunta_central": "O que esta pregação ensina sobre a Bíblia e sua autoridade?",
                "subtemas": [
                    "Autoridade das Escrituras",
                    "Suficiência da Palavra",
                    "Revelação de Deus",
                    "Pregação expositiva",
                    "Aplicação da Palavra"
                ]
            },
            2: {
                "nome": "Doutrina de Deus",
                "pergunta_central": "Quem Deus é, segundo esta mensagem?",
                "subtemas": [
                    "Caráter de Deus",
                    "Santidade de Deus",
                    "Soberania de Deus",
                    "Trindade",
                    "Deus como Criador e Sustentador"
                ]
            },
            3: {
                "nome": "Doutrina do Homem",
                "pergunta_central": "O que esta pregação ensina sobre a condição humana?",
                "subtemas": [
                    "Pecado",
                    "Queda",
                    "Consciência",
                    "Idolatria do coração",
                    "Necessidade de salvação"
                ]
            },
            4: {
                "nome": "Doutrina de Cristo",
                "pergunta_central": "Quem é Jesus e qual é o Seu papel?",
                "subtemas": [
                    "Encarnação",
                    "Cruz",
                    "Ressurreição",
                    "Senhorio de Cristo",
                    "Mediação"
                ]
            },
            5: {
                "nome": "Doutrina da Salvação",
                "pergunta_central": "Como o ser humano é salvo?",
                "subtemas": [
                    "Novo nascimento",
                    "Justificação",
                    "Graça",
                    "Fé",
                    "Santificação",
                    "Perseverança dos santos"
                ]
            },
            6: {
                "nome": "Doutrina do Espírito Santo",
                "pergunta_central": "Como o Espírito Santo atua na vida do crente?",
                "subtemas": [
                    "Regeneração",
                    "Convicção do pecado",
                    "Vida no Espírito",
                    "Santificação",
                    "Consolação"
                ]
            },
            7: {
                "nome": "Doutrina da Igreja",
                "pergunta_central": "O que significa viver como corpo de Cristo?",
                "subtemas": [
                    "Corpo de Cristo",
                    "Comunhão",
                    "Disciplina",
                    "Perdão",
                    "Missão",
                    "Vida comunitária"
                ]
            },
            8: {
                "nome": "Doutrina das Últimas Coisas",
                "pergunta_central": "Para onde caminha a história e a fé cristã?",
                "subtemas": [
                    "Esperança cristã",
                    "Juízo final",
                    "Eternidade",
                    "Segunda vinda de Cristo",
                    "Nova criação"
                ]
            }
        }
        
        
        # ========== N-GRAMS TEOLÓGICOS (SCORING HEURÍSTICO) ==========
        # Frases completas que TF-IDF não captura adequadamente
        self.ngrams_teologicos = {
            1: {
                "alta": [
                    "autoridade das escrituras",
                    "suficiência da palavra",
                    "inerrância bíblica",
                    "pregação expositiva",
                    "sola scriptura"
                ],
                "media": [
                    "palavra de deus",
                    "está escrito",
                    "assim diz o senhor"
                ]
            },
            2: {
                "alta": [
                    "santidade de deus",
                    "soberania de deus",
                    "glória de deus",
                    "atributos de deus",
                    "natureza divina"
                ],
                "media": [
                    "santo dos santos",
                    "deus todo-poderoso"
                ]
            },
            3: {
                "alta": [
                    "natureza pecaminosa",
                    "depravação total",
                    "queda do homem",
                    "todos pecaram"
                ],
                "media": [
                    "coração do homem",
                    "inclinação ao pecado"
                ]
            },
            4: {
                "alta": [
                    "cruz de cristo",
                    "sangue de cristo",
                    "cordeiro de deus",
                    "ressurreição de cristo",
                    "morte substitutiva",
                    "obra redentora"
                ],
                "media": [
                    "filho de deus",
                    "senhor jesus"
                ]
            },
            5: {
                "alta": [
                    "justificação pela fé",
                    "novo nascimento",
                    "nascer de novo",
                    "somos salvos pela graça",
                    "arrependimento e fé",
                    "graça salvadora",
                    "santificação progressiva",
                    "sola fide",
                    "sola gratia"
                ],
                "media": [
                    "vida eterna",
                    "perdão de pecados",
                    "reconciliação com deus"
                ]
            },
            6: {
                "alta": [
                    "espírito santo",
                    "batismo no espírito",
                    "cheios do espírito",
                    "fruto do espírito",
                    "dons espirituais",
                    "vida no espírito"
                ],
                "media": [
                    "consolador",
                    "poder do espírito"
                ]
            },
            7: {
                "alta": [
                    "corpo de cristo",
                    "noiva de cristo",
                    "comunhão dos santos",
                    "edificar a igreja",
                    "missão da igreja"
                ],
                "media": [
                    "família de deus",
                    "povo de deus"
                ]
            },
            8: {
                "alta": [
                    "segunda vinda de cristo",
                    "volta de jesus",
                    "juízo final",
                    "ressurreição dos mortos",
                    "novos céus e nova terra",
                    "vida eterna",
                    "esperança gloriosa"
                ],
                "media": [
                    "maranata",
                    "dia do senhor"
                ]
            }
        }
        
        
        # ========== TOKENS SIMPLES (TF-IDF PURO) ==========
        self.tokens_simples = {
            1: ["bíblia", "escritura", "palavra", "revelação"],
            2: ["deus", "senhor", "criador", "altíssimo"],
            3: ["pecado", "pecador", "carne", "transgressão"],
            4: ["jesus", "cristo", "salvador", "messias"],
            5: ["salvação", "graça", "fé", "redenção"],
            6: ["espírito", "unção", "consolador"],
            7: ["igreja", "irmãos", "comunidade"],
            8: ["eternidade", "céu", "esperança", "glorificação"]
        }
        
        
        # ========== REGRAS DE DESAMBIGUAÇÃO CONTEXTUAL ==========
        self.regras_contexto = {
            "santificação": {
                # "santificação" pode ser Salvação (5) ou Espírito Santo (6)
                "pneumatologia_triggers": ["espírito santo", "espírito opera", "pelo espírito"],
                "soteriologia_triggers": ["fruto da salvação", "processo de", "progressiva"]
            },
            "graça": {
                # "graça" pode ser Deus (2) ou Salvação (5)
                "deus_triggers": ["caráter de deus", "atributo", "natureza"],
                "salvacao_triggers": ["somos salvos", "justificados", "mediante a graça"]
            }
        }
        
        
        # ========== PESOS CALIBRADOS ==========
        self.pesos = {
            # Heurístico (frases teológicas)
            "titulo_ngram_alta": 6.0,           # N-gram teológico no título
            "titulo_ngram_media": 4.0,
            "conteudo_ngram_alta": 3.0,         # N-gram no conteúdo
            "conteudo_ngram_media": 1.5,
            
            # TF-IDF (tokens simples)
            "titulo_token_tfidf": 4.0,          # Token com TF-IDF no título
            "conteudo_token_tfidf": 1.0,        # Token com TF-IDF no conteúdo
            
            # Bônus
            "bonus_diversidade": 2.5,           # Múltiplas expressões específicas
            "livro_biblico": 1.0,               # Peso reduzido (desempate)
            "contexto_direcional": 2.0          # Bônus por contexto identificado
        }
        
        
        # ========== CACHE TF-IDF ==========
        self.idf_cache = {}
        self.total_documentos = 0
        self.pontuacoes_historico = defaultdict(list)  # Para calcular percentis
    
    
    def treinar_idf(self, pregacoes: List[Dict]):
        """
        Treina IDF (Inverse Document Frequency) APENAS para tokens simples
        
        DECISÃO METODOLÓGICA:
        N-grams teológicos usam scoring heurístico, não TF-IDF
        Apenas tokens individuais são processados estatisticamente
        
        Args:
            pregacoes: Lista completa de pregações
        """
        print("\n🧠 Treinando TF-IDF (apenas tokens simples)...")
        
        self.total_documentos = len(pregacoes)
        documento_com_palavra = Counter()
        
        # Conta em quantos documentos cada TOKEN aparece
        for pregacao in pregacoes:
            conteudo = f"{pregacao.get('titulo', '')} {pregacao.get('conteudo_limpo', '')}".lower()
            
            # Tokeniza (palavras simples, não frases)
            palavras_unicas = set(conteudo.split())
            
            for palavra in palavras_unicas:
                documento_com_palavra[palavra] += 1
        
        # Calcula IDF
        for palavra, doc_freq in documento_com_palavra.items():
            self.idf_cache[palavra] = math.log(self.total_documentos / doc_freq)
        
        print(f"✅ IDF calculado para {len(self.idf_cache):,} tokens")
        
        # Mostra distribuição
        palavras_raras = sorted(self.idf_cache.items(), key=lambda x: x[1], reverse=True)[:5]
        palavras_comuns = sorted(self.idf_cache.items(), key=lambda x: x[1])[:5]
        
        print(f"\n   📊 Tokens RAROS (IDF alto):")
        for palavra, idf in palavras_raras:
            print(f"      • {palavra}: {idf:.2f}")
        
        print(f"\n   📊 Tokens COMUNS (IDF baixo):")
        for palavra, idf in palavras_comuns:
            print(f"      • {palavra}: {idf:.2f}")
    
    
    def calcular_tfidf_token(self, token: str, freq: int) -> float:
        """
        Calcula TF-IDF de um TOKEN individual
        
        Args:
            token: Palavra simples
            freq: Frequência no documento
            
        Returns:
            Score TF-IDF
        """
        idf = self.idf_cache.get(token.lower(), 1.0)
        return freq * idf
    
    
    def normalizar_por_tamanho(self, pontuacao: float, tamanho_doc: int) -> float:
        """
        Normaliza pontuação pelo tamanho do documento
        
        JUSTIFICATIVA CIENTÍFICA:
        Documentos longos naturalmente têm mais matches
        Normalização evita viés de tamanho
        
        Args:
            pontuacao: Pontuação bruta
            tamanho_doc: Número de palavras
            
        Returns:
            Pontuação normalizada
        """
        # Normaliza para documento de 1000 palavras (baseline)
        baseline = 1000
        fator = baseline / max(tamanho_doc, 100)  # min 100 para evitar divisão extrema
        
        return pontuacao * fator
    
    
    def classificar_pregacao(self, pregacao: Dict) -> Dict:
        """
        Classifica pregação usando modelo híbrido
        
        Args:
            pregacao: Pregação enriquecida
            
        Returns:
            Pregação classificada
        """
        titulo = pregacao.get('titulo', '')
        conteudo = pregacao.get('conteudo_limpo', '')
        meta = pregacao.get('metadados_biblicos', {})
        livro_principal = meta.get('livro_principal', '')
        
        titulo_lower = titulo.lower()
        conteudo_lower = conteudo.lower()
        tamanho_doc = len(conteudo.split())
        
        # Calcula pontuações
        pontuacoes_brutas = defaultdict(float)
        
        # ========== PATH A: SCORING HEURÍSTICO (N-GRAMS) ==========
        for cat_id, ngrams in self.ngrams_teologicos.items():
            expressoes_especificas = 0
            
            # Alta especificidade
            for ngram in ngrams.get("alta", []):
                # No título
                if ngram in titulo_lower:
                    pontuacoes_brutas[cat_id] += self.pesos["titulo_ngram_alta"]
                    expressoes_especificas += 1
                
                # No conteúdo
                freq = conteudo_lower.count(ngram)
                if freq > 0:
                    pontuacoes_brutas[cat_id] += self.pesos["conteudo_ngram_alta"] * freq
                    expressoes_especificas += freq
            
            # Média especificidade
            for ngram in ngrams.get("media", []):
                if ngram in titulo_lower:
                    pontuacoes_brutas[cat_id] += self.pesos["titulo_ngram_media"]
                
                freq = conteudo_lower.count(ngram)
                pontuacoes_brutas[cat_id] += self.pesos["conteudo_ngram_media"] * freq
            
            # Bônus diversidade
            if expressoes_especificas >= 3:
                pontuacoes_brutas[cat_id] += self.pesos["bonus_diversidade"]
        
        
        # ========== PATH B: TF-IDF (TOKENS) ==========
        for cat_id, tokens in self.tokens_simples.items():
            for token in tokens:
                # Título
                if token in titulo_lower:
                    tfidf = self.calcular_tfidf_token(token, 1)
                    pontuacoes_brutas[cat_id] += self.pesos["titulo_token_tfidf"] * tfidf
                
                # Conteúdo
                freq = conteudo_lower.count(token)
                if freq > 0:
                    tfidf = self.calcular_tfidf_token(token, freq)
                    pontuacoes_brutas[cat_id] += self.pesos["conteudo_token_tfidf"] * tfidf
        
        
        # ========== PATH C: LIVRO BÍBLICO (DESEMPATE) ==========
        livros_relacionados = {
            1: ["2 timóteo", "salmos 119"],
            2: ["isaías", "salmos", "jó"],
            3: ["gênesis 3", "romanos 3", "efésios 2"],
            4: ["joão", "mateus", "marcos", "lucas", "hebreus"],
            5: ["romanos", "efésios", "joão 3", "gálatas"],
            6: ["atos", "joão 14", "romanos 8"],
            7: ["efésios 4", "1 coríntios", "atos 2"],
            8: ["apocalipse", "1 tessalonicenses", "2 pedro 3"]
        }
        
        if livro_principal:
            for cat_id, livros in livros_relacionados.items():
                for livro in livros:
                    if livro.lower() in livro_principal.lower():
                        pontuacoes_brutas[cat_id] += self.pesos["livro_biblico"]
        
        
        # ========== NORMALIZAÇÃO POR TAMANHO ==========
        pontuacoes_normalizadas = {
            cat_id: self.normalizar_por_tamanho(pont, tamanho_doc)
            for cat_id, pont in pontuacoes_brutas.items()
        }
        
        
        # ========== RANKING E SELEÇÃO ==========
        ranking = sorted(pontuacoes_normalizadas.items(), key=lambda x: x[1], reverse=True)
        
        tema_principal = ranking[0][0] if ranking and ranking[0][1] > 0 else None
        temas_secundarios = []
        
        if tema_principal and len(ranking) > 1:
            limiar = pontuacoes_normalizadas[tema_principal] * 0.30
            for cat_id, pontuacao in ranking[1:3]:
                if pontuacao >= limiar and pontuacao > 0:
                    temas_secundarios.append(cat_id)
        
        
        # ========== CALCULA PERCENTIL (CONFIANÇA RELATIVA) ==========
        if tema_principal:
            self.pontuacoes_historico[tema_principal].append(pontuacoes_normalizadas[tema_principal])
        
        
        # ========== IDENTIFICA SUBTEMAS COM DENSIDADE ==========
        subtemas_densidade = self._identificar_subtemas_densidade(titulo, conteudo, tamanho_doc)
        
        
        # ========== MONTA CLASSIFICAÇÃO ==========
        classificacao = {
            "tema_principal": {
                "id": tema_principal,
                "nome": self.taxonomia_grudem[tema_principal]["nome"] if tema_principal else None,
                "pergunta_central": self.taxonomia_grudem[tema_principal]["pergunta_central"] if tema_principal else None,
                "confianca_normalizada": round(pontuacoes_normalizadas.get(tema_principal, 0), 2),
                "subtemas_detectados": subtemas_densidade.get(tema_principal, [])
            },
            "temas_secundarios": [
                {
                    "id": cat_id,
                    "nome": self.taxonomia_grudem[cat_id]["nome"],
                    "confianca_normalizada": round(pontuacoes_normalizadas[cat_id], 2),
                    "subtemas_detectados": subtemas_densidade.get(cat_id, [])
                }
                for cat_id in temas_secundarios
            ],
            "metodo": "Híbrido (TF-IDF + Heurístico) v3.1",
            "tamanho_documento": tamanho_doc
        }
        
        pregacao_classificada = {**pregacao}
        pregacao_classificada['classificacao_tematica'] = classificacao
        
        return pregacao_classificada
    
    
    def _identificar_subtemas_densidade(self, titulo: str, conteudo: str, tamanho: int) -> Dict[int, List[Dict]]:
        """
        Identifica subtemas com DENSIDADE (não binário)
        
        MELHORIA v3.1:
        Subtemas agora têm intensidade (FORTE / MODERADA / MENCIONADA)
        
        Returns:
            {categoria_id: [{"nome": str, "intensidade": str, "freq": int}]}
        """
        subtemas_detectados = defaultdict(list)
        texto_completo = f"{titulo} {conteudo}".lower()
        
        mapa_subtemas = {
            1: {
                "autoridade": "Autoridade das Escrituras",
                "suficiência": "Suficiência da Palavra",
                "revelação": "Revelação de Deus"
            },
            2: {
                "santidade": "Santidade de Deus",
                "soberania": "Soberania de Deus",
                "trindade": "Trindade"
            },
            3: {
                "pecado": "Pecado",
                "queda": "Queda"
            },
            4: {
                "cruz": "Cruz",
                "ressurreição": "Ressurreição",
                "senhorio": "Senhorio de Cristo"
            },
            5: {
                "novo nascimento": "Novo nascimento",
                "justificação": "Justificação",
                "santificação": "Santificação"
            },
            6: {
                "regeneração": "Regeneração",
                "vida no espírito": "Vida no Espírito"
            },
            7: {
                "corpo de cristo": "Corpo de Cristo",
                "comunhão": "Comunhão"
            },
            8: {
                "esperança": "Esperança cristã",
                "eternidade": "Eternidade",
                "segunda vinda": "Segunda vinda de Cristo"
            }
        }
        
        for cat_id, palavras_subtemas in mapa_subtemas.items():
            for palavra, subtema in palavras_subtemas.items():
                freq = texto_completo.count(palavra)
                
                if freq > 0:
                    # Calcula densidade (ocorrências por 1000 palavras)
                    densidade = (freq / max(tamanho, 1)) * 1000
                    
                    # Classifica intensidade
                    if densidade >= 2.0:
                        intensidade = "FORTE"
                    elif densidade >= 0.5:
                        intensidade = "MODERADA"
                    else:
                        intensidade = "MENCIONADA"
                    
                    subtemas_detectados[cat_id].append({
                        "nome": subtema,
                        "intensidade": intensidade,
                        "frequencia": freq,
                        "densidade": round(densidade, 2)
                    })
        
        return dict(subtemas_detectados)
    
    
    def classificar_lote(self, pregacoes: List[Dict]) -> List[Dict]:
        """Classifica lote"""
        self.treinar_idf(pregacoes)
        
        print(f"\n🏷️  Classificando {len(pregacoes)} pregações (v3.1 Híbrido)...")
        
        classificadas = []
        for i, pregacao in enumerate(pregacoes, 1):
            try:
                classificada = self.classificar_pregacao(pregacao)
                classificadas.append(classificada)
                
                if i % 50 == 0:
                    print(f"   ✓ {i}/{len(pregacoes)}")
            except Exception as e:
                print(f"   ⚠️  Erro: {e}")
                classificadas.append(pregacao)
        
        print(f"✅ {len(classificadas)} classificadas")
        return classificadas
    
    
    def gerar_relatorio_tematico(self, pregacoes: List[Dict]) -> Dict:
        """Gera relatório"""
        print("\n📊 Gerando relatório...")
        
        temas_principais = Counter()
        temas_secundarios = Counter()
        temas_por_ano = defaultdict(Counter)
        subtemas_por_categoria = defaultdict(Counter)
        confianca_media = defaultdict(list)
        total_classificadas = 0
        
        for pregacao in pregacoes:
            classif = pregacao.get('classificacao_tematica')
            if not classif:
                continue
            
            total_classificadas += 1
            tema_princ = classif.get('tema_principal', {})
            
            if tema_princ.get('id'):
                nome = tema_princ['nome']
                temas_principais[nome] += 1
                confianca_media[nome].append(tema_princ.get('confianca_normalizada', 0))
                
                for subtema_dict in tema_princ.get('subtemas_detectados', []):
                    if isinstance(subtema_dict, dict):
                        subtemas_por_categoria[nome][subtema_dict['nome']] += 1
                    else:
                        subtemas_por_categoria[nome][subtema_dict] += 1
                
                ano = pregacao.get('ano')
                if ano:
                    temas_por_ano[ano][nome] += 1
            
            for tema_sec in classif.get('temas_secundarios', []):
                temas_secundarios[tema_sec['nome']] += 1
        
        conf_media = {
            tema: sum(valores) / len(valores) if valores else 0
            for tema, valores in confianca_media.items()
        }
        
        return {
            "resumo": {
                "total_pregacoes": len(pregacoes),
                "classificadas": total_classificadas,
                "metodo": "Híbrido (TF-IDF + Heurístico) v3.1"
            },
            "temas_principais": dict(temas_principais.most_common()),
            "temas_secundarios": dict(temas_secundarios.most_common()),
            "confianca_media": {tema: round(c, 2) for tema, c in conf_media.items()},
            "subtemas": {
                tema: dict(subs.most_common(5))
                for tema, subs in subtemas_por_categoria.items()
            },
            "distribuicao_anual": {
                ano: dict(temas) for ano, temas in sorted(temas_por_ano.items())
            },
            "top_5": temas_principais.most_common(5)
        }
    
    
    def imprimir_relatorio(self, relatorio: Dict):
        """Imprime relatório"""
        print("\n" + "=" * 80)
        print("🏷️  RELATÓRIO v3.1 - MODELO HÍBRIDO")
        print("=" * 80)
        
        resumo = relatorio['resumo']
        print(f"\n🔷 RESUMO:")
        print(f"   Total: {resumo['total_pregacoes']}")
        print(f"   Método: {resumo['metodo']}")
        
        print(f"\n🔷 TOP 5 TEMAS:")
        for i, (tema, qtd) in enumerate(relatorio['top_5'], 1):
            perc = (qtd / resumo['classificadas']) * 100
            conf = relatorio['confianca_media'].get(tema, 0)
            print(f"   {i}. {tema:45} - {qtd:3d}x ({perc:.1f}%) | conf: {conf:.1f}")
        
        print("\n" + "=" * 80)
    
    
    def salvar_classificadas(self, pregacoes: List[Dict], caminho: str = "../../output/pregacoes_classificadas_v31.json"):
        """Salva classificadas"""
        caminho_path = Path(caminho)
        caminho_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(caminho_path, 'w', encoding='utf-8') as f:
            json.dump({
                "descricao": "Classificação Híbrida v3.1 (TF-IDF + Heurístico)",
                "metodologia": "Sistema híbrido: TF-IDF para tokens + Scoring especialista para n-grams",
                "total": len(pregacoes),
                "pregacoes": pregacoes
            }, f, ensure_ascii=False, indent=2)
        
        tamanho_mb = caminho_path.stat().st_size / (1024 * 1024)
        print(f"💾 Salvo: {caminho_path.resolve()} ({tamanho_mb:.1f} MB)")


# ==================== TESTE ====================

if __name__ == "__main__":
    import json
    from pathlib import Path
    
    print("\n" + "=" * 80)
    print("🧪 TESTE v3.1 - MODELO HÍBRIDO RIGOROSO")
    print("=" * 80)
    
    arquivo = Path("../../output/pregacoes_enriquecidas_completo.json")
    
    if arquivo.exists():
        with open(arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        
        pregacoes = dados.get('pregacoes', [])
        print(f"\n📚 {len(pregacoes)} pregações carregadas")
        
        classifier = ThematicClassifier()
        classificadas = classifier.classificar_lote(pregacoes)
        
        # Exemplo
        print("\n" + "=" * 80)
        print("📖 EXEMPLO COM SUBTEMAS DENSIDADE:")
        exemplo = classificadas[0]
        print(f"\n📌 {exemplo['titulo']}")
        
        tema = exemplo['classificacao_tematica']['tema_principal']
        print(f"\n🎯 {tema['nome']}")
        print(f"   Confiança: {tema['confianca_normalizada']:.2f}")
        
        if tema.get('subtemas_detectados'):
            print(f"\n   📎 Subtemas (com densidade):")
            for sub in tema['subtemas_detectados']:
                if isinstance(sub, dict):
                    print(f"      • {sub['nome']:30} [{sub['intensidade']:10}] ({sub['frequencia']}x, densidade: {sub['densidade']})")
        
        # Relatório
        relatorio = classifier.gerar_relatorio_tematico(classificadas)
        classifier.imprimir_relatorio(relatorio)
        
        # Salva
        classifier.salvar_classificadas(classificadas)
        
        with open("../../output/relatorio_v31.json", 'w', encoding='utf-8') as f:
            json.dump(relatorio, f, ensure_ascii=False, indent=2)
        print("💾 Relatório v3.1 salvo")
    
    else:
        print(f"❌ {arquivo} não encontrado")
