#!/usr/bin/env python3
"""
🏷️ THEMATIC_CLASSIFIER.PY v2.0 - Classificador Temático de Pregações
Classifica pregações usando a Taxonomia de Wayne Grudem (Teologia Sistemática)
Versão enriquecida com subtemas e indicadores textuais detalhados
"""

import json
import re
from typing import Dict, List, Optional, Tuple, Set
from collections import Counter, defaultdict
from pathlib import Path


class ThematicClassifier:
    """Classificador temático baseado em Wayne Grudem - Versão Enriquecida"""
    
    def __init__(self):
        """Inicializa o classificador com taxonomia completa de Grudem"""
        
        # ========== TAXONOMIA DE GRUDEM (8 CATEGORIAS) - VERSÃO ENRIQUECIDA ==========
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
                ],
                "aliases": ["Palavra", "Escrituras", "Bíblia", "Bibliologia"]
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
                ],
                "aliases": ["Deus", "Teologia Própria", "Trindade"]
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
                ],
                "aliases": ["Antropologia", "Pecado", "Natureza Humana", "Hamartologia"]
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
                ],
                "aliases": ["Cristologia", "Jesus", "Redenção", "Cristo"]
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
                ],
                "aliases": ["Soteriologia", "Salvação", "Conversão"]
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
                ],
                "aliases": ["Pneumatologia", "Espírito Santo", "Espírito"]
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
                ],
                "aliases": ["Eclesiologia", "Igreja", "Corpo de Cristo"]
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
                ],
                "aliases": ["Escatologia", "Eternidade", "Segunda Vinda"]
            }
        }
        
        
        # ========== INDICADORES TEXTUAIS ENRIQUECIDOS ==========
        self.indicadores_textuais = {
            1: {
                # Doutrina da Palavra de Deus
                "expressoes_fortes": [
                    "a palavra de deus diz",
                    "a bíblia nos ensina",
                    "segundo as escrituras",
                    "está escrito",
                    "palavra do senhor",
                    "assim diz o senhor",
                    "autoridade das escrituras",
                    "suficiência da palavra",
                    "revelação de deus",
                    "inerrância bíblica"
                ],
                "expressoes_medias": [
                    "palavra de deus",
                    "escritura",
                    "bíblia",
                    "revelação",
                    "texto bíblico",
                    "passagem",
                    "versículo",
                    "palavra"
                ],
                "verbos_chave": [
                    "pregar",
                    "ensinar",
                    "explicar o texto",
                    "aplicar a palavra",
                    "expor as escrituras"
                ]
            },
            2: {
                # Doutrina de Deus
                "expressoes_fortes": [
                    "deus é santo",
                    "deus é soberano",
                    "santidade de deus",
                    "glória de deus",
                    "majestade de deus",
                    "caráter de deus",
                    "atributos de deus",
                    "trindade",
                    "pai filho espírito santo",
                    "nada foge do controle de deus"
                ],
                "expressoes_medias": [
                    "deus",
                    "senhor",
                    "criador",
                    "todo-poderoso",
                    "altíssimo",
                    "eterno",
                    "pai celestial",
                    "soberano"
                ],
                "verbos_chave": [
                    "adorar a deus",
                    "glorificar",
                    "exaltar",
                    "temer ao senhor",
                    "contemplar a glória"
                ]
            },
            3: {
                # Doutrina do Homem
                "expressoes_fortes": [
                    "o coração do homem",
                    "somos pecadores",
                    "nossa inclinação ao pecado",
                    "natureza pecaminosa",
                    "todos pecaram",
                    "depravação total",
                    "queda do homem",
                    "adão",
                    "condição caída",
                    "iniquidade"
                ],
                "expressoes_medias": [
                    "pecado",
                    "pecados",
                    "pecador",
                    "carne",
                    "concupiscência",
                    "transgressão",
                    "culpa",
                    "vergonha"
                ],
                "verbos_chave": [
                    "pecar",
                    "transgredir",
                    "rebelar",
                    "desobedecer",
                    "afastar de deus"
                ]
            },
            4: {
                # Doutrina de Cristo
                "expressoes_fortes": [
                    "cristo morreu por nós",
                    "jesus é o senhor",
                    "somente em cristo",
                    "cruz de cristo",
                    "ressurreição de jesus",
                    "sangue de cristo",
                    "cordeiro de deus",
                    "sacrifício perfeito",
                    "obra de cristo",
                    "mediador"
                ],
                "expressoes_medias": [
                    "jesus",
                    "cristo",
                    "salvador",
                    "messias",
                    "filho de deus",
                    "senhor jesus",
                    "mestre",
                    "cruz"
                ],
                "verbos_chave": [
                    "morreu por",
                    "ressuscitou",
                    "redimiu",
                    "salvou",
                    "intercede"
                ]
            },
            5: {
                # Doutrina da Salvação (ENRIQUECIDA!)
                "expressoes_fortes": [
                    "nascer de novo",
                    "somos salvos pela graça",
                    "arrependimento e fé",
                    "novo nascimento",
                    "justificação pela fé",
                    "santificação progressiva",
                    "regeneração",
                    "conversão",
                    "chamados à salvação",
                    "perdão de pecados",
                    "remissão",
                    "vida nova em cristo",
                    "graça salvadora",
                    "fé salvadora"
                ],
                "expressoes_medias": [
                    "salvação",
                    "salvo",
                    "graça",
                    "fé",
                    "arrependimento",
                    "conversão",
                    "perdão",
                    "reconciliação",
                    "redenção"
                ],
                "verbos_chave": [
                    "salvar",
                    "arrepender",
                    "crer",
                    "confessar",
                    "receber cristo",
                    "nascer de novo",
                    "converter"
                ]
            },
            6: {
                # Doutrina do Espírito Santo
                "expressoes_fortes": [
                    "o espírito santo nos convence",
                    "deus habita em nós",
                    "somos guiados pelo espírito",
                    "batismo no espírito",
                    "cheios do espírito",
                    "consolador",
                    "parácleto",
                    "poder do espírito",
                    "fruto do espírito",
                    "dons espirituais"
                ],
                "expressoes_medias": [
                    "espírito santo",
                    "espírito",
                    "unção",
                    "consolador",
                    "capacitação",
                    "regeneração"
                ],
                "verbos_chave": [
                    "guiar",
                    "consolar",
                    "capacitar",
                    "convencer",
                    "regenerar"
                ]
            },
            7: {
                # Doutrina da Igreja
                "expressoes_fortes": [
                    "como igreja",
                    "corpo de cristo",
                    "relacionamentos restaurados",
                    "comunhão dos santos",
                    "edificar a igreja",
                    "unidade do corpo",
                    "missão da igreja",
                    "família de deus",
                    "povo de deus"
                ],
                "expressoes_medias": [
                    "igreja",
                    "irmãos",
                    "comunhão",
                    "comunidade",
                    "corpo",
                    "família",
                    "assembleia"
                ],
                "verbos_chave": [
                    "edificar",
                    "comungar",
                    "perdoar",
                    "amar uns aos outros",
                    "servir"
                ]
            },
            8: {
                # Doutrina das Últimas Coisas
                "expressoes_fortes": [
                    "vida eterna",
                    "aguardamos a volta de cristo",
                    "nossa pátria está nos céus",
                    "segunda vinda",
                    "juízo final",
                    "ressurreição dos mortos",
                    "novos céus e nova terra",
                    "maranata",
                    "esperança gloriosa"
                ],
                "expressoes_medias": [
                    "eternidade",
                    "céu",
                    "inferno",
                    "esperança",
                    "glorificação",
                    "volta de jesus"
                ],
                "verbos_chave": [
                    "aguardar",
                    "esperar",
                    "voltar",
                    "julgar",
                    "ressuscitar"
                ]
            }
        }
        
        
        # ========== PESOS AJUSTADOS (BALANCEADOS) ==========
        self.pesos = {
            "titulo": 4.0,                    # Peso MUITO alto para título
            "expressao_forte": 3.0,           # Frases-chave específicas
            "expressao_media": 1.5,           # Palavras importantes
            "verbo_chave": 2.0,               # Verbos de ação teológica
            "livro_biblico": 1.0,             # Livro relacionado
            "bonus_multiplas_expressoes": 2.0 # Bônus se várias expressões aparecem
        }
        
        
        # ========== LIVROS BÍBLICOS POR CATEGORIA (EXPANDIDO) ==========
        self.livros_relacionados = {
            1: ["2 timóteo", "salmos 119", "deuteronômio", "josué 1"],
            2: ["isaías", "salmos", "jó", "êxodo 34", "apocalipse 4"],
            3: ["gênesis 3", "romanos 3", "efésios 2", "jeremias 17", "romanos 1-2"],
            4: ["joão", "mateus", "marcos", "lucas", "filipenses 2", "colossenses 1", "hebreus"],
            5: ["romanos", "efésios", "joão 3", "tito", "gálatas", "1 pedro 1"],
            6: ["atos", "joão 14", "joão 15", "joão 16", "romanos 8", "1 coríntios 12", "gálatas 5"],
            7: ["efésios 4", "1 coríntios", "atos 2", "1 pedro 2", "romanos 12"],
            8: ["apocalipse", "1 tessalonicenses", "2 pedro 3", "mateus 24", "1 coríntios 15"]
        }
    
    
    def classificar_pregacao(self, pregacao: Dict) -> Dict:
        """
        Classifica uma pregação em 1 tema principal + até 2 secundários
        
        Args:
            pregacao: Pregação enriquecida com metadados bíblicos
            
        Returns:
            Pregação com classificação temática detalhada
        """
        titulo = pregacao.get('titulo', '')
        conteudo = pregacao.get('conteudo_limpo', '')
        meta = pregacao.get('metadados_biblicos', {})
        livro_principal = meta.get('livro_principal', '')
        
        # Calcula pontuações para cada categoria
        pontuacoes = self._calcular_pontuacoes_enriquecidas(titulo, conteudo, livro_principal)
        
        # Identifica subtemas detectados
        subtemas_detectados = self._identificar_subtemas(titulo, conteudo)
        
        # Ordena categorias por pontuação
        ranking = sorted(pontuacoes.items(), key=lambda x: x[1], reverse=True)
        
        # Determina tema principal e secundários
        tema_principal = ranking[0][0] if ranking and ranking[0][1] > 0 else None
        temas_secundarios = []
        
        # Adiciona secundários se pontuação >= 25% do principal (mais flexível)
        if tema_principal and len(ranking) > 1:
            limiar = pontuacoes[tema_principal] * 0.25
            for cat_id, pontuacao in ranking[1:3]:  # Máximo 2 secundários
                if pontuacao >= limiar and pontuacao > 0:
                    temas_secundarios.append(cat_id)
        
        # Monta classificação enriquecida
        classificacao = {
            "tema_principal": {
                "id": tema_principal,
                "nome": self.taxonomia_grudem[tema_principal]["nome"] if tema_principal else None,
                "pergunta_central": self.taxonomia_grudem[tema_principal]["pergunta_central"] if tema_principal else None,
                "confianca": round(pontuacoes.get(tema_principal, 0), 2),
                "subtemas_detectados": subtemas_detectados.get(tema_principal, [])
            },
            "temas_secundarios": [
                {
                    "id": cat_id,
                    "nome": self.taxonomia_grudem[cat_id]["nome"],
                    "confianca": round(pontuacoes[cat_id], 2),
                    "subtemas_detectados": subtemas_detectados.get(cat_id, [])
                }
                for cat_id in temas_secundarios
            ],
            "pontuacoes_completas": {
                self.taxonomia_grudem[cat_id]["nome"]: round(pont, 2)
                for cat_id, pont in ranking if pont > 0
            },
            "metodo_classificacao": "Taxonomia de Wayne Grudem v2.0"
        }
        
        # Retorna pregação enriquecida
        pregacao_classificada = {**pregacao}
        pregacao_classificada['classificacao_tematica'] = classificacao
        
        return pregacao_classificada
    
    
    def _calcular_pontuacoes_enriquecidas(self, titulo: str, conteudo: str, livro: str) -> Dict[int, float]:
        """
        Calcula pontuação enriquecida com novos indicadores
        
        Args:
            titulo: Título da pregação
            conteudo: Conteúdo completo
            livro: Livro bíblico principal
            
        Returns:
            Dicionário {categoria_id: pontuação}
        """
        pontuacoes = defaultdict(float)
        
        titulo_lower = titulo.lower()
        conteudo_lower = conteudo.lower()
        texto_completo = f"{titulo_lower} {conteudo_lower}"
        
        for cat_id, indicadores in self.indicadores_textuais.items():
            expressoes_encontradas = 0
            
            # Expressões fortes
            for expr in indicadores["expressoes_fortes"]:
                # No título (peso MUITO maior)
                if expr in titulo_lower:
                    pontuacoes[cat_id] += self.pesos["titulo"] * self.pesos["expressao_forte"]
                    expressoes_encontradas += 1
                
                # No conteúdo
                count = conteudo_lower.count(expr)
                if count > 0:
                    pontuacoes[cat_id] += count * self.pesos["expressao_forte"]
                    expressoes_encontradas += count
            
            # Expressões médias
            for expr in indicadores["expressoes_medias"]:
                if expr in titulo_lower:
                    pontuacoes[cat_id] += self.pesos["titulo"] * self.pesos["expressao_media"]
                
                count = conteudo_lower.count(expr)
                pontuacoes[cat_id] += count * self.pesos["expressao_media"]
            
            # Verbos-chave (novo!)
            for verbo in indicadores["verbos_chave"]:
                if verbo in texto_completo:
                    pontuacoes[cat_id] += self.pesos["verbo_chave"]
            
            # Bônus se múltiplas expressões aparecem (indica tema central)
            if expressoes_encontradas >= 3:
                pontuacoes[cat_id] += self.pesos["bonus_multiplas_expressoes"]
            
            # Livro bíblico relacionado
            if livro:
                for livro_rel in self.livros_relacionados.get(cat_id, []):
                    if livro_rel.lower() in livro.lower():
                        pontuacoes[cat_id] += self.pesos["livro_biblico"]
        
        return dict(pontuacoes)
    
    
    def _identificar_subtemas(self, titulo: str, conteudo: str) -> Dict[int, List[str]]:
        """
        Identifica subtemas específicos mencionados na pregação
        
        Args:
            titulo: Título da pregação
            conteudo: Conteúdo
            
        Returns:
            Dicionário {categoria_id: [subtemas_detectados]}
        """
        subtemas_detectados = defaultdict(list)
        texto_completo = f"{titulo} {conteudo}".lower()
        
        # Mapeamento de palavras-chave para subtemas
        mapa_subtemas = {
            1: {
                "autoridade": "Autoridade das Escrituras",
                "suficiência": "Suficiência da Palavra",
                "revelação": "Revelação de Deus",
                "expositiva": "Pregação expositiva",
                "aplicação": "Aplicação da Palavra"
            },
            2: {
                "santidade": "Santidade de Deus",
                "soberania": "Soberania de Deus",
                "trindade": "Trindade",
                "criador": "Deus como Criador e Sustentador",
                "caráter": "Caráter de Deus"
            },
            3: {
                "pecado": "Pecado",
                "queda": "Queda",
                "consciência": "Consciência",
                "idolatria": "Idolatria do coração",
                "necessidade de salvação": "Necessidade de salvação"
            },
            4: {
                "encarnação": "Encarnação",
                "cruz": "Cruz",
                "ressurreição": "Ressurreição",
                "senhorio": "Senhorio de Cristo",
                "mediação": "Mediação"
            },
            5: {
                "novo nascimento": "Novo nascimento",
                "nascer de novo": "Novo nascimento",
                "justificação": "Justificação",
                "graça": "Graça",
                "fé": "Fé",
                "santificação": "Santificação",
                "perseverança": "Perseverança dos santos"
            },
            6: {
                "regeneração": "Regeneração",
                "convicção": "Convicção do pecado",
                "vida no espírito": "Vida no Espírito",
                "consolação": "Consolação"
            },
            7: {
                "corpo de cristo": "Corpo de Cristo",
                "comunhão": "Comunhão",
                "disciplina": "Disciplina",
                "perdão": "Perdão",
                "missão": "Missão",
                "comunitária": "Vida comunitária"
            },
            8: {
                "esperança": "Esperança cristã",
                "juízo": "Juízo final",
                "eternidade": "Eternidade",
                "segunda vinda": "Segunda vinda de Cristo",
                "nova criação": "Nova criação"
            }
        }
        
        for cat_id, palavras_subtemas in mapa_subtemas.items():
            for palavra, subtema in palavras_subtemas.items():
                if palavra in texto_completo:
                    if subtema not in subtemas_detectados[cat_id]:
                        subtemas_detectados[cat_id].append(subtema)
        
        return dict(subtemas_detectados)
    
    
    def classificar_lote(self, pregacoes: List[Dict]) -> List[Dict]:
        """
        Classifica um lote de pregações
        
        Args:
            pregacoes: Lista de pregações enriquecidas
            
        Returns:
            Lista de pregações classificadas
        """
        print(f"\n🏷️  Classificando {len(pregacoes)} pregações (v2.0 enriquecida)...")
        
        classificadas = []
        
        for i, pregacao in enumerate(pregacoes, 1):
            try:
                classificada = self.classificar_pregacao(pregacao)
                classificadas.append(classificada)
                
                if i % 50 == 0:
                    print(f"   ✓ {i}/{len(pregacoes)}")
            
            except Exception as e:
                print(f"   ⚠️  Erro na pregação {i}: {e}")
                classificadas.append(pregacao)  # Mantém original
        
        print(f"✅ {len(classificadas)} pregações classificadas")
        
        return classificadas
    
    
    def gerar_relatorio_tematico(self, pregacoes: List[Dict]) -> Dict:
        """
        Gera relatório de distribuição temática enriquecido
        
        Args:
            pregacoes: Pregações classificadas
            
        Returns:
            Relatório estatístico detalhado
        """
        print("\n📊 Gerando relatório temático enriquecido...")
        
        # Contadores
        temas_principais = Counter()
        temas_secundarios = Counter()
        temas_por_ano = defaultdict(lambda: Counter())
        subtemas_por_categoria = defaultdict(Counter)
        total_classificadas = 0
        confianca_media_por_tema = defaultdict(list)
        
        for pregacao in pregacoes:
            classif = pregacao.get('classificacao_tematica')
            
            if not classif:
                continue
            
            total_classificadas += 1
            
            # Tema principal
            tema_princ = classif.get('tema_principal', {})
            if tema_princ.get('id'):
                nome = tema_princ['nome']
                temas_principais[nome] += 1
                confianca_media_por_tema[nome].append(tema_princ.get('confianca', 0))
                
                # Subtemas detectados
                for subtema in tema_princ.get('subtemas_detectados', []):
                    subtemas_por_categoria[nome][subtema] += 1
                
                # Por ano
                ano = pregacao.get('ano')
                if ano:
                    temas_por_ano[ano][nome] += 1
            
            # Temas secundários
            for tema_sec in classif.get('temas_secundarios', []):
                temas_secundarios[tema_sec['nome']] += 1
                
                # Subtemas secundários
                for subtema in tema_sec.get('subtemas_detectados', []):
                    subtemas_por_categoria[tema_sec['nome']][subtema] += 1
        
        # Calcula média de confiança
        confianca_media = {
            tema: sum(valores) / len(valores) if valores else 0
            for tema, valores in confianca_media_por_tema.items()
        }
        
        # Monta relatório enriquecido
        relatorio = {
            "resumo": {
                "total_pregacoes": len(pregacoes),
                "classificadas": total_classificadas,
                "nao_classificadas": len(pregacoes) - total_classificadas,
                "percentual_cobertura": (total_classificadas / len(pregacoes)) * 100 if pregacoes else 0
            },
            "temas_principais": dict(temas_principais.most_common()),
            "temas_secundarios": dict(temas_secundarios.most_common()),
            "confianca_media_por_tema": {tema: round(conf, 2) for tema, conf in confianca_media.items()},
            "subtemas_detectados": {
                tema: dict(subtemas.most_common(5))
                for tema, subtemas in subtemas_por_categoria.items()
            },
            "distribuicao_anual": {
                ano: dict(temas) for ano, temas in sorted(temas_por_ano.items())
            },
            "top_5_temas": temas_principais.most_common(5)
        }
        
        print("✅ Relatório enriquecido gerado")
        
        return relatorio
    
    
    def imprimir_relatorio_tematico(self, relatorio: Dict):
        """Imprime relatório formatado enriquecido"""
        
        print("\n" + "=" * 80)
        print("🏷️  RELATÓRIO DE CLASSIFICAÇÃO TEMÁTICA v2.0 - TAXONOMIA DE GRUDEM")
        print("=" * 80)
        
        resumo = relatorio['resumo']
        
        print(f"\n🔷 RESUMO:")
        print(f"   Total de pregações: {resumo['total_pregacoes']}")
        print(f"   Classificadas: {resumo['classificadas']} ({resumo['percentual_cobertura']:.1f}%)")
        print(f"   Não classificadas: {resumo['nao_classificadas']}")
        
        print(f"\n🔷 TOP 5 TEMAS PRINCIPAIS PREGADOS (COM CONFIANÇA MÉDIA):")
        for i, (tema, qtd) in enumerate(relatorio['top_5_temas'], 1):
            percentual = (qtd / resumo['classificadas']) * 100 if resumo['classificadas'] else 0
            confianca = relatorio['confianca_media_por_tema'].get(tema, 0)
            print(f"   {i}. {tema:45} - {qtd:3d}x ({percentual:.1f}%) | conf: {confianca:.1f}")
        
        print(f"\n🔷 TODOS OS TEMAS (COMO PRINCIPAL):")
        for tema, qtd in sorted(relatorio['temas_principais'].items(), 
                                key=lambda x: x[1], reverse=True):
            print(f"   • {tema:45} - {qtd:3d}x")
        
        print(f"\n🔷 SUBTEMAS MAIS DETECTADOS POR CATEGORIA:")
        for tema, subtemas in list(relatorio['subtemas_detectados'].items())[:5]:
            print(f"\n   📖 {tema}:")
            for subtema, qtd in list(subtemas.items())[:3]:
                print(f"      • {subtema:35} - {qtd}x")
        
        print(f"\n🔷 TEMAS SECUNDÁRIOS MAIS COMUNS:")
        for tema, qtd in list(relatorio['temas_secundarios'].items())[:5]:
            print(f"   • {tema:45} - {qtd:3d}x")
        
        print(f"\n🔷 DISTRIBUIÇÃO POR ANO (TOP 3 DE CADA ANO):")
        for ano, temas in relatorio['distribuicao_anual'].items():
            print(f"\n   📅 {ano}:")
            top3 = sorted(temas.items(), key=lambda x: x[1], reverse=True)[:3]
            for tema, qtd in top3:
                print(f"      {tema:40} - {qtd}x")
        
        print("\n" + "=" * 80)
    
    
    def salvar_classificadas(self, pregacoes: List[Dict], caminho: str = "../../output/pregacoes_classificadas_completo.json"):
        """Salva pregações classificadas"""
        caminho_path = Path(caminho)
        caminho_path.parent.mkdir(parents=True, exist_ok=True)
        
        dados = {
            "descricao": "Pregações com classificação temática v2.0 - Taxonomia de Grudem (Enriquecida)",
            "versao_classificador": "2.0",
            "total": len(pregacoes),
            "taxonomia": {
                cat_id: {
                    "nome": info["nome"],
                    "pergunta_central": info["pergunta_central"],
                    "subtemas": info["subtemas"]
                }
                for cat_id, info in self.taxonomia_grudem.items()
            },
            "pregacoes": pregacoes
        }
        
        with open(caminho_path, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        
        tamanho_mb = caminho_path.stat().st_size / (1024 * 1024)
        print(f"💾 Salvo em: {caminho_path.resolve()} ({tamanho_mb:.1f} MB)")


# ==================== TESTE ====================


if __name__ == "__main__":
    import json
    from pathlib import Path
    
    print("\n" + "=" * 80)
    print("🧪 TESTE DO CLASSIFICADOR TEMÁTICO v2.0 (ENRIQUECIDO)")
    print("=" * 80)
    
    # Carrega pregações enriquecidas
    arquivo = Path("../../output/pregacoes_enriquecidas_completo.json")
    
    if arquivo.exists():
        with open(arquivo, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        
        pregacoes = dados.get('pregacoes', [])
        
        print(f"\n📚 Carregadas {len(pregacoes)} pregações")
        
        # Classifica
        classifier = ThematicClassifier()
        classificadas = classifier.classificar_lote(pregacoes)
        
        # Mostra exemplo detalhado
        print("\n" + "=" * 80)
        print("📖 EXEMPLO DETALHADO DE CLASSIFICAÇÃO:")
        print("=" * 80)
        exemplo = classificadas[0]
        print(f"\n📌 Título: {exemplo['titulo']}")
        print(f"📅 Data: {exemplo.get('data_pregacao')}")
        print(f"👤 Pregador: {exemplo.get('pregador')}")
        
        classif = exemplo.get('classificacao_tematica', {})
        tema_princ = classif.get('tema_principal', {})
        
        print(f"\n🎯 Tema Principal:")
        print(f"   {tema_princ.get('nome')}")
        print(f"   ❓ Pergunta central: {tema_princ.get('pergunta_central')}")
        print(f"   📊 Confiança: {tema_princ.get('confianca', 0):.1f}")
        
        if tema_princ.get('subtemas_detectados'):
            print(f"   📎 Subtemas detectados:")
            for subtema in tema_princ['subtemas_detectados']:
                print(f"      • {subtema}")
        
        if classif.get('temas_secundarios'):
            print(f"\n📎 Temas Secundários:")
            for tema in classif['temas_secundarios']:
                print(f"   • {tema['nome']} (confiança: {tema['confianca']:.1f})")
                if tema.get('subtemas_detectados'):
                    for subtema in tema['subtemas_detectados']:
                        print(f"      - {subtema}")
        
        # Gera relatório
        relatorio = classifier.gerar_relatorio_tematico(classificadas)
        classifier.imprimir_relatorio_tematico(relatorio)
        
        # Salva
        classifier.salvar_classificadas(classificadas)
        
        # Salva relatório também
        caminho_relatorio = Path("../../output/relatorio_tematico_v2.json")
        with open(caminho_relatorio, 'w', encoding='utf-8') as f:
            json.dump(relatorio, f, ensure_ascii=False, indent=2)
        print(f"💾 Relatório salvo em: {caminho_relatorio.resolve()}")
    
    else:
        print(f"❌ Arquivo não encontrado: {arquivo}")
        print("   Execute primeiro o pipeline.py com opção 4!")
