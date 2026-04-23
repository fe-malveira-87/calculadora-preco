from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user

_RULES_DIR = Path(__file__).resolve().parent.parent.parent / "rules"
_HISTORY_DIR = _RULES_DIR / "history"
_WRITE_ROLES = {"admin", "aprovador"}

router = APIRouter(prefix="/rules", tags=["rules"])


def _safe_path(nome: str) -> Path:
    return _RULES_DIR / f"{Path(nome).name}.md"


@router.get("")
def list_rules(user: ClerkAuthUser = Depends(get_clerk_user)):
    result = []
    for f in sorted(_RULES_DIR.glob("*.md")):
        if f.name == "README.md":
            continue
        lines = f.read_text(encoding="utf-8").splitlines()
        title = lines[0].lstrip("#").strip() if lines else f.stem
        result.append({
            "nome": f.stem,
            "titulo": title,
            "modificado": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        })
    return result


@router.get("/{nome}/history")
def get_rule_history(nome: str, user: ClerkAuthUser = Depends(get_clerk_user)):
    _HISTORY_DIR.mkdir(exist_ok=True)
    name = Path(nome).name
    backups = sorted(_HISTORY_DIR.glob(f"{name}_*.md"), reverse=True)
    return [
        {
            "arquivo": b.name,
            "modificado": datetime.fromtimestamp(b.stat().st_mtime).isoformat(),
        }
        for b in backups
    ]


@router.get("/{nome}")
def get_rule(nome: str, user: ClerkAuthUser = Depends(get_clerk_user)):
    path = _safe_path(nome)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Regra '{nome}' não encontrada.")
    return {"nome": nome, "conteudo": path.read_text(encoding="utf-8")}


class RuleBody(BaseModel):
    conteudo: str


@router.put("/{nome}")
def update_rule(nome: str, body: RuleBody, user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role not in _WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Apenas admin e aprovador podem editar regras.")
    path = _safe_path(nome)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Regra '{nome}' não encontrada.")

    _HISTORY_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    (_HISTORY_DIR / f"{Path(nome).name}_{ts}.md").write_text(
        path.read_text(encoding="utf-8"), encoding="utf-8"
    )

    path.write_text(body.conteudo, encoding="utf-8")
    return {"ok": True}
