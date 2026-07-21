# Hugging Face Spaces — single container (API + UI)
# https://huggingface.co/docs/hub/spaces-sdks-docker

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    curl \
    nginx \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Backend (Spaces-optimized deps: no Chroma / sentence-transformers)
COPY backend/requirements-spaces.txt /app/backend/requirements-spaces.txt
RUN pip install --no-cache-dir -r /app/backend/requirements-spaces.txt
COPY backend/ /app/backend/

# Frontend
COPY frontend/package.json frontend/package-lock.json /app/frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ /app/frontend/

# Same-origin API via nginx (/api → backend)
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

WORKDIR /app
COPY deploy/ /app/deploy/
RUN chmod +x /app/deploy/start.spaces.sh \
    && mkdir -p /data/uploads /data/processed_videos /data/models /data/chroma_data /var/log/nginx

ENV DATABASE_URL=sqlite:////data/app.db \
    UPLOAD_DIR=/data/uploads \
    PROCESSED_DIR=/data/processed_videos \
    MODELS_DIR=/data/models \
    CHROMA_PERSIST_DIR=/data/chroma_data \
    ENABLE_VECTOR_SEARCH=false \
    USE_DEEPSORT=false \
    FRAME_SAMPLE_RATE=5 \
    CORS_ORIGINS=* \
    SECRET_KEY=hf-spaces-dev-secret-change-me

EXPOSE 7860
CMD ["/app/deploy/start.spaces.sh"]
