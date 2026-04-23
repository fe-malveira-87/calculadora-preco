import os
import httpx
from datetime import date, datetime
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.hostaway.com/v1"


class HostawayClient:
    def __init__(self):
        self.account_id = os.getenv("HOSTAWAY_ACCOUNT_ID")
        self.api_key = os.getenv("HOSTAWAY_API_KEY")
        self._token: str | None = None

    def _get_token(self) -> str:
        if self._token:
            return self._token

        resp = httpx.post(
            f"{BASE_URL}/accessTokens",
            data={
                "grant_type": "client_credentials",
                "client_id": self.account_id,
                "client_secret": self.api_key,
                "scope": "general",
            },
            headers={"Cache-control": "no-cache"},
        )
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        return self._token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
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

    # --- Imóveis ---

    def get_listings(self) -> list[dict]:
        """Retorna todos os imóveis ativos."""
        data = self._get("/listings", params={"limit": 100, "offset": 0})
        return data.get("result", [])

    def get_listing(self, listing_id: int) -> dict:
        """Retorna detalhes de um imóvel."""
        data = self._get(f"/listings/{listing_id}")
        return data.get("result", {})

    # --- Disponibilidade / Calendário ---

    def get_calendar(
        self,
        listing_id: int,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """
        Retorna o calendário do imóvel no período.
        Cada item representa um dia com status (available, booked, blocked).
        """
        data = self._get(
            f"/listings/{listing_id}/calendar",
            params={
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
            },
        )
        return data.get("result", [])

    def count_available_days(
        self,
        listing_id: int,
        start_date: date,
        end_date: date,
    ) -> int:
        """Conta dias disponíveis no período."""
        calendar = self.get_calendar(listing_id, start_date, end_date)
        return sum(1 for day in calendar if day.get("status") == "available" and day.get("isAvailable") == 1)

    # --- Taxas e valores ---

    def get_listing_fees(self, listing_id: int) -> dict:
        """
        Retorna as taxas configuradas no imóvel:
        - cleaningFee
        - channelFee
        - baseAmount (diária base)
        """
        listing = self.get_listing(listing_id)
        return {
            "base_amount": listing.get("price", 0),
            "cleaning_fee": listing.get("cleaningFee", 0),
            "channel_fee_percent": listing.get("channelCommission", 0),
            "currency": listing.get("currency", "BRL"),
        }

    # --- Repasse ao proprietário ---

    def get_owner_revenue(
        self,
        listing_id: int,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """
        Extrai dados financeiros de repasse das reservas no período.
        Para cada reserva retorna: total, repasse_host, limpeza, taxa_canal.
        Airbnb: usa airbnbExpectedPayoutAmount como repasse.
        Outros canais: usa totalPrice - cleaningFee como estimativa.
        """
        reservas = self.get_reservations(listing_id, start_date, end_date)
        resultado = []
        for r in reservas:
            canal = r.get("channelName", "")
            total = r.get("totalPrice", 0) or 0
            limpeza = r.get("cleaningFee", 0) or 0
            noites = r.get("nights", 1) or 1

            if "airbnb" in canal.lower():
                repasse_host = r.get("airbnbExpectedPayoutAmount", 0) or 0
                taxa_canal = r.get("airbnbListingHostFee", 0) or 0
            else:
                taxa_canal = r.get("channelCommissionAmount", 0) or 0
                repasse_host = total - limpeza - taxa_canal

            resultado.append({
                "reserva_id": r.get("id"),
                "canal": canal,
                "check_in": r.get("arrivalDate"),
                "check_out": r.get("departureDate"),
                "noites": noites,
                "total": total,
                "limpeza": limpeza,
                "taxa_canal": taxa_canal,
                "repasse_host": repasse_host,
                "diaria_media": round((total - limpeza) / noites, 2) if noites else 0,
                "repasse_por_noite": round(repasse_host / noites, 2) if noites else 0,
            })
        return resultado

    def get_reservations(
        self,
        listing_id: int,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Retorna reservas do imóvel no período."""
        data = self._get(
            "/reservations",
            params={
                "listingId": listing_id,
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "limit": 50,
            },
        )
        return data.get("result", [])
