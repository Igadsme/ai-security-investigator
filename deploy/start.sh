#!/usr/bin/env bash
set -euo pipefail

# Hugging Face Spaces: app_port 7860, container UID 1000.
# Render injects $PORT (usually 10000).
PORT="${PORT:-7860}"

export HOME="${HOME:-/home/user}"
export YOLO_CONFIG_DIR="${YOLO_CONFIG_DIR:-/tmp/Ultralytics}"
export TORCH_HOME="${TORCH_HOME:-/tmp/torch}"
export MPLCONFIGDIR="${MPLCONFIGDIR:-/tmp/matplotlib}"

mkdir -p /data/uploads /data/processed_videos /data/models /data/chroma_data \
  "$YOLO_CONFIG_DIR" "$TORCH_HOME" "$MPLCONFIGDIR"

export DATABASE_URL="${DATABASE_URL:-sqlite:////data/app.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
export PROCESSED_DIR="${PROCESSED_DIR:-/data/processed_videos}"
export MODELS_DIR="${MODELS_DIR:-/app/models}"
export CHROMA_PERSIST_DIR="${CHROMA_PERSIST_DIR:-/data/chroma_data}"
export ENABLE_VECTOR_SEARCH="${ENABLE_VECTOR_SEARCH:-false}"
export USE_DEEPSORT="${USE_DEEPSORT:-false}"
export FRAME_SAMPLE_RATE="${FRAME_SAMPLE_RATE:-5}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"
export SECRET_KEY="${SECRET_KEY:-change-me}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"
export GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"

# Prefer baked YOLO weights; copy onto a persistent MODELS_DIR if requested.
if [ ! -f "${MODELS_DIR}/yolov8n.pt" ] && [ -f /app/models/yolov8n.pt ]; then
  mkdir -p "$MODELS_DIR"
  cp /app/models/yolov8n.pt "${MODELS_DIR}/yolov8n.pt"
fi

echo "[asci] starting API on :8000"
cd /app/backend
uvicorn app:app --host 127.0.0.1 --port 8000 --workers 1 &
API_PID=$!

echo "[asci] starting UI on :3000"
cd /app/frontend
npx next start -H 127.0.0.1 -p 3000 &
WEB_PID=$!

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT

api_ok=0
for i in $(seq 1 90); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null; then
    api_ok=1
    break
  fi
  sleep 1
done
if [ "$api_ok" != "1" ]; then
  echo "[asci] API failed to become healthy"
  exit 1
fi

for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3000 >/dev/null; then
    break
  fi
  sleep 1
done

sed "s/LISTEN_PORT/${PORT}/g" /app/deploy/nginx.conf.template > /tmp/nginx.conf

echo "[asci] starting nginx on :${PORT} (uid=$(id -u))"
# Full path: Hugging Face runs as UID 1000 and /usr/sbin may not be on PATH.
/usr/sbin/nginx -c /tmp/nginx.conf -g 'daemon off;'
