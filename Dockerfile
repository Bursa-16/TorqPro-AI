# Stage 1 — build the React/Vite frontend
# CDR-01B1.5: Produces the exact frontend that passed CUSTOMER_DEMO_GATE_01.
# vite.config.ts outDir is ../../frontend/dist relative to frontend/app,
# which resolves to /app/frontend/dist inside this stage.
FROM node:20-alpine AS frontend-builder
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
