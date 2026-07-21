from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import (
    ActivityEvent,
    Detection,
    ProcessingJob,
    Track,
    User,
    Video,
    VideoStatus,
)


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, email: str, username: str, hashed_password: str) -> User:
    user = User(email=email, username=username, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_video(
    db: Session,
    filename: str,
    original_filename: str,
    filepath: str,
    owner_id: Optional[int] = None,
) -> Video:
    video = Video(
        filename=filename,
        original_filename=original_filename,
        filepath=filepath,
        owner_id=owner_id,
        status=VideoStatus.UPLOADED,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


def get_video(db: Session, video_id: int) -> Optional[Video]:
    return db.query(Video).filter(Video.id == video_id).first()


def list_videos(db: Session, owner_id: Optional[int] = None, limit: int = 50) -> list[Video]:
    q = db.query(Video).order_by(Video.created_at.desc())
    if owner_id:
        q = q.filter(Video.owner_id == owner_id)
    return q.limit(limit).all()


def update_video_status(
    db: Session,
    video: Video,
    status: VideoStatus,
    error_message: Optional[str] = None,
) -> Video:
    video.status = status
    if error_message:
        video.error_message = error_message
    if status == VideoStatus.COMPLETED:
        video.processed_at = datetime.utcnow()
    db.commit()
    db.refresh(video)
    return video


def update_video_metadata(
    db: Session,
    video: Video,
    duration: float,
    fps: float,
    width: int,
    height: int,
    frame_count: int,
) -> Video:
    video.duration_seconds = duration
    video.fps = fps
    video.width = width
    video.height = height
    video.frame_count = frame_count
    db.commit()
    db.refresh(video)
    return video


def bulk_create_detections(db: Session, detections: list[Detection]) -> None:
    db.bulk_save_objects(detections)
    db.commit()


def bulk_create_tracks(db: Session, tracks: list[Track]) -> None:
    db.bulk_save_objects(tracks)
    db.commit()


def bulk_create_activity_events(db: Session, events: list[ActivityEvent]) -> None:
    db.bulk_save_objects(events)
    db.commit()


def create_processing_job(db: Session, video_id: int) -> ProcessingJob:
    job = ProcessingJob(video_id=video_id, status="pending", stage="queued")
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def update_processing_job(
    db: Session,
    job: ProcessingJob,
    status: str,
    progress: float,
    stage: str,
    error_message: Optional[str] = None,
) -> ProcessingJob:
    job.status = status
    job.progress = progress
    job.stage = stage
    if status == "running" and not job.started_at:
        job.started_at = datetime.utcnow()
    if status in ("completed", "failed"):
        job.completed_at = datetime.utcnow()
    if error_message:
        job.error_message = error_message
    db.commit()
    db.refresh(job)
    return job


def get_detections_for_video(
    db: Session,
    video_id: int,
    object_class: Optional[str] = None,
    start_seconds: Optional[float] = None,
    end_seconds: Optional[float] = None,
    color: Optional[str] = None,
    track_id: Optional[int] = None,
    limit: int = 500,
) -> list[Detection]:
    q = db.query(Detection).filter(Detection.video_id == video_id)
    if object_class:
        q = q.filter(Detection.object_class == object_class)
    if start_seconds is not None:
        q = q.filter(Detection.timestamp_seconds >= start_seconds)
    if end_seconds is not None:
        q = q.filter(Detection.timestamp_seconds <= end_seconds)
    if color:
        q = q.filter(Detection.dominant_color == color)
    if track_id is not None:
        q = q.filter(Detection.track_id == track_id)
    return q.order_by(Detection.timestamp_seconds).limit(limit).all()


def get_unique_track_counts(db: Session, video_id: int) -> dict[str, int]:
    rows = (
        db.query(Track.object_class, func.count(Track.id))
        .filter(Track.video_id == video_id)
        .group_by(Track.object_class)
        .all()
    )
    return {obj_class: count for obj_class, count in rows}


def get_activity_events(
    db: Session,
    video_id: int,
    activity_type: Optional[str] = None,
) -> list[ActivityEvent]:
    q = db.query(ActivityEvent).filter(ActivityEvent.video_id == video_id)
    if activity_type:
        q = q.filter(ActivityEvent.activity_type == activity_type)
    return q.order_by(ActivityEvent.start_seconds).all()


def get_detections_in_time_range(
    db: Session,
    video_id: int,
    start_seconds: float,
    end_seconds: float,
) -> list[Detection]:
    return (
        db.query(Detection)
        .filter(
            Detection.video_id == video_id,
            Detection.timestamp_seconds >= start_seconds,
            Detection.timestamp_seconds <= end_seconds,
        )
        .order_by(Detection.timestamp_seconds)
        .all()
    )
