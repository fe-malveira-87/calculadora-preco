import dataclasses
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user
from calculator import CalculadoraDesconto, DadosImovel, DadosPriceLabs
from clients.hostaway import HostawayClient
from clients.pricelabs import PriceLabsClient

router = APIRouter(prefix="/calculadora", tags=["calculadora"])


class CalcularRequest(BaseModel):
    listing_id: str
    nome: str
    data_inicio: date
    data_fim: date
    diaria_atual: float
    repasse_minimo: float
    dias_disponiveis: int = 30
    taxa_limpeza: float = 0.0
    comissao_canal: float = 0.0


@router.post("/calcular")
def calcular(body: CalcularRequest, user: ClerkAuthUser = Depends(get_clerk_user)):
    try:
        resumo = PriceLabsClient().get_price_summary(body.listing_id, body.data_inicio, body.data_fim)
    except Exception:
        resumo = {}

    dados_pl = DadosPriceLabs(
        preco_minimo=resumo.get("preco_minimo", 0.0),
        preco_medio=resumo.get("preco_medio", 0.0),
        preco_maximo=resumo.get("preco_maximo", 0.0),
        demanda_media=resumo.get("demanda_media", 0.0),
    )

    dados = DadosImovel(
        listing_id=body.listing_id,
        nome=body.nome,
        diaria_atual=body.diaria_atual,
        cleaning_fee=body.taxa_limpeza,
        channel_fee_percent=body.comissao_canal,
        dias_disponiveis=body.dias_disponiveis,
        repasse_proprietario=body.diaria_atual,
        repasse_minimo=body.repasse_minimo,
    )

    resultado = dataclasses.asdict(CalculadoraDesconto().calcular(dados, dados_pl))

    try:
        listing_id_int = int(body.listing_id)
    except (ValueError, TypeError):
        listing_id_int = None

    periodo = None
    if listing_id_int:
        try:
            hostaway = HostawayClient()
            calendar = hostaway.get_calendar(listing_id_int, body.data_inicio, body.data_fim)
            total_dias = len(calendar)
            dias_livres = sum(
                1 for d in calendar
                if d.get("status") == "available" and d.get("isAvailable") == 1
            )
            dias_ocupados = total_dias - dias_livres
            periodo = {
                "total_dias": total_dias,
                "dias_livres": dias_livres,
                "dias_ocupados": dias_ocupados,
                "taxa_ocupacao": round(dias_ocupados / total_dias * 100, 1) if total_dias else 0.0,
            }
        except Exception:
            pass

    custos = None
    if listing_id_int:
        try:
            hostaway = HostawayClient()
            fees = hostaway.get_listing_fees(listing_id_int)
            comissao_percent = fees.get("channel_fee_percent") or 0.0
            custos = {
                "taxa_limpeza": fees.get("cleaning_fee") or 0.0,
                "comissao_canal_percent": comissao_percent,
                "comissao_canal_valor": round(body.diaria_atual * comissao_percent / 100, 2),
            }
        except Exception:
            pass

    reservas = None
    if listing_id_int:
        try:
            hostaway = HostawayClient()
            revenue = hostaway.get_owner_revenue(listing_id_int, body.data_inicio, body.data_fim)
            reservas = sorted(
                [
                    {
                        "canal": r["canal"],
                        "check_in": r["check_in"],
                        "check_out": r["check_out"],
                        "noites": r["noites"],
                        "total": r["total"],
                        "taxa_limpeza": r["limpeza"],
                        "taxa_canal": r["taxa_canal"],
                        "repasse_host": r["repasse_host"],
                        "diaria_media": r["diaria_media"],
                    }
                    for r in revenue
                ],
                key=lambda r: r["check_in"] or "",
            )
        except Exception:
            pass

    resultado["periodo"] = periodo
    resultado["custos"] = custos
    resultado["reservas"] = reservas

    return resultado
