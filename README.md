---
title: AI Security Camera Investigator
emoji: 📹
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# AI Security Camera Investigator

An AI-powered surveillance video investigation platform that combines computer vision, object tracking, vector search, and natural language querying.

Upload footage, ask questions like *"Show me every person who entered the room"* or *"When did the white car appear?"*, and get timestamps, clips, and AI-generated summaries.

## Features

- **Video Upload / Batch upload** — MP4, AVI, MOV, MKV; multi-file incident ingest with camera codes
- **YOLOv8 Detection** — Person, car, truck, dog, backpack, bicycle, motorcycle
- **DeepSORT Tracking** — Unique object IDs (Person #1, Person #2, etc.)
- **Natural Language + Faceted Search** — NL box plus class/color/camera/confidence/time filters
- **Similarity search** — “Find like this” across videos (cross-camera re-ID suggestions)
- **Cases & multi-cam timeline** — Group footage under an incident; synced lanes across cameras
- **Chain-of-custody audit log** — Timestamped actions with user attribution
- **Evidence export** — Clip + JSON sidecar (timestamps, camera, SHA-256, detections)
- **Redaction / blur** — Privacy blur for people/vehicles before external share
- **Annotations, comments, roles** — Investigator notes, @mentions, viewer/investigator/admin
- **Saved searches / standing alerts** — Proactive watches on future matches
- **Site map** — Geo/floor-plan camera placement with detection density
- **Retention policy** — Configurable auto-delete windows (30/90 days)
- **Live RTSP registration** — Store stream URLs and grab snapshots for analysis
- **False-positive flagging & confidence thresholds** — Correct the record; tune search confidence
- **One-click case report** — Markdown/HTML handoff package
- **Vector Search** — Optional ChromaDB semantic indexing
- **AI Summaries** — OpenAI or Ollama powered activity reports
- **Clip Generation** — Extract event clips on demand
- **Authentication** — JWT + role-based access

## Architecture

```
Video Upload → Frame Extraction → YOLO → DeepSORT → (optional Chroma) → NL/Faceted Search
                                                      ↓
                         Cases · Audit · Evidence · Re-ID · Alerts · Reports
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CV / ML | Python, OpenCV, YOLOv8, DeepSORT |
| Backend | FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| Vector DB | ChromaDB |
| AI | OpenAI API / Ollama (optional) |
| Frontend | Next.js 14, Tailwind CSS |

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Local Development

> **Note:** Use Python 3.11 or 3.12. Python 3.14 is not yet supported by all dependencies.
> Local/dev defaults to **SQLite** (no Postgres required). Set `DATABASE_URL` to Postgres when you want it.

```bash
make setup          # Install backend + frontend deps
make sample-video   # Generate test footage
```

**1. Backend**

```bash
cd backend
source venv/bin/activate   # created by make setup
cp .env.example .env       # already SQLite by default
uvicorn app:app --reload --port 8000
```

**2. Frontend** (new terminal)

```bash
cd frontend
npm run dev
```

**3. Generate sample video (optional)**

```bash
make sample-video
```

Upload `uploads/parking_lot_sample.mp4` via the UI at http://localhost:3000.

**Optional PostgreSQL**

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=security_investigator -p 5432:5432 postgres:16-alpine
# then set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/security_investigator in backend/.env
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | Enables GPT-powered search parsing & summaries |
| `USE_OLLAMA` | Set `true` to use local Ollama instead |
| `FRAME_SAMPLE_RATE` | Process every Nth frame (default: 2) |
| `CONFIDENCE_THRESHOLD` | YOLO detection threshold (default: 0.4) |
| `USE_DEEPSORT` | Enable DeepSORT tracking (default: false, uses lightweight tracker) |
| `ENABLE_VECTOR_SEARCH` | Enable ChromaDB semantic indexing (default: false; SQL NL search always works) |

Without OpenAI/Ollama, rule-based query parsing still works.

DeepSORT is available but disabled by default to reduce memory usage. Set `USE_DEEPSORT=true` for production-grade tracking on GPU-equipped machines.

ChromaDB vector search is optional (`ENABLE_VECTOR_SEARCH=true`). Leave it off for faster local processing; natural-language filters still query detections/tracks/events in SQL.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/videos/upload` | Upload video (optional camera_code, retention_days, case_id) |
| POST | `/api/videos/batch-upload` | Multi-file incident ingest |
| GET | `/api/videos/{id}/detections` | List detections |
| GET | `/api/videos/{id}/tracks` | List tracked objects |
| GET | `/api/videos/{id}/events` | Activity timeline |
| POST | `/api/search` | Natural language search |
| POST | `/api/search/faceted` | Faceted search + explainable match reasons |
| POST | `/api/summary` | Generate AI report |
| POST | `/api/clips/generate` | Create event clip |
| GET | `/api/audit` | Chain-of-custody audit log |
| POST/GET | `/api/cases` | Case folders |
| GET | `/api/cases/{id}/timeline` | Multi-camera synced timeline |
| POST | `/api/cases/{id}/report` | One-click investigation report |
| POST | `/api/evidence/export` | Evidence clip + sidecar (SHA-256) |
| POST | `/api/videos/{id}/redact` | Privacy blur export |
| GET | `/api/tracks/{id}/similar` | Cross-video re-ID suggestions |
| POST | `/api/annotations` | Investigator notes on tracks/times |
| POST | `/api/comments` | Collaboration comments / mentions |
| POST/GET | `/api/saved-searches` | Saved searches & standing alerts |
| POST | `/api/alerts/evaluate` | Evaluate standing alerts |
| GET/PUT | `/api/retention` | Retention policy |
| POST | `/api/detections/{id}/false-positive` | Flag false positive |
| GET | `/api/sites/{id}/map` | Site / camera map view |

## Example Queries

```
Show me every person who entered the room.
When did the white car appear?
Find all instances of someone carrying a backpack.
How many unique people were detected between 8 PM and 10 PM?
Detect loitering activity
```

## Project Structure

```
ai-security-investigator/
├── backend/
│   ├── app.py
│   ├── detection/      # YOLO
│   ├── tracking/       # DeepSORT
│   ├── search/         # ChromaDB + NL parsing
│   ├── database/       # PostgreSQL models
│   └── services/       # Processing pipeline
├── frontend/
│   ├── pages/
│   ├── components/
│   └── services/
├── uploads/
├── processed_videos/
├── models/
└── docs/
```

## Deploy on Hugging Face Spaces

This repo is Docker-Space ready (`sdk: docker`, port **7860**).

1. Create a Space → **Docker** SDK → link this GitHub repo  
2. Spaces builds the root `Dockerfile` (API + UI behind nginx)  
3. Set secrets in Space **Settings → Variables**:
   - `SECRET_KEY` — required in production  
   - `OPENAI_API_KEY` — optional  
   - `ENABLE_VECTOR_SEARCH=false` (default)  
4. Open `https://<user>-<space>.hf.space` → Register → upload a short MP4  

Notes:
- Uses **SQLite** on `/data` (no Postgres required)  
- UI and API share one origin (`/api` proxied)  
- Free CPU may OOM on long videos — use short clips or upgrade hardware  
- First build downloads YOLO weights and can take a long time  

Local Space-like run (optional):

```bash
docker build -t asci-spaces .
docker run --rm -p 7860:7860 -e SECRET_KEY=dev asci-spaces
```

## Testing

```bash
cd backend
pytest tests/ -v
# Full forensic smoke:
PYTHONPATH=. ./venv/bin/python scripts/smoke_forensic.py
```

## Resume Bullet

> Developed an AI-powered video investigation platform using YOLO, OpenCV, FastAPI, and vector search, enabling natural-language querying of surveillance footage and automated event detection across thousands of video frames.

## Privacy

Face recognition is not included. Use surveillance analysis only where legally permitted.

