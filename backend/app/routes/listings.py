from fastapi import APIRouter, Depends

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user
from clients.hostaway import HostawayClient

router = APIRouter(tags=["listings"])


@router.get("/listings")
def get_listings(user: ClerkAuthUser = Depends(get_clerk_user)):
    return HostawayClient().get_listings()
