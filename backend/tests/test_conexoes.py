"""
Script de validação das conexões com Hostaway e PriceLabs.
Rode antes do app para confirmar que as credenciais e endpoints estão OK.

Uso:
    python test_conexoes.py
"""

import os
import sys
from datetime import date, timedelta
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from dotenv import load_dotenv
load_dotenv(_BACKEND / ".env")

VERDE = "\033[92m"
AMARELO = "\033[93m"
VERMELHO = "\033[91m"
RESET = "\033[0m"
NEGRITO = "\033[1m"


def ok(msg): print(f"  {VERDE}✓{RESET} {msg}")
def warn(msg): print(f"  {AMARELO}⚠{RESET} {msg}")
def erro(msg): print(f"  {VERMELHO}✗{RESET} {msg}")
def titulo(msg): print(f"\n{NEGRITO}{msg}{RESET}")


# ---------------------------------------------------------------------------
# Verificação de variáveis de ambiente
# ---------------------------------------------------------------------------

titulo("1. Variáveis de ambiente")

hostaway_ok = True
pricelabs_ok = True

for var in ["HOSTAWAY_ACCOUNT_ID", "HOSTAWAY_API_KEY"]:
    val = os.getenv(var)
    if val:
        ok(f"{var} = {'*' * (len(val) - 4)}{val[-4:]}")
    else:
        erro(f"{var} não definida no .env")
        hostaway_ok = False

val_pl = os.getenv("PRICELABS_API_KEY")
if val_pl:
    ok(f"PRICELABS_API_KEY = {'*' * (len(val_pl) - 4)}{val_pl[-4:]}")
else:
    warn("PRICELABS_API_KEY não definida — testes do PriceLabs serão ignorados")
    pricelabs_ok = False

if not hostaway_ok:
    print(f"\n{VERMELHO}Configure HOSTAWAY_ACCOUNT_ID e HOSTAWAY_API_KEY no .env antes de continuar.{RESET}")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Hostaway
# ---------------------------------------------------------------------------

titulo("2. Hostaway — autenticação")

try:
    from clients.hostaway import HostawayClient
    hw = HostawayClient()
    token = hw._get_token()
    ok(f"Token obtido: {token[:20]}...")
except Exception as e:
    erro(f"Falha na autenticação: {e}")
    sys.exit(1)

titulo("3. Hostaway — listagem de imóveis")

try:
    imoveis = hw.get_listings()
    if imoveis:
        ok(f"{len(imoveis)} imóvel(is) encontrado(s)")
        print(f"\n  {'ID':<10} {'Nome':<40} {'Preço base':>12}")
        print(f"  {'-'*10} {'-'*40} {'-'*12}")
        for i in imoveis[:10]:
            print(f"  {str(i.get('id','')):<10} {str(i.get('name',''))[:40]:<40} R$ {i.get('price', 0):>9,.2f}")
        if len(imoveis) > 10:
            warn(f"... e mais {len(imoveis) - 10} imóveis (exibindo apenas 10)")
    else:
        warn("Nenhum imóvel retornado — verifique permissões da API Key")
except Exception as e:
    erro(f"Erro ao listar imóveis: {e}")
    sys.exit(1)

if not imoveis:
    sys.exit(1)

# testa com o primeiro imóvel
primeiro = imoveis[0]
lid = primeiro["id"]
nome = primeiro.get("name", f"#{lid}")
hoje = date.today()
fim = hoje + timedelta(days=30)

titulo(f"4. Hostaway — calendário de '{nome}'")

try:
    calendario = hw.get_calendar(lid, hoje, fim)
    dias_disp = sum(1 for d in calendario if d.get("status") == "available" and d.get("isAvailable") == 1)
    dias_res = sum(1 for d in calendario if d.get("status") == "reserved")
    dias_blo = sum(1 for d in calendario if d.get("status") == "blocked")
    ok(f"{len(calendario)} dias retornados")
    ok(f"Disponíveis: {dias_disp}  |  Reservados: {dias_res}  |  Bloqueados: {dias_blo}")
    if calendario:
        exemplo = calendario[0]
        print(f"\n  Exemplo de item do calendário:")
        for k, v in exemplo.items():
            print(f"    {k}: {v}")
except Exception as e:
    erro(f"Erro ao buscar calendário: {e}")

titulo(f"5. Hostaway — taxas de '{nome}'")

try:
    taxas = hw.get_listing_fees(lid)
    ok("Taxas retornadas:")
    for k, v in taxas.items():
        print(f"    {k}: {v}")
except Exception as e:
    erro(f"Erro ao buscar taxas: {e}")

titulo(f"6. Hostaway — repasse/financeiro de '{nome}'")

try:
    repasse = hw.get_owner_revenue(lid, hoje, fim)
    if repasse:
        ok(f"{len(repasse)} registro(s) financeiro(s) encontrado(s)")
        print(f"\n  Exemplo de item financeiro:")
        for k, v in list(repasse[0].items())[:10]:
            print(f"    {k}: {v}")
    else:
        warn("Nenhum dado financeiro retornado para o período — tente outro intervalo")
except Exception as e:
    erro(f"Erro ao buscar dados financeiros: {e}")
    warn("O endpoint /finance/ownerRevenue pode ter nome diferente — veja a resposta acima para ajustar")


# ---------------------------------------------------------------------------
# PriceLabs
# ---------------------------------------------------------------------------

if not pricelabs_ok:
    titulo("7. PriceLabs — ignorado (API Key não configurada)")
    titulo("8. PriceLabs — ignorado (API Key não configurada)")
else:
    titulo("7. PriceLabs — listagem de imóveis")
    imoveis_pl = []
    try:
        from clients.pricelabs import PriceLabsClient
        pl = PriceLabsClient()
        imoveis_pl = pl.get_listings()
        if imoveis_pl:
            ok(f"{len(imoveis_pl)} imóvel(is) encontrado(s)")
            print(f"\n  {'ID':<20} {'Nome':<40}")
            print(f"  {'-'*20} {'-'*40}")
            for i in imoveis_pl[:10]:
                pid = i.get("id") or i.get("listing_id", "")
                pnome = i.get("name", "")[:40]
                print(f"  {str(pid):<20} {pnome:<40}")
            if len(imoveis_pl) > 10:
                warn(f"... e mais {len(imoveis_pl) - 10} imóveis")
        else:
            warn("Nenhum imóvel retornado pelo PriceLabs")
    except Exception as e:
        erro(f"Erro ao listar imóveis PriceLabs: {e}")

    titulo("8. PriceLabs — preços do primeiro imóvel")
    try:
        if imoveis_pl:
            pl_id = str(imoveis_pl[0].get("id") or imoveis_pl[0].get("listing_id", ""))
            precos = pl.get_listing_prices(pl_id, hoje, hoje + timedelta(days=7))
            if precos:
                ok(f"{len(precos)} dia(s) retornado(s)")
                print(f"\n  {'Data':<12} {'Preço':>10} {'Mín':>10} {'Demanda':>10}")
                print(f"  {'-'*12} {'-'*10} {'-'*10} {'-'*10}")
                for d in precos[:7]:
                    print(
                        f"  {d.get('date',''):<12}"
                        f"  R$ {d.get('price', 0):>7,.2f}"
                        f"  R$ {d.get('min_price', 0):>7,.2f}"
                        f"  {d.get('demand_factor', 0):>9.1f}"
                    )
                print(f"\n  Campos disponíveis no item: {list(precos[0].keys())}")
            else:
                warn("Nenhum preço retornado para o período")
    except Exception as e:
        erro(f"Erro ao buscar preços PriceLabs: {e}")


# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------

titulo("Concluído")
print(f"\n  Se todos os itens acima mostraram {VERDE}✓{RESET}, rode o dashboard com:")
print(f"\n  {NEGRITO}streamlit run app.py{RESET}\n")
print(f"  Se algum campo retornou nome diferente do esperado,")
print(f"  ajuste os clientes em clients/hostaway.py e clients/pricelabs.py\n")
