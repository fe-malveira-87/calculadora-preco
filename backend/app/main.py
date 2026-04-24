import json
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user
from app.config import get_settings
from app.routes.aprovacoes import router as aprovacoes_router
from app.routes.dashboard import router as dashboard_router
from app.routes.aprovacao import router as aprovacao_router
from app.routes.calculadora import router as calculadora_router
from app.routes.ia import router as ia_router
from app.routes.listings import router as listings_router
from app.routes.rules import router as rules_router

app = FastAPI(title="WeCare Calculadora de Descontos", version="1.0.0")

_settings = get_settings()
_cors = [o.strip() for o in _settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(listings_router)
app.include_router(calculadora_router)
app.include_router(rules_router)
app.include_router(aprovacoes_router)
app.include_router(aprovacao_router)
app.include_router(dashboard_router)
app.include_router(ia_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/me")
def get_me(user: ClerkAuthUser = Depends(get_clerk_user)):
    return {
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "image_url": user.image_url,
        "role": user.role,
    }


@app.get("/clerk-frontend-config.js")
def clerk_frontend_config():
    """Expõe a chave publicável Clerk para o bundle estático (Railway)."""
    pk = get_settings().clerk_publishable_key.strip()
    body = "window.__CLERK_PUBLISHABLE_KEY__=" + (json.dumps(pk) if pk else "''") + ";"
    return Response(body, media_type="application/javascript; charset=utf-8")


# Serve frontend dist em produção
_frontend_dist = _backend_dir.parent / "frontend" / "dist"
_assets_dir = _frontend_dist / "assets"
if _assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def _spa_fallback(full_path: str):
        candidate = (_frontend_dist / full_path).resolve()
        try:
            candidate.relative_to(_frontend_dist.resolve())
        except ValueError:
            return FileResponse(_frontend_dist / "index.html")
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_frontend_dist / "index.html")
