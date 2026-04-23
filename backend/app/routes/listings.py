from fastapi import APIRouter, Depends

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user
from clients.hostaway import HostawayClient

router = APIRouter(tags=["listings"])


@router.get("/listings")
def get_listings(user: ClerkAuthUser = Depends(get_clerk_user)):
    raw = HostawayClient().get_listings()
    return [
        {
            "id": l.get("id"),
            "name": l.get("name", ""),
            "price": l.get("price", 0),
            "cleaning_fee": l.get("cleaningFee", 0),
            "currency": l.get("currency", "BRL"),
        }
        for l in raw
    ]
