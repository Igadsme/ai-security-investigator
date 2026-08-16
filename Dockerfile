# Single container: FastAPI + Next.js behind nginx
# Hugging Face Spaces (UID 1000, port 7860) and Render ($PORT)

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_CACHE=/tmp/npm-cache \
    HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    YOLO_CONFIG_DIR=/tmp/Ultralytics \
    TORCH_HOME=/tmp/torch \
    MPLCONFIGDIR=/tmp/matplotlib

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    ffmpeg \
    curl \
    nginx \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 user \
    && mkdir -p /data/uploads /data/processed_videos /data/models /data/chroma_data \
        /app/models /tmp/Ultralytics /tmp/torch /tmp/matplotlib /tmp/npm-cache \
    && chmod -R 777 /data /tmp/Ultralytics /tmp/torch /tmp/matplotlib /tmp/npm-cache

# Backend (production deps: no Chroma / sentence-transformers)
COPY backend/requirements-spaces.txt /app/backend/requirements-spaces.txt
RUN pip install --no-cache-dir -r /app/backend/requirements-spaces.txt \
    && python -c "from ultralytics import YOLO; YOLO('/app/models/yolov8n.pt')" \
    && test -s /app/models/yolov8n.pt \
    && chmod -R a+rwX /app/models \
    && chown -R user:user /home/user

COPY --chown=user backend/ /app/backend/

# Frontend
COPY --chown=user frontend/package.json frontend/package-lock.json /app/frontend/
USER user
WORKDIR /app/frontend
RUN npm ci
COPY --chown=user frontend/ /app/frontend/

# Same-origin API via nginx (/api → backend)
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

WORKDIR /app
COPY --chown=user deploy/ /app/deploy/
USER root
RUN chmod +x /app/deploy/start.sh \
    && chown -R user:user /app/deploy
USER user

ENV DATABASE_URL=sqlite:////data/app.db \
    UPLOAD_DIR=/data/uploads \
    PROCESSED_DIR=/data/processed_videos \
    MODELS_DIR=/app/models \
    CHROMA_PERSIST_DIR=/data/chroma_data \
    ENABLE_VECTOR_SEARCH=false \
    USE_DEEPSORT=false \
    FRAME_SAMPLE_RATE=5 \
    CORS_ORIGINS=* \
    SECRET_KEY=change-me \
    PORT=7860

EXPOSE 7860
CMD ["/app/deploy/start.sh"]
