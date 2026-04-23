import dataclasses
import json
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from filelock import FileLock
from pydantic import BaseModel

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user
from calculator import CalculadoraDesconto, DadosImovel, DadosPriceLabs
from clients.pricelabs import PriceLabsClient

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_SOL_FILE = _DATA_DIR / "solicitacoes.json"
_AUD_FILE = _DATA_DIR / "auditoria.json"
_SOL_LOCK = FileLock(str(_DATA_DIR / "solicitacoes.lock"))
_AUD_LOCK = FileLock(str(_DATA_DIR / "auditoria.lock"))

router = APIRouter(prefix="/aprovacao", tags=["aprovacao"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read(path: Path) -> list:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8")) or []
    except (json.JSONDecodeError, OSError):
        return []


def _write(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )


# ── Models ───────────────────────────────────────────────────────────────────

class SolicitarRequest(BaseModel):
    listing_id: str
    nome: str
    data_inicio: date
    data_fim: date
    diaria_atual: float
    repasse_minimo: float
    dias_disponiveis: int = 30
    taxa_limpeza: float = 0.0
    comissao_canal: float = 0.0


class AprovarBody(BaseModel):
    comentario: str = ""


class RejeitarBody(BaseModel):
    comentario: str


# ── Endpoints ─────────────────────────────────────────────────────────────────
# IMPORTANT: literal routes (/fila, /historico, /auditoria) must be defined
# BEFORE the parameterized route (/{id}/...) to avoid routing conflicts.

@router.post("/solicitar")
def solicitar(body: SolicitarRequest, user: ClerkAuthUser = Depends(get_clerk_user)):
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

    solicitacao = {
        "id": str(uuid.uuid4()),
        "status": "pendente",
        "solicitante": {"email": user.email, "nome": user.full_name},
        "listing_id": body.listing_id,
        "nome_imovel": body.nome,
        "data_inicio": body.data_inicio.isoformat(),
        "data_fim": body.data_fim.isoformat(),
        "diaria_atual": body.diaria_atual,
        "repasse_minimo": body.repasse_minimo,
        "resultado": dataclasses.asdict(resultado),
        "criado_em": _now(),
        "atualizado_em": _now(),
        "aprovador": None,
        "comentario": None,
    }

    with _SOL_LOCK:
        items = _read(_SOL_FILE)
        items.append(solicitacao)
        _write(_SOL_FILE, items)

    return {"id": solicitacao["id"], "status": "pendente"}


@router.get("/fila")
def fila(user: ClerkAuthUser = Depends(get_clerk_user)):
    with _SOL_LOCK:
        items = _read(_SOL_FILE)
    pendentes = [i for i in items if i["status"] == "pendente"]
    if user.role in ("admin", "aprovador"):
        return pendentes
    return [i for i in pendentes if i["solicitante"]["email"] == user.email]


@router.get("/historico")
def historico(user: ClerkAuthUser = Depends(get_clerk_user)):
    with _SOL_LOCK:
        items = _read(_SOL_FILE)
    if user.role in ("admin", "aprovador"):
        return sorted(items, key=lambda x: x["criado_em"], reverse=True)
    return sorted(
        [i for i in items if i["solicitante"]["email"] == user.email],
        key=lambda x: x["criado_em"],
        reverse=True,
    )


@router.get("/auditoria")
def auditoria(user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas admin pode acessar a auditoria.")
    with _AUD_LOCK:
        return _read(_AUD_FILE)


@router.put("/{id}/aprovar")
def aprovar(id: str, body: AprovarBody, user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role not in ("admin", "aprovador"):
        raise HTTPException(status_code=403, detail="Acesso restrito a admin e aprovador.")
    with _SOL_LOCK:
        items = _read(_SOL_FILE)
        sol = next((i for i in items if i["id"] == id), None)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
        if sol["status"] != "pendente":
            raise HTTPException(status_code=400, detail=f"Solicitação já está '{sol['status']}'.")
        sol["status"] = "aprovado"
        sol["aprovador"] = {"email": user.email, "nome": user.full_name}
        sol["comentario"] = body.comentario or None
        sol["atualizado_em"] = _now()
        _write(_SOL_FILE, items)

    entrada = {
        "id": str(uuid.uuid4()),
        "acao": "aprovado",
        "solicitacao_id": id,
        "aprovador": {"email": user.email, "nome": user.full_name},
        "comentario": body.comentario or None,
        "timestamp": _now(),
    }
    with _AUD_LOCK:
        log = _read(_AUD_FILE)
        log.append(entrada)
        _write(_AUD_FILE, log)

    return sol


@router.put("/{id}/rejeitar")
def rejeitar(id: str, body: RejeitarBody, user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role not in ("admin", "aprovador"):
        raise HTTPException(status_code=403, detail="Acesso restrito a admin e aprovador.")
    if not body.comentario.strip():
        raise HTTPException(status_code=422, detail="Comentário é obrigatório para rejeição.")
    with _SOL_LOCK:
        items = _read(_SOL_FILE)
        sol = next((i for i in items if i["id"] == id), None)
        if not sol:
            raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
        if sol["status"] != "pendente":
            raise HTTPException(status_code=400, detail=f"Solicitação já está '{sol['status']}'.")
        sol["status"] = "rejeitado"
        sol["aprovador"] = {"email": user.email, "nome": user.full_name}
        sol["comentario"] = body.comentario
        sol["atualizado_em"] = _now()
        _write(_SOL_FILE, items)

    entrada = {
        "id": str(uuid.uuid4()),
        "acao": "rejeitado",
        "solicitacao_id": id,
        "aprovador": {"email": user.email, "nome": user.full_name},
        "comentario": body.comentario,
        "timestamp": _now(),
    }
    with _AUD_LOCK:
        log = _read(_AUD_FILE)
        log.append(entrada)
        _write(_AUD_FILE, log)

    return sol
