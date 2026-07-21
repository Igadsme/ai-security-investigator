#!/usr/bin/env bash
set -euo pipefail

mkdir -p /data/uploads /data/processed_videos /data/models /data/chroma_data /var/log/nginx

export DATABASE_URL="${DATABASE_URL:-sqlite:////data/app.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
export PROCESSED_DIR="${PROCESSED_DIR:-/data/processed_videos}"
export MODELS_DIR="${MODELS_DIR:-/data/models}"
export CHROMA_PERSIST_DIR="${CHROMA_PERSIST_DIR:-/data/chroma_data}"
export ENABLE_VECTOR_SEARCH="${ENABLE_VECTOR_SEARCH:-false}"
export USE_DEEPSORT="${USE_DEEPSORT:-false}"
export FRAME_SAMPLE_RATE="${FRAME_SAMPLE_RATE:-5}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"
export SECRET_KEY="${SECRET_KEY:-hf-spaces-dev-secret-change-me}"

echo "[spaces] starting API on :8000"
cd /app/backend
uvicorn app:app --host 127.0.0.1 --port 8000 --workers 1 &
API_PID=$!

echo "[spaces] starting UI on :3000"
cd /app/frontend
npx next start -H 127.0.0.1 -p 3000 &
WEB_PID=$!

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for API health before nginx
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8000/docs >/dev/null; then
    break
  fi
  sleep 1
done

echo "[spaces] starting nginx on :7860"
nginx -c /app/deploy/nginx.spaces.conf -g 'daemon off;'
