import logging
import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user
from clients.github_client import GitHubClient

_RULES_DIR = Path(__file__).resolve().parent.parent.parent / "rules"
_HISTORY_DIR = _RULES_DIR / "history"
_ARQUIVADAS_DIR = _RULES_DIR / "arquivadas"
_WRITE_ROLES = {"admin", "aprovador"}

router = APIRouter(prefix="/rules", tags=["rules"])


def _safe_path(nome: str) -> Path:
    return _RULES_DIR / f"{Path(nome).name}.md"


def _github_sync(fn):
    """Executa fn() silenciosamente — erros do GitHub não quebram a resposta."""
    try:
        fn()
    except Exception as exc:
        logging.warning("GitHub sync falhou (operação local OK): %s", exc)


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
            "arquivada": False,
        })
    if _ARQUIVADAS_DIR.exists():
        for f in sorted(_ARQUIVADAS_DIR.glob("*.md")):
            lines = f.read_text(encoding="utf-8").splitlines()
            title = lines[0].lstrip("#").strip() if lines else f.stem
            result.append({
                "nome": f.stem,
                "titulo": title,
                "modificado": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                "arquivada": True,
            })
    return result


class CreateRuleBody(BaseModel):
    nome: str
    conteudo: str


@router.post("")
def create_rule(body: CreateRuleBody, user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role not in _WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Apenas admin e aprovador podem criar regras.")
    if not re.match(r"^[a-zA-Z0-9\-]+$", body.nome):
        raise HTTPException(status_code=422, detail="Nome deve conter apenas letras, números e hífens (sem extensão).")
    path = _RULES_DIR / f"{body.nome}.md"
    if path.exists():
        raise HTTPException(status_code=409, detail=f"Já existe uma regra com o nome '{body.nome}'.")
    path.write_text(body.conteudo, encoding="utf-8")

    _github_sync(lambda: GitHubClient().upsert_file(
        f"backend/rules/{body.nome}.md",
        body.conteudo,
        f"feat(políticas): criar {body.nome}",
    ))

    return {"ok": True, "nome": body.nome}


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

    _github_sync(lambda: GitHubClient().upsert_file(
        f"backend/rules/{Path(nome).name}.md",
        body.conteudo,
        f"feat(políticas): atualizar {Path(nome).name}",
    ))

    return {"ok": True}


@router.patch("/{nome}/arquivar")
def arquivar_rule(nome: str, user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role not in _WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Apenas admin e aprovador podem arquivar regras.")
    path = _RULES_DIR / f"{Path(nome).name}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Regra '{nome}' não encontrada.")
    conteudo = path.read_text(encoding="utf-8")
    _ARQUIVADAS_DIR.mkdir(exist_ok=True)
    path.rename(_ARQUIVADAS_DIR / path.name)

    _github_sync(lambda: (
        GitHubClient().upsert_file(
            f"backend/rules/arquivadas/{Path(nome).name}.md",
            conteudo,
            f"feat(políticas): arquivar {Path(nome).name}",
        ),
        GitHubClient().delete_file(
            f"backend/rules/{Path(nome).name}.md",
            f"feat(políticas): arquivar {Path(nome).name} (remover ativo)",
        ),
    ))

    return {"ok": True}


@router.patch("/{nome}/desarquivar")
def desarquivar_rule(nome: str, user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role not in _WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Apenas admin e aprovador podem desarquivar regras.")
    src = _ARQUIVADAS_DIR / f"{Path(nome).name}.md"
    if not src.exists():
        raise HTTPException(status_code=404, detail=f"Regra arquivada '{nome}' não encontrada.")
    dest = _RULES_DIR / src.name
    if dest.exists():
        raise HTTPException(status_code=409, detail=f"Já existe uma regra ativa com o nome '{nome}'.")
    conteudo = src.read_text(encoding="utf-8")
    src.rename(dest)

    _github_sync(lambda: (
        GitHubClient().upsert_file(
            f"backend/rules/{Path(nome).name}.md",
            conteudo,
            f"feat(políticas): desarquivar {Path(nome).name}",
        ),
        GitHubClient().delete_file(
            f"backend/rules/arquivadas/{Path(nome).name}.md",
            f"feat(políticas): desarquivar {Path(nome).name} (remover arquivada)",
        ),
    ))

    return {"ok": True}


@router.delete("/{nome}")
def delete_rule(nome: str, user: ClerkAuthUser = Depends(get_clerk_user)):
    if user.role not in _WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Apenas admin e aprovador podem excluir regras.")
    path = _ARQUIVADAS_DIR / f"{Path(nome).name}.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Regra arquivada '{nome}' não encontrada. Apenas políticas arquivadas podem ser excluídas.")
    path.unlink()

    _github_sync(lambda: GitHubClient().delete_file(
        f"backend/rules/arquivadas/{Path(nome).name}.md",
        f"feat(políticas): excluir {Path(nome).name}",
    ))

    return {"ok": True}
