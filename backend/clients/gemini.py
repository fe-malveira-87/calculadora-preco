import json
from pathlib import Path

import httpx
import google.auth
import google.auth.transport.requests
from google.oauth2 import service_account

_DEFAULT_SA_PATH = Path(__file__).resolve().parent.parent.parent / "service_account.json"

VERTEX_ENDPOINT = (
    "https://us-central1-aiplatform.googleapis.com/v1/projects/{project}"
    "/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"
)


class GeminiClient:
    def __init__(self, sa_path: Path | None = None):
        path = sa_path or _DEFAULT_SA_PATH
        if not path.exists():
            raise FileNotFoundError(
                f"service_account.json não encontrado em {path}. "
                "Verifique se o arquivo está na raiz do projeto."
            )
        creds = service_account.Credentials.from_service_account_file(
            str(path),
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        auth_req = google.auth.transport.requests.Request()
        creds.refresh(auth_req)
        self._token = creds.token
        self._project = creds.project_id or json.loads(path.read_text())["project_id"]

    def analisar_desconto(self, contexto: dict) -> str:
        url = VERTEX_ENDPOINT.format(project=self._project)

        historico = contexto.get("historico_resumo") or "Sem histórico disponível"
        periodo = contexto.get("periodo") or {}

        total_noites = periodo.get("total_noites") or 1
        noites_livres = periodo.get("noites_livres", 0)
        pct_livres = round((noites_livres / total_noites) * 100, 1) if periodo.get("total_noites") else "N/A"
        economia = contexto["diaria_atual"] - contexto["preco_sugerido"]

        prompt = f"""Você é um consultor sênior de revenue management da WeCare Hosting.

Analise os dados REAIS abaixo e gere uma análise ESPECÍFICA usando os números fornecidos.
NÃO use frases genéricas. Cite os valores exatos.

═══ DADOS DO CÁLCULO ═══
Imóvel: {contexto['nome_imovel']}
Período: {contexto['data_inicio']} a {contexto['data_fim']}
Diária atual: R$ {contexto['diaria_atual']:.2f}
Desconto aplicado: {contexto['desconto_percentual']}%
Preço sugerido: R$ {contexto['preco_sugerido']:.2f}  (economia de R$ {economia:.2f} por noite)
Repasse mínimo: R$ {contexto['repasse_minimo']:.2f}
Repasse após desconto: R$ {contexto['repasse_resultante']:.2f}

═══ OCUPAÇÃO ═══
Noites no período: {periodo.get('total_noites', 'N/A')}
Noites livres: {periodo.get('noites_livres', 'N/A')} ({pct_livres}% do período)
Noites ocupadas: {periodo.get('noites_ocupadas', 'N/A')}
Taxa de ocupação: {periodo.get('taxa_ocupacao', 'N/A')}%

═══ REGRAS ═══
Regra que limitou o desconto: {contexto['regra_determinante']}
Todas as regras avaliadas:
{chr(10).join(f"  • {r}" for r in contexto['regras_aplicadas'])}

═══ HISTÓRICO DE APROVAÇÕES ═══
{historico}

Responda EXATAMENTE neste formato (use markdown):

## Por que esse desconto?
[Explique em 2-3 frases usando os números reais. Mencione a regra determinante pelo nome, \
a taxa de ocupação exata e o que isso significa para o proprietário.]

## Como foi calculado
[Mostre a conta: R$ {contexto['diaria_atual']:.2f} × (1 - {contexto['desconto_percentual']}%) = R$ {contexto['preco_sugerido']:.2f}. \
Explique por que a regra "{contexto['regra_determinante']}" limitou o desconto a {contexto['desconto_percentual']}%.]

## Recomendação
[Com base na taxa de ocupação de {periodo.get('taxa_ocupacao', 'N/A')}% e no histórico, \
dê UMA recomendação concreta e acionável. Se a ocupação está baixa, sugira ação específica. \
Se o repasse mínimo está restringindo, comente. Se tudo está adequado, diga por quê.]
"""

        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
        }

        resp = httpx.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
