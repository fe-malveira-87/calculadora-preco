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

        prompt = f"""Você é um consultor especialista em precificação de imóveis de temporada da WeCare Hosting.

Analise os dados abaixo e retorne uma explicação clara e profissional em português:

IMÓVEL: {contexto['nome_imovel']}
PERÍODO: {contexto['data_inicio']} a {contexto['data_fim']}
DIÁRIA ATUAL: R$ {contexto['diaria_atual']:.2f}
DESCONTO SUGERIDO: {contexto['desconto_percentual']}%
PREÇO SUGERIDO: R$ {contexto['preco_sugerido']:.2f}
REPASSE MÍNIMO: R$ {contexto['repasse_minimo']:.2f}
REPASSE RESULTANTE: R$ {contexto['repasse_resultante']:.2f}

OCUPAÇÃO DO PERÍODO:
- Total de noites: {periodo.get('total_noites', 'N/A')}
- Noites livres: {periodo.get('noites_livres', 'N/A')}
- Noites ocupadas: {periodo.get('noites_ocupadas', 'N/A')}
- Taxa de ocupação: {periodo.get('taxa_ocupacao', 'N/A')}%

REGRA QUE DETERMINOU O DESCONTO: {contexto['regra_determinante']}
TODAS AS REGRAS APLICADAS:
{chr(10).join(f"- {r}" for r in contexto['regras_aplicadas'])}

HISTÓRICO RECENTE DE APROVAÇÕES (últimas aprovadas):
{historico}

Estruture sua resposta em 3 partes curtas:
1. **Por que esse desconto foi sugerido** (2-3 frases explicando a lógica)
2. **O cálculo aplicado** (mostre como chegou ao preço sugerido)
3. **Sugestão de melhoria** (se houver insights com base nos dados e histórico, sugira ajuste de política ou ação — caso contrário, confirme que a política está adequada)

Seja direto, objetivo e use linguagem adequada para gestores de hospedagem."""

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
