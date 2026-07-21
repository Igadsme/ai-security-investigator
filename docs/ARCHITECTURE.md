# Architecture

## Pipeline

```
Video Upload → Frame Extraction → YOLO Detection → DeepSORT Tracking
    → Feature Extraction → ChromaDB Indexing → NL Search → AI Summary
```

## Components

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Detection | YOLOv8 (Ultralytics) | Person, car, truck, dog, backpack, etc. |
| Tracking | DeepSORT | Unique object IDs across frames |
| Vector DB | ChromaDB | Semantic search over events |
| Metadata DB | PostgreSQL | Videos, detections, tracks, events |
| NL Layer | OpenAI / Ollama / Rules | Query parsing and summaries |
| API | FastAPI | REST endpoints |
| Frontend | Next.js + Tailwind | Upload, search, timeline, clips |

## Suspicious Activity Detection

- **Loitering**: Person stationary > 2 minutes
- **Running**: High pixel velocity between frames
- **Abandoned objects**: Backpack/suitcase stationary > 60s
- **Entry/Exit**: Track first appearance events

## Privacy Note

Face recognition is not enabled by default. Enable only with proper legal authorization.
