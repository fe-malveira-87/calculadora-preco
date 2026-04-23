# ── Stage 1: build React frontend ──────────────────────────────────────────
FROM node:20-slim AS node-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# VITE_API_URL vazio = mesma origem (backend serve o frontend)
# VITE_CLERK_PUBLISHABLE_KEY opcional: o runtime carrega via /clerk-frontend-config.js
ARG VITE_API_URL=""
ARG VITE_CLERK_PUBLISHABLE_KEY=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN npm run build

# ── Stage 2: Python backend ─────────────────────────────────────────────────
FROM python:3.12-slim

# /project/backend espelha a estrutura do repo:
#   /project/backend/  → código Python
#   /project/frontend/dist/ → build React (main.py espera _backend_dir.parent/frontend/dist)
WORKDIR /project/backend

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY backend/ ./

COPY --from=node-builder /frontend/dist /project/frontend/dist

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
