import logging
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    get_current_user_optional,
    hash_password,
    verify_password,
)
from config import settings
from database import get_db, init_db
from database.crud import (
    create_processing_job,
    create_user,
    create_video,
    get_activity_events,
    get_detections_for_video,
    get_detections_in_time_range,
    get_unique_track_counts,
    get_user_by_email,
    get_user_by_username,
    get_video,
    list_videos,
)
from database.models import Detection, Track, User, Video, VideoStatus
from schemas import (
    ActivityEventResponse,
    ClipRequest,
    ClipResponse,
    DetectionResponse,
    ProcessingJobResponse,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    StatsResponse,
    SummaryRequest,
    SummaryResponse,
    Token,
    TrackResponse,
    UserCreate,
    UserResponse,
    VideoResponse,
)
from search import NaturalLanguageSearch
from services import ClipGenerator, VideoProcessor
from services.video_processor import format_timestamp
from search.nl_search import time_str_to_seconds

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Security Camera Investigator",
    description="AI-powered surveillance video investigation platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

nl_search = NaturalLanguageSearch()
clip_generator = ClipGenerator()


def _vector_search():
    """Lazy accessor so Chroma is only opened when enabled."""
    if not settings.enable_vector_search:
        return None
    from search.vector_search import get_vector_search

    return get_vector_search()


@app.on_event("startup")
def startup():
    init_db()
    settings.ensure_dirs()
    from services.retention import get_or_create_policy
    from database.session import SessionLocal

    db = SessionLocal()
    try:
        get_or_create_policy(db)
    finally:
        db.close()


# Mount forensic / collaboration routes
from routers.forensic import router as forensic_router  # noqa: E402

app.include_router(forensic_router)


def _run_processing(video_id: int, job_id: int):
    from database.session import SessionLocal

    db = SessionLocal()
    try:
        video = get_video(db, video_id)
        if video:
            VideoProcessor().process(db, video, job_id)
    finally:
        db.close()


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, user_in.email):
        raise HTTPException(400, "Email already registered")
    if get_user_by_username(db, user_in.username):
        raise HTTPException(400, "Username already taken")
    user = create_user(db, user_in.email, user_in.username, hash_password(user_in.password))
    return user


@app.post("/api/auth/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = get_user_by_username(db, form.username)
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"sub": user.username})
    return Token(access_token=token)


@app.get("/api/auth/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user


# ── Videos ────────────────────────────────────────────────────────────────────

@app.post("/api/videos/upload", response_model=VideoResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    camera_code: Optional[str] = Form(None),
    retention_days: Optional[int] = Form(None),
    case_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    from database.models import Camera, CaseItem
    from services.audit import log_action
    from services.evidence_export import sha256_file
    from services.retention import apply_retention_on_upload

    if not file.filename:
        raise HTTPException(400, "No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".mp4", ".avi", ".mov", ".mkv", ".webm"):
        raise HTTPException(400, "Unsupported video format")

    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = Path(settings.upload_dir) / unique_name
    dest.parent.mkdir(parents=True, exist_ok=True)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    digest = sha256_file(dest)
    video = create_video(
        db,
        filename=unique_name,
        original_filename=file.filename,
        filepath=str(dest),
        owner_id=user.id if user else None,
    )
    video.file_sha256 = digest
    if camera_code:
        video.camera_code = camera_code
        cam = db.query(Camera).filter(Camera.camera_code == camera_code).first()
        if cam:
            video.camera_id = cam.id
    db.add(video)
    db.commit()
    db.refresh(video)
    apply_retention_on_upload(db, video, retention_days)
    if case_id:
        db.add(CaseItem(case_id=case_id, item_type="video", video_id=video.id))
        db.commit()

    job = create_processing_job(db, video.id)
    background_tasks.add_task(_run_processing, video.id, job.id)
    log_action(
        db,
        action="video.upload",
        user=user,
        resource_type="video",
        resource_id=video.id,
        details={"filename": file.filename, "sha256": digest, "camera_code": camera_code},
        ip_address=request.client.host if request.client else None,
    )
    return video


@app.get("/api/videos", response_model=list[VideoResponse])
def get_videos(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    owner_id = user.id if user else None
    return list_videos(db, owner_id=owner_id)


@app.get("/api/videos/{video_id}", response_model=VideoResponse)
def get_video_detail(video_id: int, db: Session = Depends(get_db)):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    return video


@app.get("/api/videos/{video_id}/stream")
def stream_video(video_id: int, db: Session = Depends(get_db)):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    return FileResponse(video.filepath, media_type="video/mp4")


@app.get("/api/videos/{video_id}/job", response_model=ProcessingJobResponse)
def get_processing_job(video_id: int, db: Session = Depends(get_db)):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    if not video.jobs:
        raise HTTPException(404, "No processing job found")
    return video.jobs[-1]


@app.post("/api/videos/{video_id}/reprocess", response_model=ProcessingJobResponse)
def reprocess_video(
    video_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    vs = _vector_search()
    if vs is not None:
        vs.delete_video_events(video_id)
    job = create_processing_job(db, video_id)
    background_tasks.add_task(_run_processing, video_id, job.id)
    return job


# ── Detections & Tracks ───────────────────────────────────────────────────────

@app.get("/api/videos/{video_id}/detections", response_model=list[DetectionResponse])
def list_detections(
    video_id: int,
    object_class: Optional[str] = None,
    start_seconds: Optional[float] = None,
    end_seconds: Optional[float] = None,
    color: Optional[str] = None,
    track_id: Optional[int] = None,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    dets = get_detections_for_video(
        db, video_id, object_class, start_seconds, end_seconds, color, track_id, limit
    )
    return [
        DetectionResponse(
            id=d.id,
            frame_number=d.frame_number,
            timestamp_seconds=d.timestamp_seconds,
            timestamp=format_timestamp(d.timestamp_seconds),
            object_class=d.object_class,
            confidence=d.confidence,
            track_id=d.track_id,
            dominant_color=d.dominant_color,
            bbox={"x1": d.bbox_x1, "y1": d.bbox_y1, "x2": d.bbox_x2, "y2": d.bbox_y2},
            is_false_positive=bool(d.is_false_positive),
        )
        for d in dets
    ]


@app.get("/api/videos/{video_id}/tracks", response_model=list[TrackResponse])
def list_tracks(video_id: int, db: Session = Depends(get_db)):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    tracks = db.query(Track).filter(Track.video_id == video_id).order_by(Track.first_seen_seconds).all()
    return [
        TrackResponse(
            id=t.id,
            track_id=t.track_id,
            object_class=t.object_class,
            first_seen_seconds=t.first_seen_seconds,
            last_seen_seconds=t.last_seen_seconds,
            first_seen=format_timestamp(t.first_seen_seconds),
            last_seen=format_timestamp(t.last_seen_seconds),
            frame_count=t.frame_count,
            dominant_color=t.dominant_color,
            is_unique_person=t.is_unique_person,
            global_identity=t.global_identity,
        )
        for t in tracks
    ]


@app.get("/api/videos/{video_id}/events", response_model=list[ActivityEventResponse])
def list_events(video_id: int, db: Session = Depends(get_db)):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    events = get_activity_events(db, video_id)
    return [
        ActivityEventResponse(
            id=e.id,
            activity_type=e.activity_type.value,
            description=e.description,
            start_seconds=e.start_seconds,
            end_seconds=e.end_seconds,
            start_time=format_timestamp(e.start_seconds),
            end_time=format_timestamp(e.end_seconds) if e.end_seconds else None,
            track_id=e.track_id,
            object_class=e.object_class,
            severity=e.severity,
        )
        for e in events
    ]


@app.get("/api/videos/{video_id}/stats", response_model=StatsResponse)
def video_stats(video_id: int, db: Session = Depends(get_db)):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    total = (
        db.query(func.count(Detection.id))
        .filter(Detection.video_id == video_id, Detection.is_false_positive.is_(False))
        .scalar()
        or 0
    )
    unique_tracks = get_unique_track_counts(db, video_id)
    unique_people = db.query(func.count(Track.id)).filter(
        Track.video_id == video_id, Track.object_class == "person"
    ).scalar() or 0
    activity_count = len(get_activity_events(db, video_id))

    peak_row = (
        db.query(Detection.timestamp_seconds, func.count(Detection.id).label("cnt"))
        .filter(Detection.video_id == video_id, Detection.is_false_positive.is_(False))
        .group_by(Detection.frame_number, Detection.timestamp_seconds)
        .order_by(func.count(Detection.id).desc())
        .first()
    )
    peak_ts = format_timestamp(peak_row[0]) if peak_row else None

    return StatsResponse(
        video_id=video_id,
        total_detections=total,
        unique_tracks=unique_tracks,
        unique_people=unique_people,
        activity_count=activity_count,
        peak_activity_timestamp=peak_ts,
    )


# ── Search ────────────────────────────────────────────────────────────────────

@app.post("/api/search", response_model=SearchResponse)
def search(req: SearchRequest, db: Session = Depends(get_db)):
    filters = nl_search.parse_query(req.query)
    results: list[SearchResultItem] = []
    unique_count = None

    start_sec = None
    end_sec = None
    if filters.get("start_time"):
        start_sec = time_str_to_seconds(filters["start_time"])
    if filters.get("end_time"):
        end_sec = time_str_to_seconds(filters["end_time"])

    if req.video_id and filters.get("activity_type"):
        events = get_activity_events(db, req.video_id, filters["activity_type"])
        for e in events:
            if start_sec and e.start_seconds < start_sec:
                continue
            if end_sec and e.start_seconds > end_sec:
                continue
            results.append(SearchResultItem(
                timestamp_seconds=e.start_seconds,
                timestamp=format_timestamp(e.start_seconds),
                description=e.description,
                activity_type=e.activity_type.value,
                track_id=e.track_id,
                object_class=e.object_class,
                source="activity",
            ))

    if req.video_id:
        dets = get_detections_for_video(
            db,
            req.video_id,
            object_class=filters.get("object_class"),
            start_seconds=start_sec,
            end_seconds=end_sec,
            color=filters.get("color"),
            track_id=filters.get("track_id"),
            limit=200,
        )
        for d in dets:
            desc = f"{d.object_class}"
            if d.track_id:
                desc += f" #{d.track_id}"
            if d.dominant_color:
                desc += f" ({d.dominant_color})"
            desc += f" at {format_timestamp(d.timestamp_seconds)}"

            results.append(SearchResultItem(
                timestamp_seconds=d.timestamp_seconds,
                timestamp=format_timestamp(d.timestamp_seconds),
                object_class=d.object_class,
                track_id=d.track_id,
                color=d.dominant_color,
                description=desc,
                confidence=d.confidence,
                source="detection",
            ))

        if filters.get("count_unique"):
            q = db.query(Track).filter(Track.video_id == req.video_id)
            if filters.get("object_class"):
                q = q.filter(Track.object_class == filters["object_class"])
            if start_sec is not None:
                q = q.filter(Track.last_seen_seconds >= start_sec)
            if end_sec is not None:
                q = q.filter(Track.first_seen_seconds <= end_sec)
            unique_count = q.count()

    semantic_q = filters.get("semantic_query", req.query)
    vs = _vector_search()
    vector_hits = vs.search(semantic_q, video_id=req.video_id, n_results=15) if vs else []
    for hit in vector_hits:
        meta = hit.get("metadata", {})
        ts = float(meta.get("timestamp_seconds", 0))
        if start_sec and ts < start_sec:
            continue
        if end_sec and ts > end_sec:
            continue
        if hit["text"] in [r.description for r in results]:
            continue
        results.append(SearchResultItem(
            timestamp_seconds=ts,
            timestamp=format_timestamp(ts),
            object_class=meta.get("object_class"),
            track_id=int(meta["track_id"]) if meta.get("track_id") else None,
            color=meta.get("color"),
            description=hit["text"],
            activity_type=meta.get("activity_type"),
            source="vector",
        ))

    results.sort(key=lambda r: r.timestamp_seconds)

    summary = None
    if req.video_id and results:
        video = get_video(db, req.video_id)
        stats = get_unique_track_counts(db, req.video_id)
        if unique_count is not None:
            stats["unique_matches"] = unique_count
        summary = nl_search.generate_summary(
            video.original_filename if video else "video",
            stats,
            [{"description": r.description, "timestamp": r.timestamp} for r in results[:20]],
        )

    return SearchResponse(
        query=req.query,
        parsed_filters=filters,
        results=results,
        unique_count=unique_count,
        summary=summary,
    )


# ── Summary ───────────────────────────────────────────────────────────────────

@app.post("/api/summary", response_model=SummaryResponse)
def generate_summary(req: SummaryRequest, db: Session = Depends(get_db)):
    video = get_video(db, req.video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    start_sec = time_str_to_seconds(req.start_time) if req.start_time else 0
    end_sec = time_str_to_seconds(req.end_time) if req.end_time else (video.duration_seconds or 99999)

    dets = get_detections_in_time_range(db, req.video_id, start_sec, end_sec)
    events = get_activity_events(db, req.video_id)

    obj_counts: dict[str, int] = {}
    track_ids: set[int] = set()
    for d in dets:
        obj_counts[d.object_class] = obj_counts.get(d.object_class, 0) + 1
        if d.track_id:
            track_ids.add(d.track_id)

    unique_people = db.query(Track).filter(
        Track.video_id == req.video_id,
        Track.object_class == "person",
        Track.first_seen_seconds <= end_sec,
        Track.last_seen_seconds >= start_sec,
    ).count()

    vehicles = db.query(Track).filter(
        Track.video_id == req.video_id,
        Track.object_class.in_(["car", "truck", "motorcycle", "bus"]),
        Track.first_seen_seconds <= end_sec,
        Track.last_seen_seconds >= start_sec,
    ).count()

    peak_row = (
        db.query(Detection.timestamp_seconds, func.count(Detection.id).label("cnt"))
        .filter(
            Detection.video_id == req.video_id,
            Detection.timestamp_seconds >= start_sec,
            Detection.timestamp_seconds <= end_sec,
        )
        .group_by(Detection.frame_number, Detection.timestamp_seconds)
        .order_by(func.count(Detection.id).desc())
        .first()
    )

    stats = {
        "unique_people": unique_people,
        "vehicles_detected": vehicles,
        "total_detections": len(dets),
        "object_counts": obj_counts,
        "peak_activity": format_timestamp(peak_row[0]) if peak_row else None,
    }

    filtered_events = [
        {
            "time": format_timestamp(e.start_seconds),
            "description": e.description,
            "type": e.activity_type.value,
        }
        for e in events
        if start_sec <= e.start_seconds <= end_sec
    ]

    time_range = f"{format_timestamp(start_sec)} - {format_timestamp(end_sec)}"
    summary_text = nl_search.generate_summary(
        video.original_filename, stats, filtered_events, time_range
    )

    return SummaryResponse(
        video_id=req.video_id,
        time_range=time_range,
        stats=stats,
        events=filtered_events,
        summary=summary_text,
    )


# ── Clips ─────────────────────────────────────────────────────────────────────

@app.post("/api/clips/generate", response_model=ClipResponse)
def generate_clip(req: ClipRequest, db: Session = Depends(get_db)):
    video = get_video(db, req.video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    if video.status != VideoStatus.COMPLETED:
        raise HTTPException(400, "Video processing not complete")

    filename = ClipGenerator.format_clip_name(req.video_id, req.start_seconds, req.end_seconds)
    output = clip_generator.generate_clip(
        video.filepath, req.start_seconds, req.end_seconds, filename
    )

    return ClipResponse(
        clip_url=f"/api/clips/{filename}",
        filename=filename,
        start_seconds=req.start_seconds,
        end_seconds=req.end_seconds,
    )


@app.get("/api/clips/{filename}")
def serve_clip(filename: str):
    path = Path(settings.processed_dir) / filename
    if not path.exists():
        raise HTTPException(404, "Clip not found")
    return FileResponse(str(path), media_type="video/mp4")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ai-security-investigator"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
