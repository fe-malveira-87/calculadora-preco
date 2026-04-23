import os
import httpx
from datetime import date
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.pricelabs.co/v1"


class PriceLabsClient:
    def __init__(self):
        self.api_key = os.getenv("PRICELABS_API_KEY")

    def _headers(self) -> dict:
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: dict = None) -> dict:
        resp = httpx.get(
            f"{BASE_URL}{path}",
            headers=self._headers(),
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, body: dict) -> dict:
        resp = httpx.post(
            f"{BASE_URL}{path}",
            headers=self._headers(),
            json=body,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    # --- Imóveis ---

    def get_listings(self) -> list[dict]:
        """Retorna todos os imóveis cadastrados no PriceLabs."""
        data = self._get("/listings")
        return data.get("listings", [])

    # --- Preços por data ---

    def get_listing_prices(
        self,
        listing_id: str,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """
        Retorna os preços recomendados por dia para o imóvel no período.
        Cada item contém: date, price, min_price, base_price, demand_factor.
        """
        data = self._post(
            "/listing_data",
            body={
                "listing_ids": [listing_id],
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )
        listings = data.get("listings", [])
        if not listings:
            return []
        return listings[0].get("data", [])

    def get_price_summary(
        self,
        listing_id: str,
        start_date: date,
        end_date: date,
    ) -> dict:
        """
        Retorna um resumo de preços para o período:
        - preco_minimo: menor preço recomendado (piso do PriceLabs)
        - preco_medio: média dos preços recomendados
        - preco_maximo: maior preço recomendado
        - demanda_media: média do fator de demanda (0 a 100)
        """
        prices = self.get_listing_prices(listing_id, start_date, end_date)
        if not prices:
            return {}

        valores = [d.get("price", 0) for d in prices if d.get("price")]
        minimos = [d.get("min_price", 0) for d in prices if d.get("min_price")]
        demandas = [d.get("demand_factor", 0) for d in prices if d.get("demand_factor") is not None]

        return {
            "preco_minimo": min(minimos) if minimos else 0,
            "preco_medio": round(sum(valores) / len(valores), 2) if valores else 0,
            "preco_maximo": max(valores) if valores else 0,
            "demanda_media": round(sum(demandas) / len(demandas), 2) if demandas else 0,
            "total_dias": len(prices),
        }

    # --- Demanda de mercado ---

    def get_market_data(
        self,
        listing_id: str,
        start_date: date,
        end_date: date,
    ) -> dict:
        """
        Retorna dados de demanda de mercado para o imóvel no período.
        Inclui: ocupação esperada, demanda relativa, pace de reservas.
        """
        data = self._get(
            "/market_data",
            params={
                "listing_id": listing_id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )
        return data.get("result", {})

    def get_demand_score(
        self,
        listing_id: str,
        start_date: date,
        end_date: date,
    ) -> float:
        """
        Retorna o score de demanda médio para o período (0 a 100).
        Usado pelas regras de demanda para calcular desconto.
        """
        prices = self.get_listing_prices(listing_id, start_date, end_date)
        if not prices:
            return 0.0

        demandas = [d.get("demand_factor", 0) for d in prices if d.get("demand_factor") is not None]
        if not demandas:
            return 0.0

        return round(sum(demandas) / len(demandas), 2)
