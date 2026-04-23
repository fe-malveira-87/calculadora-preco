# Calculadora de Descontos — WeCare Hosting

Ferramenta interna para calcular descontos de diárias integrando Hostaway (PMS) e PriceLabs (precificação dinâmica), com autenticação via Clerk + Google Workspace.

## Estrutura

```
calculadora-preco/
├── backend/        FastAPI + Python 3.12 (auth via Clerk JWT)
├── frontend/       React 19 + Vite + @clerk/clerk-react
└── docker-compose.yml
```

---

## Setup do Clerk

1. Acesse [clerk.com](https://clerk.com) e crie uma conta gratuita
2. Crie uma nova **Application**
3. Em **Social Connections**, habilite **Google**
4. Em **Restrictions → Allowlist**, adicione `@wecarehosting.com.br` para restringir o domínio
5. Copie a **Publishable Key** (`pk_...`) e a **Secret Key** (`sk_...`) para o `backend/.env`
6. Em **Allowed redirect URLs**, adicione `http://localhost:5173` (desenvolvimento)

---

## Backend

### Setup

```bash
cd backend
cp .env.example .env
# preencher CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY e APIs externas

uv venv
source .venv/bin/activate
uv pip install -r pyproject.toml
```

### Rodar em desenvolvimento

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Documentação automática disponível em `http://localhost:8000/docs`.

---

## Frontend

### Setup

```bash
cd frontend
cp .env.example .env
# preencher VITE_CLERK_PUBLISHABLE_KEY

npm install
```

### Rodar em desenvolvimento

```bash
cd frontend
npm run dev
```

App disponível em `http://localhost:5173`.

---

## Gerenciar roles de usuário

Edite `backend/roles.json`. Qualquer email do domínio `@wecarehosting.com.br` não listado recebe automaticamente o role `atendente`.

```json
{
  "email@wecarehosting.com.br": "admin",
  "outro@wecarehosting.com.br": "aprovador"
}
```

Roles disponíveis: `admin`, `aprovador`, `atendente`.

---

## Docker (produção)

```bash
cp backend/.env.example backend/.env
# preencher variáveis

docker compose up --build
```

Em produção (Railway), defina `CLERK_PUBLISHABLE_KEY` no serviço backend — o frontend a carrega automaticamente via `/clerk-frontend-config.js`.

---

## Variáveis de ambiente

### backend/.env

| Variável | Descrição |
|---|---|
| `CLERK_SECRET_KEY` | Secret Key do Clerk (`sk_...`) |
| `CLERK_PUBLISHABLE_KEY` | Publishable Key do Clerk (`pk_...`) — usada em produção |
| `CLERK_AUTHORIZED_PARTIES` | Origens permitidas no token (ex: `http://localhost:5173`) |
| `HOSTAWAY_ACCOUNT_ID` | ID da conta Hostaway |
| `HOSTAWAY_API_KEY` | API Key do Hostaway |
| `PRICELABS_API_KEY` | API Key do PriceLabs |
| `CORS_ORIGINS` | Origens permitidas no CORS (ex: `http://localhost:5173`) |
| `FRONTEND_URL` | URL do frontend |

### frontend/.env

| Variável | Descrição |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Publishable Key do Clerk (`pk_...`) |
| `VITE_API_URL` | URL do backend (ex: `http://localhost:8000`) |
