import json
from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.clerk_auth import ClerkAuthUser, get_clerk_user
from clients.gemini import GeminiClient

router = APIRouter(prefix="/ia", tags=["ia"])

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_SOL_FILE = _DATA_DIR / "solicitacoes.json"


class AnalisarRequest(BaseModel):
    nome_imovel: str
    data_inicio: str
    data_fim: str
    diaria_atual: float
    desconto_percentual: float
    preco_sugerido: float
    repasse_minimo: float
    repasse_resultante: float
    regra_determinante: str
    regras_aplicadas: list[str]
    periodo: dict | None = None
    listing_id: str


def _historico_resumo() -> str:
    if not _SOL_FILE.exists():
        return "Sem histórico disponível"
    try:
        solicitacoes = json.loads(_SOL_FILE.read_text(encoding="utf-8"))
        aprovadas = [
            s for s in solicitacoes
            if s.get("status") == "aprovado"
        ]
        ultimas = aprovadas[-5:]
        if not ultimas:
            return "Nenhuma aprovação registrada ainda"
        linhas = []
        for s in reversed(ultimas):
            imovel = s.get("nome_imovel") or s.get("listing_id", "?")
            desconto = s.get("desconto_percentual", "?")
            data = s.get("criado_em", "")[:10]
            linhas.append(f"- {imovel}: {desconto}% aprovado em {data}")
        return "\n".join(linhas)
    except Exception:
        return "Sem histórico disponível"


@router.post("/analisar")
def analisar(body: AnalisarRequest, user: ClerkAuthUser = Depends(get_clerk_user)):
    try:
        contexto = {
            "nome_imovel": body.nome_imovel,
            "data_inicio": body.data_inicio,
            "data_fim": body.data_fim,
            "diaria_atual": body.diaria_atual,
            "desconto_percentual": body.desconto_percentual,
            "preco_sugerido": body.preco_sugerido,
            "repasse_minimo": body.repasse_minimo,
            "repasse_resultante": body.repasse_resultante,
            "regra_determinante": body.regra_determinante,
            "regras_aplicadas": body.regras_aplicadas,
            "periodo": body.periodo,
            "historico_resumo": _historico_resumo(),
        }
        analise = GeminiClient().analisar_desconto(contexto)
        return {"analise": analise}
    except Exception as e:
        return {"analise": None, "erro": str(e)}
