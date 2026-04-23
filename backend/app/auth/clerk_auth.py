"""Validação de JWT de sessão Clerk (JWKS) e extrato de dados do solicitante."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKSet

from app.config import get_settings

_ALLOWED_EMAIL_SUFFIX = "@wecarehosting.com.br"

_jwk_cache: tuple[float, PyJWKSet] | None = None
_JWKS_TTL_SEC = 3600

_ROLES_PATH = Path(__file__).resolve().parent.parent.parent / "roles.json"


def _get_role(email: str) -> str:
    try:
        roles = json.loads(_ROLES_PATH.read_text())
        return roles.get(email.lower(), "atendente")
    except Exception:
        return "atendente"


def _jwks_url_and_headers(settings) -> tuple[str, dict[str, str]]:
    custom = settings.clerk_jwks_url.strip()
    if custom:
        return custom, {}
    sk = settings.clerk_secret_key.strip()
    if not sk:
        raise RuntimeError("CLERK_SECRET_KEY ou CLERK_JWKS_URL deve estar configurado.")
    return "https://api.clerk.com/v1/jwks", {"Authorization": f"Bearer {sk}"}


def _load_jwk_set() -> PyJWKSet:
    global _jwk_cache
    settings = get_settings()
    now = time.time()
    if _jwk_cache and now - _jwk_cache[0] < _JWKS_TTL_SEC:
        return _jwk_cache[1]
    url, headers = _jwks_url_and_headers(settings)
    with httpx.Client(timeout=20.0) as client:
        resp = client.get(url, headers=headers)
        resp.raise_for_status()
        jwk_set = PyJWKSet.from_json(resp.text)
    _jwk_cache = (now, jwk_set)
    return jwk_set


def _normalize_origin(value: str) -> str:
    return value.strip().rstrip("/")


def _authorized_azp_origins(settings) -> set[str]:
    raw: list[str] = []
    for chunk in (settings.clerk_authorized_parties, settings.cors_origins):
        raw.extend(p.strip() for p in chunk.split(",") if p.strip() and p.strip() != "*")
    return {_normalize_origin(p) for p in raw}


def decode_clerk_session_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    jwk_set = _load_jwk_set()
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if not kid:
        raise jwt.InvalidTokenError("kid ausente")
    try:
        key = jwk_set[kid].key
    except KeyError as e:
        raise jwt.InvalidTokenError("kid desconhecido") from e
    decoded: dict[str, Any] = jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        options={"verify_aud": False},
    )
    parties = _authorized_azp_origins(settings)
    azp = decoded.get("azp")
    if parties and azp:
        if _normalize_origin(azp) not in parties:
            raise jwt.InvalidTokenError(
                "Origem do token (azp) não autorizada. "
                "Inclua a URL pública do app em CLERK_AUTHORIZED_PARTIES ou CORS_ORIGINS."
            )
    return decoded


@dataclass(frozen=True)
class ClerkAuthUser:
    user_id: str
    email: str
    first_name: str
    last_name: str
    image_url: str
    role: str = "atendente"

    @property
    def full_name(self) -> str:
        parts = [self.first_name.strip(), self.last_name.strip()]
        name = " ".join(p for p in parts if p)
        return name or self.email.split("@", maxsplit=1)[0]


def _email_from_jwt_payload(payload: dict[str, Any]) -> str:
    for key in ("email", "oauth_email", "primary_email_address"):
        raw = payload.get(key)
        if isinstance(raw, str) and "@" in raw:
            return raw.strip().lower()
    return ""


def _fetch_clerk_user_from_api(user_id: str) -> dict[str, Any] | None:
    sk = get_settings().clerk_secret_key.strip()
    if not sk:
        return None
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {sk}"},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None


def _email_from_clerk_api_user(body: dict[str, Any]) -> str:
    primary_id = body.get("primary_email_address_id")
    addresses = body.get("email_addresses") or []
    if not isinstance(addresses, list):
        return ""
    primary_email = ""
    fallback = ""
    for addr in addresses:
        if not isinstance(addr, dict):
            continue
        em = (addr.get("email_address") or "").strip().lower()
        if not em:
            continue
        if not fallback:
            fallback = em
        if primary_id and addr.get("id") == primary_id:
            primary_email = em
            break
    return primary_email or fallback


def user_from_claims(payload: dict[str, Any]) -> ClerkAuthUser:
    sub = (payload.get("sub") or "").strip()
    if not sub:
        raise ValueError("Token sem subject (sub)")
    email = _email_from_jwt_payload(payload)
    fn = (payload.get("first_name") or payload.get("given_name") or "").strip()
    ln = (payload.get("last_name") or payload.get("family_name") or "").strip()
    img = (payload.get("image_url") or payload.get("picture") or "").strip()

    if not email or not fn or not ln or not img:
        api = _fetch_clerk_user_from_api(sub)
        if api:
            if not email:
                email = _email_from_clerk_api_user(api)
            if not fn:
                fn = (api.get("first_name") or "").strip()
            if not ln:
                ln = (api.get("last_name") or "").strip()
            if not img:
                img = (api.get("image_url") or "").strip()

    if not email:
        raise ValueError(
            "Token sem e-mail. No Dashboard Clerk em Sessions → Customize session token "
            "adicione o claim `email`."
        )

    role = _get_role(email)
    return ClerkAuthUser(
        user_id=sub,
        email=email,
        first_name=fn,
        last_name=ln,
        image_url=img,
        role=role,
    )


def assert_wecare_domain(email: str) -> None:
    if not email.lower().endswith(_ALLOWED_EMAIL_SUFFIX):
        raise HTTPException(
            status_code=403,
            detail=f"Acesso restrito a contas {_ALLOWED_EMAIL_SUFFIX}.",
        )


_bearer = HTTPBearer(auto_error=False)


def get_clerk_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> ClerkAuthUser:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Autenticação necessária.")
    token = creds.credentials
    try:
        payload = decode_clerk_session_token(token)
        user = user_from_claims(payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Sessão inválida: {e}") from e
    assert_wecare_domain(user.email)
    return user
