"""
Lê as regras dos arquivos .md em /rules e calcula o desconto final.
Para alterar regras, edite os arquivos markdown — não é necessário mexer aqui.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path

RULES_DIR = Path(__file__).parent / "rules"


# ---------------------------------------------------------------------------
# Estruturas de dados
# ---------------------------------------------------------------------------

@dataclass
class DadosImovel:
    listing_id: str
    nome: str
    diaria_atual: float
    cleaning_fee: float
    channel_fee_percent: float
    dias_disponiveis: int
    repasse_proprietario: float       # valor atual de repasse
    repasse_minimo: float             # piso definido no contrato


@dataclass
class DadosPriceLabs:
    preco_minimo: float               # piso sugerido pelo PriceLabs
    preco_medio: float                # média recomendada no período
    preco_maximo: float
    demanda_media: float              # 0 a 100


@dataclass
class ResultadoDesconto:
    desconto_percentual: float        # desconto final em %
    preco_sugerido: float             # diária com desconto
    repasse_resultante: float         # repasse após desconto
    regras_aplicadas: list[str] = field(default_factory=list)
    alertas: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Parser de tabelas markdown
# ---------------------------------------------------------------------------

def _parse_tabela_md(arquivo: str) -> list[tuple[str, float]]:
    """
    Lê uma tabela markdown e extrai pares (condição, valor_percentual).
    Espera que a segunda coluna termine com '%'.
    """
    caminho = RULES_DIR / arquivo
    if not caminho.exists():
        return []

    texto = caminho.read_text(encoding="utf-8")
    linhas = texto.splitlines()
    regras = []

    for linha in linhas:
        # ignora cabeçalho e separador
        if "|" not in linha or linha.strip().startswith("| ---") or linha.strip().startswith("| Cond") or linha.strip().startswith("| Dia") or linha.strip().startswith("| Nív"):
            continue
        colunas = [c.strip() for c in linha.strip().strip("|").split("|")]
        if len(colunas) < 2:
            continue
        condicao = colunas[0]
        valor_str = colunas[1].replace("%", "").strip()
        try:
            valor = float(valor_str)
            regras.append((condicao, valor))
        except ValueError:
            continue

    return regras


# ---------------------------------------------------------------------------
# Regras individuais
# ---------------------------------------------------------------------------

def _desconto_disponibilidade(dias: int) -> tuple[float, str]:
    """Retorna (desconto_max%, descrição_regra) baseado em dias disponíveis."""
    regras = _parse_tabela_md("disponibilidade.md")

    # fallback se não conseguir parsear o md
    if not regras:
        tabela = [
            (7,  0.0),
            (14, 5.0),
            (21, 10.0),
            (30, 15.0),
            (float("inf"), 20.0),
        ]
        for limite, pct in tabela:
            if dias <= limite:
                return pct, f"disponibilidade: {dias} dias livres → {pct}% máx"
        return 20.0, f"disponibilidade: {dias} dias livres → 20% máx"

    # tenta mapear os ranges do md
    faixas = [
        (7,          regras[0][1] if len(regras) > 0 else 0.0),
        (14,         regras[1][1] if len(regras) > 1 else 5.0),
        (21,         regras[2][1] if len(regras) > 2 else 10.0),
        (30,         regras[3][1] if len(regras) > 3 else 15.0),
        (float("inf"), regras[4][1] if len(regras) > 4 else 20.0),
    ]
    for limite, pct in faixas:
        if dias <= limite:
            return pct, f"disponibilidade: {dias} dias livres → {pct}% máx"
    return 20.0, f"disponibilidade: {dias} dias livres → 20% máx"


def _desconto_demanda(score: float) -> tuple[float, str]:
    """Retorna (desconto_max%, descrição_regra) baseado no score de demanda."""
    regras = _parse_tabela_md("demanda.md")

    fallback = [
        (100, 70, 0.0),
        (70,  40, 5.0),
        (40,  20, 10.0),
        (20,   0, 15.0),
    ]
    percentuais = [r[1] for r in regras] if len(regras) >= 4 else [0.0, 5.0, 10.0, 15.0]

    if score > 70:
        pct = percentuais[0]
        nivel = "Alta"
    elif score >= 40:
        pct = percentuais[1]
        nivel = "Média"
    elif score >= 20:
        pct = percentuais[2]
        nivel = "Baixa"
    else:
        pct = percentuais[3]
        nivel = "Muito baixa"

    return pct, f"demanda {nivel} ({score:.0f}%) → {pct}% máx"


def _desconto_repasse(dados: DadosImovel) -> tuple[float, str]:
    """
    Calcula o desconto máximo que ainda preserva o repasse mínimo.
    Tem prioridade sobre todas as outras regras.
    """
    if dados.diaria_atual <= 0:
        return 0.0, "repasse: diária inválida"

    espaco = dados.diaria_atual - dados.repasse_minimo
    if espaco <= 0:
        return 0.0, "repasse: diária já no piso mínimo"

    desconto_max = round((espaco / dados.diaria_atual) * 100, 2)
    return desconto_max, f"repasse: piso R${dados.repasse_minimo:.2f} → {desconto_max}% máx"


def _desconto_combinado(dados: DadosImovel, pl: DadosPriceLabs) -> tuple[float, str]:
    """Regras combinadas que cruzam demanda + disponibilidade + preços."""
    alertas = []

    # preço atual abaixo do piso PriceLabs → sem desconto
    if dados.diaria_atual < pl.preco_minimo:
        return 0.0, f"combinada: diária R${dados.diaria_atual:.2f} abaixo do piso PriceLabs R${pl.preco_minimo:.2f} → 0%"

    # preço muito acima da média → desconto para aproximar
    if pl.preco_medio > 0 and dados.diaria_atual > pl.preco_medio * 1.2:
        return 10.0, f"combinada: diária acima de 120% da média PriceLabs → até 10%"

    # demanda baixa + muitos dias disponíveis → usa o maior entre as duas regras
    if pl.demanda_media < 40 and dados.dias_disponiveis > 21:
        d_disp, _ = _desconto_disponibilidade(dados.dias_disponiveis)
        d_dem, _ = _desconto_demanda(pl.demanda_media)
        pct = max(d_disp, d_dem)
        return pct, f"combinada: demanda baixa + {dados.dias_disponiveis} dias livres → {pct}%"

    # demanda alta + muitos dias disponíveis → limita a 5%
    if pl.demanda_media >= 70 and dados.dias_disponiveis > 21:
        return 5.0, f"combinada: demanda alta mas {dados.dias_disponiveis} dias livres → 5% máx"

    return float("inf"), "combinada: sem regra específica aplicável"


# ---------------------------------------------------------------------------
# Calculadora principal
# ---------------------------------------------------------------------------

class CalculadoraDesconto:

    def calcular(self, dados: DadosImovel, pl: DadosPriceLabs) -> ResultadoDesconto:
        regras_aplicadas = []
        alertas = []

        # 1. Proteção de repasse (prioridade máxima)
        pct_repasse, desc_repasse = _desconto_repasse(dados)
        regras_aplicadas.append(f"[repasse] {desc_repasse}")

        # 2. Regra combinada
        pct_combinada, desc_combinada = _desconto_combinado(dados, pl)
        regras_aplicadas.append(f"[combinada] {desc_combinada}")

        # 3. Demanda
        pct_demanda, desc_demanda = _desconto_demanda(pl.demanda_media)
        regras_aplicadas.append(f"[demanda] {desc_demanda}")

        # 4. Disponibilidade
        pct_disp, desc_disp = _desconto_disponibilidade(dados.dias_disponiveis)
        regras_aplicadas.append(f"[disponibilidade] {desc_disp}")

        # desconto final = menor entre todas as regras (mais conservador)
        candidatos = [pct_repasse, pct_combinada, pct_demanda, pct_disp]
        desconto_final = min(c for c in candidatos if c != float("inf"))
        desconto_final = max(0.0, min(desconto_final, 50.0))  # teto de 50%

        preco_sugerido = round(dados.diaria_atual * (1 - desconto_final / 100), 2)
        repasse_resultante = round(
            dados.repasse_proprietario * (1 - desconto_final / 100), 2
        )

        if repasse_resultante < dados.repasse_minimo:
            alertas.append(
                f"ATENÇÃO: repasse resultante R${repasse_resultante:.2f} abaixo do mínimo R${dados.repasse_minimo:.2f}"
            )

        if pl.preco_minimo > 0 and preco_sugerido < pl.preco_minimo:
            alertas.append(
                f"ATENÇÃO: preço sugerido R${preco_sugerido:.2f} abaixo do piso PriceLabs R${pl.preco_minimo:.2f}"
            )

        return ResultadoDesconto(
            desconto_percentual=desconto_final,
            preco_sugerido=preco_sugerido,
            repasse_resultante=repasse_resultante,
            regras_aplicadas=regras_aplicadas,
            alertas=alertas,
        )
