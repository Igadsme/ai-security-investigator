# AI Security Camera Investigator

An AI-powered surveillance video investigation platform that combines computer vision, object tracking, vector search, and natural language querying.

Upload footage, ask questions like *"Show me every person who entered the room"* or *"When did the white car appear?"*, and get timestamps, clips, and AI-generated summaries.

## Features

- **Video Upload** — MP4, AVI, MOV, MKV support
- **YOLOv8 Detection** — Person, car, truck, dog, backpack, bicycle, motorcycle
- **DeepSORT Tracking** — Unique object IDs (Person #1, Person #2, etc.)
- **Natural Language Search** — Plain English queries with AI filter parsing
- **Vector Search** — ChromaDB semantic event indexing
- **AI Summaries** — OpenAI or Ollama powered activity reports
- **Event Timeline** — Entry, vehicle arrival, loitering, running, abandoned objects
- **Clip Generation** — Extract event clips on demand
- **Authentication** — JWT-based user accounts (optional)
- **Dashboard** — Stats, tracks, detections, peak activity

## Architecture

```
Video Upload → Frame Extraction → YOLO → DeepSORT → ChromaDB → NL Search → AI Summary
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

```bash
make setup          # Install backend + frontend deps
make sample-video   # Generate test footage
```

**1. Start PostgreSQL**

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=security_investigator -p 5432:5432 postgres:16-alpine
```

**2. Backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app:app --reload --port 8000
```

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
```

**4. Generate sample video (optional)**

```bash
python scripts/generate_sample_video.py
```

Upload `uploads/parking_lot_sample.mp4` via the UI.

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

Without OpenAI/Ollama, rule-based query parsing still works.

DeepSORT is available but disabled by default to reduce memory usage. Set `USE_DEEPSORT=true` for production-grade tracking on GPU-equipped machines.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/videos/upload` | Upload video |
| GET | `/api/videos/{id}/detections` | List detections |
| GET | `/api/videos/{id}/tracks` | List tracked objects |
| GET | `/api/videos/{id}/events` | Activity timeline |
| POST | `/api/search` | Natural language search |
| POST | `/api/summary` | Generate AI report |
| POST | `/api/clips/generate` | Create event clip |

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

## Testing

```bash
cd backend
pytest tests/ -v
```

## Resume Bullet

> Developed an AI-powered video investigation platform using YOLO, OpenCV, FastAPI, and vector search, enabling natural-language querying of surveillance footage and automated event detection across thousands of video frames.

## Privacy

Face recognition is not included. Use surveillance analysis only where legally permitted.

## License

MIT
