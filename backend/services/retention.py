"""Retention policy enforcement — mark/delete expired footage."""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from database.models import (
    Annotation,
    CaseItem,
    Comment,
    Detection,
    EvidenceExport,
    ProcessingJob,
    RetentionPolicy,
    Track,
    ActivityEvent,
    Video,
)


def get_or_create_policy(db: Session) -> RetentionPolicy:
    pol = db.query(RetentionPolicy).first()
    if not pol:
        pol = RetentionPolicy(name="default", retention_days=90, auto_delete=True)
        db.add(pol)
        db.commit()
        db.refresh(pol)
    return pol


def apply_retention_on_upload(db: Session, video: Video, retention_days: int | None = None) -> None:
    pol = get_or_create_policy(db)
    days = retention_days if retention_days is not None else pol.retention_days
    video.retention_days = days
    video.delete_after = datetime.utcnow() + timedelta(days=days)
    db.add(video)
    db.commit()


def _unlink(path: str | None) -> None:
    if not path:
        return
    try:
        Path(path).unlink(missing_ok=True)
    except Exception:
        pass


def delete_video_cascade(db: Session, video: Video) -> None:
    """Remove a video and dependent forensic rows/files."""
    vid = video.id
    for row in db.query(EvidenceExport).filter(EvidenceExport.video_id == vid).all():
        _unlink(row.clip_path)
        _unlink(row.sidecar_path)
        db.delete(row)
    db.query(Annotation).filter(Annotation.video_id == vid).delete(synchronize_session=False)
    db.query(Comment).filter(Comment.video_id == vid).delete(synchronize_session=False)
    db.query(CaseItem).filter(CaseItem.video_id == vid).delete(synchronize_session=False)
    db.query(Detection).filter(Detection.video_id == vid).delete(synchronize_session=False)
    db.query(Track).filter(Track.video_id == vid).delete(synchronize_session=False)
    db.query(ActivityEvent).filter(ActivityEvent.video_id == vid).delete(synchronize_session=False)
    db.query(ProcessingJob).filter(ProcessingJob.video_id == vid).delete(synchronize_session=False)
    _unlink(video.filepath)
    db.delete(video)


def run_retention_cleanup(db: Session) -> dict:
    pol = get_or_create_policy(db)
    if not pol.auto_delete:
        return {"deleted": 0, "skipped": True}
    now = datetime.utcnow()
    expired = db.query(Video).filter(Video.delete_after != None, Video.delete_after < now).all()  # noqa: E711
    deleted = 0
    for v in expired:
        try:
            delete_video_cascade(db, v)
            deleted += 1
        except Exception:
            db.rollback()
            continue
    db.commit()
    return {"deleted": deleted, "policy_days": pol.retention_days}
