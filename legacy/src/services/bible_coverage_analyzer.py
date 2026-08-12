#!/usr/bin/env python3
"""
📊 BIBLE_COVERAGE_ANALYZER.PY - Analisador de Cobertura Bíblica
Cruza pregações com estrutura completa da Bíblia usando:
- livro_biblico (dashboard)
- metadados_biblicos.livro_principal
- metadados_biblicos.texto_base (qualquer citação conta como pregado)
"""

import json
import os
import re
from typing import Dict, List, Optional, Set
from collections import Counter, defaultdict
from pathlib import Path

import requests
import urllib3

# Desabilita warnings de SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# ========================= ALIASES DE LIVROS ========================= #

BOOK_ALIASES: Dict[str, str] = {
    # ANTIGO TESTAMENTO
    "genesis": "genesis", "gênesis": "genesis", "gn": "genesis",
    "exodo": "exodo", "êxodo": "exodo", "ex": "exodo",
    "levitico": "levitico", "levítico": "levitico", "lv": "levitico",
    "numeros": "numeros", "números": "numeros", "nm": "numeros",
    "deuteronomio": "deuteronomio", "deuteronômio": "deuteronomio", "dt": "deuteronomio",
    "josue": "josue", "josué": "josue", "js": "josue",
    "juizes": "juizes", "juízes": "juizes", "jz": "juizes",
    "rute": "rute", "rt": "rute",

    "1 samuel": "samuel1", "i samuel": "samuel1",
    "1sm": "samuel1", "1 sm": "samuel1", "i sm": "samuel1", "ism": "samuel1",
    "2 samuel": "samuel2", "ii samuel": "samuel2",
    "2sm": "samuel2", "2 sm": "samuel2", "ii sm": "samuel2", "iism": "samuel2",

    "1 reis": "reis1", "i reis": "reis1",
    "1rs": "reis1", "1 rs": "reis1", "i rs": "reis1", "irs": "reis1",
    "2 reis": "reis2", "ii reis": "reis2",
    "2rs": "reis2", "2 rs": "reis2", "ii rs": "reis2", "iirs": "reis2",

    "1 cronicas": "cronicas1", "1 crônicas": "cronicas1",
    "i cronicas": "cronicas1", "i crônicas": "cronicas1",
    "1cr": "cronicas1", "1 cr": "cronicas1", "icr": "cronicas1",
    "2 cronicas": "cronicas2", "2 crônicas": "cronicas2",
    "ii cronicas": "cronicas2", "ii crônicas": "cronicas2",
    "2cr": "cronicas2", "2 cr": "cronicas2", "iicr": "cronicas2",

    "esdras": "esdras", "ed": "esdras",
    "neemias": "neemias", "ne": "neemias",
    "ester": "ester", "est": "ester",
    "jo": "jo", "jó": "jo",
    "salmos": "salmos", "sl": "salmos", "slm": "salmos", "salmo": "salmos",
    "proverbios": "proverbios", "provérbios": "proverbios", "pv": "proverbios",
    "eclesiastes": "eclesiastes", "ec": "eclesiastes",
    "cantares": "cantares", "cântico dos cânticos": "cantares", "ct": "cantares",
    "isaias": "isaias", "isaías": "isaias", "is": "isaias",
    "jeremias": "jeremias", "jr": "jeremias",
    "lamentacoes": "lamentacoes", "lamentações": "lamentacoes", "lm": "lamentacoes",
    "ezequiel": "ezequiel", "ez": "ezequiel",
    "daniel": "daniel", "dn": "daniel",
    "oseias": "oseias", "oséias": "oseias", "os": "oseias",
    "joel": "joel", "jl": "joel",
    "amos": "amos", "amós": "amos", "am": "amos",
    "obadias": "obadias", "ob": "obadias",
    "jonas": "jonas", "jn": "jonas",
    "miqueias": "miqueias", "mq": "miqueias",
    "naum": "naum", "na": "naum",
    "habacuque": "habacuque", "hc": "habacuque",
    "sofonias": "sofonias", "sf": "sofonias",
    "ageu": "ageu", "ag": "ageu",
    "zacarias": "zacarias", "zc": "zacarias",
    "malaquias": "malaquias", "ml": "malaquias",

    # NOVO TESTAMENTO
    "mateus": "mateus", "mt": "mateus",
    "marcos": "marcos", "mc": "marcos",
    "lucas": "lucas", "lc": "lucas",
    "joao": "joao", "joão": "joao", "jo": "joao",
    "atos": "atos", "at": "atos",
    "romanos": "romanos", "rm": "romanos",

    # 1 e 2 Coríntios (inclui formas romanas)
    "1 corintios": "corintios1", "1 coríntios": "corintios1",
    "1corintios": "corintios1", "1coríntios": "corintios1",
    "1 co": "corintios1", "1co": "corintios1",
    "i corintios": "corintios1", "i coríntios": "corintios1",
    "i co": "corintios1", "ico": "corintios1",

    "2 corintios": "corintios2", "2 coríntios": "corintios2",
    "2corintios": "corintios2", "2coríntios": "corintios2",
    "2 co": "corintios2", "2co": "corintios2",
    "ii corintios": "corintios2", "ii coríntios": "corintios2",
    "ii co": "corintios2", "iico": "corintios2",

    "galatas": "galatas", "gálatas": "galatas", "gl": "galatas",
    "efesios": "efesios", "efésios": "efesios", "ef": "efesios",
    "filipenses": "filipenses", "fl": "filipenses", "fp": "filipenses",
    "colossenses": "colossenses", "cl": "colossenses",

    "1 tessalonicenses": "tessalonicenses1", "1ts": "tessalonicenses1",
    "1 ts": "tessalonicenses1",
    "i tessalonicenses": "tessalonicenses1", "i ts": "tessalonicenses1", "its": "tessalonicenses1",

    "2 tessalonicenses": "tessalonicenses2", "2ts": "tessalonicenses2",
    "2 ts": "tessalonicenses2",
    "ii tessalonicenses": "tessalonicenses2", "ii ts": "tessalonicenses2", "iits": "tessalonicenses2",

    "1 timoteo": "timoteo1", "1 timóteo": "timoteo1",
    "1tm": "timoteo1", "1 tm": "timoteo1",
    "i timoteo": "timoteo1", "i timóteo": "timoteo1",
    "i tm": "timoteo1", "itm": "timoteo1",

    "2 timoteo": "timoteo2", "2 timóteo": "timoteo2",
    "2tm": "timoteo2", "2 tm": "timoteo2",
    "ii timoteo": "timoteo2", "ii timóteo": "timoteo2",
    "ii tm": "timoteo2", "iitm": "timoteo2",

    "tito": "tito", "tt": "tito",
    "filemom": "filemom", "flm": "filemom",
    "hebreus": "hebreus", "hb": "hebreus",
    "tiago": "tiago", "tg": "tiago",

    "1 pedro": "pedro1", "1pe": "pedro1", "1 pe": "pedro1",
    "i pedro": "pedro1", "i pe": "pedro1", "ipe": "pedro1",

    "2 pedro": "pedro2", "2pe": "pedro2", "2 pe": "pedro2",
    "ii pedro": "pedro2", "ii pe": "pedro2", "iipe": "pedro2",

    "1 joao": "joao1", "1 joão": "joao1",
    "1joao": "joao1", "1joão": "joao1",
    "1 jo": "joao1", "1jo": "joao1",
    "i joao": "joao1", "i joão": "joao1",
    "i jo": "joao1", "ijo": "joao1",

    "2 joao": "joao2", "2 joão": "joao2",
    "2joao": "joao2", "2joão": "joao2",
    "2 jo": "joao2", "2jo": "joao2",
    "ii joao": "joao2", "ii joão": "joao2",
    "ii jo": "joao2", "iijo": "joao2",

    "3 joao": "joao3", "3 joão": "joao3",
    "3joao": "joao3", "3joão": "joao3",
    "3 jo": "joao3", "3jo": "joao3",
    "iii joao": "joao3", "iii joão": "joao3",
    "iii jo": "joao3", "iiijo": "joao3",

    "judas": "judas", "jd": "judas",
    "apocalipse": "apocalipse", "ap": "apocalipse", "apc": "apocalipse",
}


def _normalize_book_name(name: str) -> str:
    """Normaliza o nome/abreviação de livro para comparação."""
    name = name.lower().strip()
    for ch in [".", ",", ";", ":", "º", "ª", "(", ")", "[", "]"]:
        name = name.replace(ch, "")
    name = " ".join(name.split())
    return name


class BiblicalCoverageAnalyzer:
    """Analisador de cobertura bíblica completa."""

    def __init__(self):
        self.api_base = "https://www.abibliadigital.com.br/api"
        self.proxies = self._configurar_proxy()
        self.estrutura_biblica = self._carregar_estrutura_local()

        print("📖 Carregando estrutura da Bíblia...")
        estrutura_api = self._carregar_estrutura_api()
        if estrutura_api:
            print("   ✅ Dados carregados da API")
            self.estrutura_biblica = estrutura_api
        else:
            print("   ⚠️  API indisponível. Usando dados locais.")

    # -------------------- Infraestrutura -------------------- #

    def _configurar_proxy(self) -> Dict:
        proxies: Dict[str, str] = {}
        http_proxy = os.getenv("HTTP_PROXY")
        https_proxy = os.getenv("HTTPS_PROXY")

        if http_proxy:
            proxies["http"] = http_proxy
            print("   🔒 Proxy HTTP configurado")
        if https_proxy:
            proxies["https"] = https_proxy
            print("   🔒 Proxy HTTPS configurado")

        return proxies

    def _carregar_estrutura_local(self) -> Dict:
        """Estrutura completa da Bíblia (fallback local)."""
        return {
            # VT
            "genesis": {"nome": "Gênesis", "testamento": "VT", "capitulos": 50},
            "exodo": {"nome": "Êxodo", "testamento": "VT", "capitulos": 40},
            "levitico": {"nome": "Levítico", "testamento": "VT", "capitulos": 27},
            "numeros": {"nome": "Números", "testamento": "VT", "capitulos": 36},
            "deuteronomio": {"nome": "Deuteronômio", "testamento": "VT", "capitulos": 34},
            "josue": {"nome": "Josué", "testamento": "VT", "capitulos": 24},
            "juizes": {"nome": "Juízes", "testamento": "VT", "capitulos": 21},
            "rute": {"nome": "Rute", "testamento": "VT", "capitulos": 4},
            "samuel1": {"nome": "1 Samuel", "testamento": "VT", "capitulos": 31},
            "samuel2": {"nome": "2 Samuel", "testamento": "VT", "capitulos": 24},
            "reis1": {"nome": "1 Reis", "testamento": "VT", "capitulos": 22},
            "reis2": {"nome": "2 Reis", "testamento": "VT", "capitulos": 25},
            "cronicas1": {"nome": "1 Crônicas", "testamento": "VT", "capitulos": 29},
            "cronicas2": {"nome": "2 Crônicas", "testamento": "VT", "capitulos": 36},
            "esdras": {"nome": "Esdras", "testamento": "VT", "capitulos": 10},
            "neemias": {"nome": "Neemias", "testamento": "VT", "capitulos": 13},
            "ester": {"nome": "Ester", "testamento": "VT", "capitulos": 10},
            "jo": {"nome": "Jó", "testamento": "VT", "capitulos": 42},
            "salmos": {"nome": "Salmos", "testamento": "VT", "capitulos": 150},
            "proverbios": {"nome": "Provérbios", "testamento": "VT", "capitulos": 31},
            "eclesiastes": {"nome": "Eclesiastes", "testamento": "VT", "capitulos": 12},
            "cantares": {"nome": "Cântico dos Cânticos", "testamento": "VT", "capitulos": 8},
            "isaias": {"nome": "Isaías", "testamento": "VT", "capitulos": 66},
            "jeremias": {"nome": "Jeremias", "testamento": "VT", "capitulos": 52},
            "lamentacoes": {"nome": "Lamentações", "testamento": "VT", "capitulos": 5},
            "ezequiel": {"nome": "Ezequiel", "testamento": "VT", "capitulos": 48},
            "daniel": {"nome": "Daniel", "testamento": "VT", "capitulos": 12},
            "oseias": {"nome": "Oséias", "testamento": "VT", "capitulos": 14},
            "joel": {"nome": "Joel", "testamento": "VT", "capitulos": 3},
            "amos": {"nome": "Amós", "testamento": "VT", "capitulos": 9},
            "obadias": {"nome": "Obadias", "testamento": "VT", "capitulos": 1},
            "jonas": {"nome": "Jonas", "testamento": "VT", "capitulos": 4},
            "miqueias": {"nome": "Miquéias", "testamento": "VT", "capitulos": 7},
            "naum": {"nome": "Naum", "testamento": "VT", "capitulos": 3},
            "habacuque": {"nome": "Habacuque", "testamento": "VT", "capitulos": 3},
            "sofonias": {"nome": "Sofonias", "testamento": "VT", "capitulos": 3},
            "ageu": {"nome": "Ageu", "testamento": "VT", "capitulos": 2},
            "zacarias": {"nome": "Zacarias", "testamento": "VT", "capitulos": 14},
            "malaquias": {"nome": "Malaquias", "testamento": "VT", "capitulos": 4},
            # NT
            "mateus": {"nome": "Mateus", "testamento": "NT", "capitulos": 28},
            "marcos": {"nome": "Marcos", "testamento": "NT", "capitulos": 16},
            "lucas": {"nome": "Lucas", "testamento": "NT", "capitulos": 24},
            "joao": {"nome": "João", "testamento": "NT", "capitulos": 21},
            "atos": {"nome": "Atos", "testamento": "NT", "capitulos": 28},
            "romanos": {"nome": "Romanos", "testamento": "NT", "capitulos": 16},
            "corintios1": {"nome": "1 Coríntios", "testamento": "NT", "capitulos": 16},
            "corintios2": {"nome": "2 Coríntios", "testamento": "NT", "capitulos": 13},
            "galatas": {"nome": "Gálatas", "testamento": "NT", "capitulos": 6},
            "efesios": {"nome": "Efésios", "testamento": "NT", "capitulos": 6},
            "filipenses": {"nome": "Filipenses", "testamento": "NT", "capitulos": 4},
            "colossenses": {"nome": "Colossenses", "testamento": "NT", "capitulos": 4},
            "tessalonicenses1": {"nome": "1 Tessalonicenses", "testamento": "NT", "capitulos": 5},
            "tessalonicenses2": {"nome": "2 Tessalonicenses", "testamento": "NT", "capitulos": 3},
            "timoteo1": {"nome": "1 Timóteo", "testamento": "NT", "capitulos": 6},
            "timoteo2": {"nome": "2 Timóteo", "testamento": "NT", "capitulos": 4},
            "tito": {"nome": "Tito", "testamento": "NT", "capitulos": 3},
            "filemom": {"nome": "Filemom", "testamento": "NT", "capitulos": 1},
            "hebreus": {"nome": "Hebreus", "testamento": "NT", "capitulos": 13},
            "tiago": {"nome": "Tiago", "testamento": "NT", "capitulos": 5},
            "pedro1": {"nome": "1 Pedro", "testamento": "NT", "capitulos": 5},
            "pedro2": {"nome": "2 Pedro", "testamento": "NT", "capitulos": 3},
            "joao1": {"nome": "1 João", "testamento": "NT", "capitulos": 5},
            "joao2": {"nome": "2 João", "testamento": "NT", "capitulos": 1},
            "joao3": {"nome": "3 João", "testamento": "NT", "capitulos": 1},
            "judas": {"nome": "Judas", "testamento": "NT", "capitulos": 1},
            "apocalipse": {"nome": "Apocalipse", "testamento": "NT", "capitulos": 22},
        }

    def _carregar_estrutura_api(self) -> Optional[Dict]:
        """Tenta carregar estrutura da API com múltiplas estratégias."""
        try:
            import certifi

            resp = requests.get(
                f"{self.api_base}/books",
                proxies=self.proxies or None,
                timeout=10,
                verify=certifi.where(),
            )
            if resp.status_code == 200:
                return self._processar_resposta_api(resp.json())
        except ImportError:
            print("   💡 Dica: pip install certifi")
        except Exception as e:
            print(f"   ⚠️  Tentativa 1 falhou: {type(e).__name__}")

        try:
            resp = requests.get(
                f"{self.api_base}/books",
                proxies=self.proxies or None,
                timeout=10,
                verify=False,
            )
            if resp.status_code == 200:
                return self._processar_resposta_api(resp.json())
        except Exception as e:
            print(f"   ⚠️  Tentativa 2 falhou: {type(e).__name__}")

        if self.proxies:
            try:
                print("   🔄 Tentando sem proxy...")
                resp = requests.get(
                    f"{self.api_base}/books",
                    timeout=10,
                    verify=False,
                )
                if resp.status_code == 200:
                    return self._processar_resposta_api(resp.json())
            except Exception as e:
                print(f"   ⚠️  Tentativa 3 falhou: {type(e).__name__}")

        return None

    def _processar_resposta_api(self, livros_api: List[Dict]) -> Optional[Dict]:
        if not livros_api:
            return None
        estrutura: Dict[str, Dict] = {}
        for livro in livros_api:
            abbrev = livro.get("abbrev", {}).get("pt", "").lower()
            if not abbrev:
                continue
            estrutura[abbrev] = {
                "nome": livro.get("name", ""),
                "testamento": "NT" if livro.get("testament") == "NT" else "VT",
                "capitulos": livro.get("chapters", 0),
            }
        return estrutura if len(estrutura) >= 60 else None

    # -------------------- Núcleo da análise -------------------- #

    def _encontrar_chave_livro(self, nome_livro: str) -> Optional[str]:
        if not nome_livro:
            return None

        norm = _normalize_book_name(nome_livro)

        if norm in BOOK_ALIASES:
            return BOOK_ALIASES[norm]

        norm_compact = norm.replace(" ", "")
        if norm_compact in BOOK_ALIASES:
            return BOOK_ALIASES[norm_compact]

        for key, info in self.estrutura_biblica.items():
            if _normalize_book_name(info["nome"]) == norm:
                return key

        for key, info in self.estrutura_biblica.items():
            nome_can = _normalize_book_name(info["nome"])
            if norm in nome_can or nome_can in norm:
                return key

        return None

    def _extrair_livros_de_pregacao(self, pregacao: Dict) -> Set[str]:
        """
        Extrai todos os livros possíveis de uma pregação:
        - livro_biblico
        - metadados_biblicos.livro_principal
        - metadados_biblicos.texto_base (qualquer citação conta)
        """
        livros: Set[str] = set()
        meta = pregacao.get("metadados_biblicos", {})

        lp = meta.get("livro_principal")
        if lp:
            livros.add(lp)

        lb = pregacao.get("livro_biblico")
        if lb and isinstance(lb, str):
            livros.add(lb)

        texto_base = meta.get("texto_base", "")
        if texto_base:
            m = re.match(r"([^\d]+)", texto_base)
            if m:
                livros.add(m.group(1).strip())

        return livros

    def analisar_cobertura(self, pregacoes: List[Dict]) -> Dict:
        print("\n📊 Analisando cobertura bíblica...")

        livros_pregados: Set[str] = set()
        freq_livros: Counter = Counter()
        capitulos_pregados: Dict[str, Set[int]] = defaultdict(set)

        for pregacao in pregacoes:
            livros_encontrados = self._extrair_livros_de_pregacao(pregacao)
            for nome_livro in livros_encontrados:
                chave = self._encontrar_chave_livro(nome_livro)
                if not chave:
                    continue
                livros_pregados.add(chave)
                freq_livros[chave] += 1

            meta = pregacao.get("metadados_biblicos", {})
            texto_base = meta.get("texto_base", "")
            livro_ref = meta.get("livro_principal") or pregacao.get("livro_biblico")

            if texto_base and ":" in texto_base and livro_ref:
                try:
                    cap_str = texto_base.split()[1].split(":")[0]
                    cap = int("".join(ch for ch in cap_str if ch.isdigit()))
                    chave_livro = self._encontrar_chave_livro(livro_ref)
                    if chave_livro and cap > 0:
                        capitulos_pregados[chave_livro].add(cap)
                except Exception:
                    pass

        total_livros_biblia = len(self.estrutura_biblica)
        livros_nao_pregados = set(self.estrutura_biblica.keys()) - livros_pregados

        livros_vt = {k for k, v in self.estrutura_biblica.items() if v["testamento"] == "VT"}
        livros_nt = {k for k, v in self.estrutura_biblica.items() if v["testamento"] == "NT"}

        pregados_vt = livros_pregados & livros_vt
        pregados_nt = livros_pregados & livros_nt

        total_capitulos_biblia = sum(v["capitulos"] for v in self.estrutura_biblica.values())
        capitulos_cobertos = sum(len(caps) for caps in capitulos_pregados.values())

        relatorio = {
            "resumo": {
                "total_livros_biblia": total_livros_biblia,
                "livros_pregados": len(livros_pregados),
                "livros_nao_pregados": len(livros_nao_pregados),
                "percentual_cobertura": (len(livros_pregados) / total_livros_biblia) * 100
                if total_livros_biblia
                else 0,
                "total_capitulos_biblia": total_capitulos_biblia,
                "capitulos_cobertos": capitulos_cobertos,
                "percentual_capitulos": (capitulos_cobertos / total_capitulos_biblia) * 100
                if total_capitulos_biblia
                else 0,
            },
            "por_testamento": {
                "vt": {
                    "total": len(livros_vt),
                    "pregados": len(pregados_vt),
                    "percentual": (len(pregados_vt) / len(livros_vt)) * 100 if livros_vt else 0,
                },
                "nt": {
                    "total": len(livros_nt),
                    "pregados": len(pregados_nt),
                    "percentual": (len(pregados_nt) / len(livros_nt)) * 100 if livros_nt else 0,
                },
            },
            "livros_pregados": sorted(
                [
                    {
                        "livro": self.estrutura_biblica[k]["nome"],
                        "testamento": self.estrutura_biblica[k]["testamento"],
                        "vezes": freq_livros[k],
                        "capitulos_cobertos": len(capitulos_pregados.get(k, set())),
                        "total_capitulos": self.estrutura_biblica[k]["capitulos"],
                        "percentual_caps": (
                            len(capitulos_pregados.get(k, set()))
                            / self.estrutura_biblica[k]["capitulos"]
                        )
                        * 100
                        if self.estrutura_biblica[k]["capitulos"]
                        else 0,
                    }
                    for k in livros_pregados
                ],
                key=lambda x: x["vezes"],
                reverse=True,
            ),
            "livros_nao_pregados": sorted(
                [
                    {
                        "livro": self.estrutura_biblica[k]["nome"],
                        "testamento": self.estrutura_biblica[k]["testamento"],
                        "capitulos": self.estrutura_biblica[k]["capitulos"],
                    }
                    for k in livros_nao_pregados
                ],
                key=lambda x: x["livro"],
            ),
        }

        print("✅ Análise concluída")
        return relatorio

    # -------------------- Saída -------------------- #

    def imprimir_relatorio(self, relatorio: Dict) -> None:
        print("\n" + "=" * 80)
        print("📖 RELATÓRIO DE COBERTURA BÍBLICA - IBPS (2012-2026)")
        print("=" * 80)

        resumo = relatorio["resumo"]
        print("\n🔷 RESUMO GERAL:")
        print(f"   Total de livros na Bíblia: {resumo['total_livros_biblia']}")
        print(
            f"   Livros pregados: {resumo['livros_pregados']} "
            f"({resumo['percentual_cobertura']:.1f}%)"
        )
        print(
            f"   Livros NÃO pregados: {resumo['livros_nao_pregados']} "
            f"({100 - resumo['percentual_cobertura']:.1f}%)"
        )

        print("\n🔷 COBERTURA POR CAPÍTULOS:")
        print(f"   Total de capítulos na Bíblia: {resumo['total_capitulos_biblia']:,}")
        print(
            f"   Capítulos abordados: {resumo['capitulos_cobertos']:,} "
            f"({resumo['percentual_capitulos']:.1f}%)"
        )

        vt = relatorio["por_testamento"]["vt"]
        nt = relatorio["por_testamento"]["nt"]
        print("\n🔷 POR TESTAMENTO:")
        print(
            f"   📜 Antigo Testamento: {vt['pregados']}/{vt['total']} "
            f"({vt['percentual']:.1f}%)"
        )
        print(
            f"   🆕 Novo Testamento: {nt['pregados']}/{nt['total']} "
            f"({nt['percentual']:.1f}%)"
        )

        print("\n🔷 TOP 10 LIVROS MAIS PREGADOS:")
        for i, livro in enumerate(relatorio["livros_pregados"][:10], 1):
            caps = (
                f"{livro['capitulos_cobertos']}/{livro['total_capitulos']} caps "
                f"({livro['percentual_caps']:.0f}%)"
            )
            print(f"   {i:2d}. {livro['livro']:25} - {livro['vezes']:3d}x | {caps}")

        if relatorio["livros_nao_pregados"]:
            print(
                f"\n❌ LIVROS NÃO PREGADOS ({len(relatorio['livros_nao_pregados'])}):"
            )
            for livro in relatorio["livros_nao_pregados"]:
                print(
                    f"   • {livro['livro']:30} "
                    f"({livro['testamento']}) - {livro['capitulos']} capítulos"
                )
        else:
            print("\n🎉 PARABÉNS! TODOS OS 66 LIVROS DA BÍBLIA FORAM PREGADOS!")

        print("\n" + "=" * 80)

    def salvar_relatorio(
        self,
        relatorio: Dict,
        caminho: str = "../../output/relatorio_cobertura_biblica.json",
    ) -> None:
        caminho_path = Path(caminho)
        caminho_path.parent.mkdir(parents=True, exist_ok=True)

        with open(caminho_path, "w", encoding="utf-8") as f:
            json.dump(relatorio, f, ensure_ascii=False, indent=2)

        print(f"💾 Relatório salvo em: {caminho_path.resolve()}")


# ============================ TESTE CLI ============================ #

if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("🧪 TESTE DO ANALISADOR DE COBERTURA BÍBLICA")
    print("=" * 80)

    arquivo = Path("../../output/pregacoes_enriquecidas_completo.json")

    if arquivo.exists():
        with open(arquivo, "r", encoding="utf-8") as f:
            dados = json.load(f)

        pregacoes = dados.get("pregacoes", [])

        analyzer = BiblicalCoverageAnalyzer()
        relatorio = analyzer.analisar_cobertura(pregacoes)
        analyzer.imprimir_relatorio(relatorio)
        analyzer.salvar_relatorio(relatorio)
    else:
        print(f"❌ Arquivo não encontrado: {arquivo}")
        print("   Execute primeiro o pipeline.py com opção 4!")
