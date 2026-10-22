# Stage 1 — build the React/Vite frontend
# CDR-01B1.5: Produces the exact frontend that passed CUSTOMER_DEMO_GATE_01.
# vite.config.ts outDir is ../../frontend/dist relative to frontend/app,
# which resolves to /app/frontend/dist inside this stage.
# CDR-01B2-B2-R3: VITE_API_BASE_URL defaults to /api (same-origin) for the
# private/self-hosted Docker build. Vite shell env takes priority over
# frontend/app/.env.production at build time. Render and other public
# deployments override this ARG via their own build environment.
FROM node:20-alpine AS frontend-builder
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Demo-mode flag — set only on demo/render-v2-customer.
# Main branch omits this entirely, keeping login UI non-demo in all
# production builds.  Credentials are never baked into the bundle;
# the frontend fetches them from /api/demo-config at runtime.
ARG VITE_DEMO_MODE=true
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
WORKDIR /app
COPY frontend/app /app/frontend/app
RUN cd /app/frontend/app && npm ci && npm run build

# Stage 2 — production Python runtime
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tur \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Overlay the React build output onto frontend/.
# COPY . . already placed manifest.webmanifest and service-worker.js in
# /app/frontend/; this step overwrites index.html with the React build and
# adds assets/ — all other files in /app/frontend/ are preserved.
COPY --from=frontend-builder /app/frontend/dist/ /app/frontend/
RUN mkdir -p /app/runtime
EXPOSE 8000
CMD ["uvicorn","backend.app:app","--host","0.0.0.0","--port","8000","--proxy-headers","--forwarded-allow-ips=*"]
