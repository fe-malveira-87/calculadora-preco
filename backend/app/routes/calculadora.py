import dataclasses
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user
from calculator import CalculadoraDesconto, DadosImovel, DadosPriceLabs
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

    resultado = CalculadoraDesconto().calcular(dados, dados_pl)
    return dataclasses.asdict(resultado)
