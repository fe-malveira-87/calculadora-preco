import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user

_STORAGE = Path(__file__).resolve().parent.parent.parent / "storage" / "solicitacoes.json"
_lock = threading.Lock()

router = APIRouter(prefix="/aprovacoes")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read() -> list:
    with _lock:
        return _read_unlocked()


def _write(data: list) -> None:
    with _lock:
        _write_unlocked(data)


def _find(solicitacoes: list, id: str):
    for s in solicitacoes:
        if s["id"] == id:
            return s
    return None


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SolicitacaoPayload(BaseModel):
    listing_id: str
    listing_nome: str
    diaria_atual: float
    repasse_minimo: float
    desconto_percentual: float
    preco_sugerido: float
    repasse_resultante: float
    regras_aplicadas: list[str] = []
    alertas: list[str] = []


class AprovarPayload(BaseModel):
    observacao: str = ""


class RejeitarPayload(BaseModel):
    motivo: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("")
def criar_solicitacao(
    payload: SolicitacaoPayload,
    user: ClerkAuthUser = Depends(get_clerk_user),
):
    nova = {
        "id": str(uuid.uuid4()),
        "status": "pendente",
        "criado_em": datetime.now(timezone.utc).isoformat(),
        "solicitante_email": user.email,
        "solicitante_nome": user.full_name,
        "listing_id": payload.listing_id,
        "listing_nome": payload.listing_nome,
        "diaria_atual": payload.diaria_atual,
        "repasse_minimo": payload.repasse_minimo,
        "desconto_percentual": payload.desconto_percentual,
        "preco_sugerido": payload.preco_sugerido,
        "repasse_resultante": payload.repasse_resultante,
        "regras_aplicadas": payload.regras_aplicadas,
        "alertas": payload.alertas,
        "aprovador_email": None,
        "aprovador_nome": None,
        "aprovado_em": None,
        "observacao": None,
        "motivo_rejeicao": None,
    }
    with _lock:
        solicitacoes = _read_unlocked()
        solicitacoes.append(nova)
        _write_unlocked(solicitacoes)
    return {"id": nova["id"]}


@router.get("")
def listar_solicitacoes(user: ClerkAuthUser = Depends(get_clerk_user)):
    solicitacoes = _read()
    if user.role in ("admin", "aprovador"):
        return [s for s in solicitacoes if s["status"] == "pendente"]
    # atendente: apenas as suas
    return [s for s in solicitacoes if s["solicitante_email"] == user.email]


# IMPORTANT: /auditoria MUST be defined before /{id} to avoid route conflict
@router.get("/auditoria")
def auditoria(user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    solicitacoes = _read()
    return sorted(solicitacoes, key=lambda s: s["criado_em"], reverse=True)


@router.get("/{id}")
def get_solicitacao(id: str, user: ClerkAuthUser = Depends(get_clerk_user)):
    solicitacoes = _read()
    sol = _find(solicitacoes, id)
    if sol is None:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if user.role in ("admin", "aprovador"):
        return sol
    # atendente: só pode ver as suas
    if sol["solicitante_email"] != user.email:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    return sol


@router.post("/{id}/aprovar")
def aprovar_solicitacao(
    id: str,
    body: AprovarPayload,
    user: ClerkAuthUser = Depends(get_clerk_user),
):
    if user.role not in ("admin", "aprovador"):
        raise HTTPException(status_code=403, detail="Acesso restrito a admin/aprovador.")
    with _lock:
        solicitacoes = _read_unlocked()
        sol = _find(solicitacoes, id)
        if sol is None:
            raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
        if sol["status"] != "pendente":
            raise HTTPException(status_code=400, detail="Solicitação já foi processada.")
        sol["status"] = "aprovado"
        sol["aprovador_email"] = user.email
        sol["aprovador_nome"] = user.full_name
        sol["aprovado_em"] = datetime.now(timezone.utc).isoformat()
        sol["observacao"] = body.observacao
        _write_unlocked(solicitacoes)
    return sol


@router.post("/{id}/rejeitar")
def rejeitar_solicitacao(
    id: str,
    body: RejeitarPayload,
    user: ClerkAuthUser = Depends(get_clerk_user),
):
    if user.role not in ("admin", "aprovador"):
        raise HTTPException(status_code=403, detail="Acesso restrito a admin/aprovador.")
    if not body.motivo or not body.motivo.strip():
        raise HTTPException(status_code=422, detail="O campo 'motivo' é obrigatório.")
    with _lock:
        solicitacoes = _read_unlocked()
        sol = _find(solicitacoes, id)
        if sol is None:
            raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
        if sol["status"] != "pendente":
            raise HTTPException(status_code=400, detail="Solicitação já foi processada.")
        sol["status"] = "rejeitado"
        sol["aprovador_email"] = user.email
        sol["aprovador_nome"] = user.full_name
        sol["aprovado_em"] = datetime.now(timezone.utc).isoformat()
        sol["motivo_rejeicao"] = body.motivo
        _write_unlocked(solicitacoes)
    return sol


# ---------------------------------------------------------------------------
# Internal unlocked helpers (called while _lock is already held)
# ---------------------------------------------------------------------------

def _read_unlocked() -> list:
    if not _STORAGE.exists():
        return []
    with open(_STORAGE, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_unlocked(data: list) -> None:
    _STORAGE.parent.mkdir(parents=True, exist_ok=True)
    with open(_STORAGE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
