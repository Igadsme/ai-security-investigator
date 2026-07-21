"""Cross-video re-identification suggestions from track appearance + class + color."""
from __future__ import annotations

from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from database.models import Detection, ReIDMatch, Track, Video


COLOR_MAP = {
    "white": 0, "silver": 1, "gray": 2, "black": 3,
    "red": 4, "blue": 5, "green": 6, "yellow": 7,
    "orange": 8, "brown": 9, "unknown": 10,
}


def _color_idx(c: Optional[str]) -> int:
    return COLOR_MAP.get((c or "unknown").lower(), 10)


def appearance_from_detections(dets: list[Detection]) -> list[float]:
    """Compact appearance vector: class one-hot-ish + color hist + size stats."""
    if not dets:
        return [0.0] * 16
    colors = np.zeros(11, dtype=float)
    areas = []
    aspects = []
    for d in dets[:80]:
        colors[_color_idx(d.dominant_color)] += 1
        w = max(1.0, d.bbox_x2 - d.bbox_x1)
        h = max(1.0, d.bbox_y2 - d.bbox_y1)
        areas.append(w * h)
        aspects.append(w / h)
    colors = colors / (colors.sum() + 1e-6)
    area_m = float(np.mean(areas)) if areas else 0.0
    aspect_m = float(np.mean(aspects)) if aspects else 1.0
    conf_m = float(np.mean([d.confidence for d in dets[:80]]))
    return list(colors) + [area_m / 1e5, aspect_m, conf_m, float(len(dets))]


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a, dtype=float), np.array(b, dtype=float)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na < 1e-9 or nb < 1e-9:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def ensure_track_appearance(db: Session, track: Track) -> list[float]:
    if track.appearance_vector:
        return track.appearance_vector
    dets = (
        db.query(Detection)
        .filter(
            Detection.video_id == track.video_id,
            Detection.track_id == track.track_id,
            Detection.is_false_positive.is_(False),
        )
        .order_by(Detection.timestamp_seconds)
        .limit(100)
        .all()
    )
    vec = appearance_from_detections(dets)
    track.appearance_vector = vec
    db.add(track)
    db.commit()
    return vec


def suggest_matches(
    db: Session,
    track: Track,
    *,
    case_video_ids: Optional[list[int]] = None,
    min_score: float = 0.72,
    limit: int = 20,
) -> list[dict]:
    vec = ensure_track_appearance(db, track)
    q = db.query(Track).filter(Track.id != track.id, Track.object_class == track.object_class)
    if case_video_ids:
        q = q.filter(Track.video_id.in_(case_video_ids))
    else:
        q = q.filter(Track.video_id != track.video_id)

    candidates = q.limit(500).all()
    scored = []
    for other in candidates:
        ovec = ensure_track_appearance(db, other)
        score = cosine(vec, ovec)
        # Color bonus
        if track.dominant_color and other.dominant_color and track.dominant_color == other.dominant_color:
            score = min(1.0, score + 0.08)
        if score >= min_score:
            scored.append((score, other))

    scored.sort(key=lambda x: -x[0])
    results = []
    for score, other in scored[:limit]:
        # Persist suggestion
        a_id, b_id = sorted([track.id, other.id])
        existing = (
            db.query(ReIDMatch)
            .filter(ReIDMatch.track_a_id == a_id, ReIDMatch.track_b_id == b_id)
            .first()
        )
        if not existing:
            existing = ReIDMatch(
                track_a_id=a_id,
                track_b_id=b_id,
                score=score,
                reason={
                    "object_class": track.object_class,
                    "color_a": track.dominant_color,
                    "color_b": other.dominant_color,
                },
            )
            db.add(existing)
            db.flush()
        else:
            existing.score = max(existing.score, score)
        video = db.query(Video).filter(Video.id == other.video_id).first()
        results.append({
            "match_id": existing.id,
            "score": round(score, 4),
            "track": {
                "db_id": other.id,
                "video_id": other.video_id,
                "track_id": other.track_id,
                "object_class": other.object_class,
                "dominant_color": other.dominant_color,
                "first_seen_seconds": other.first_seen_seconds,
                "last_seen_seconds": other.last_seen_seconds,
                "camera_code": video.camera_code if video else None,
                "original_filename": video.original_filename if video else None,
            },
            "reason": existing.reason,
        })
    db.commit()
    return results


def assign_global_identity(db: Session, track_ids: list[int], identity: Optional[str] = None) -> str:
    import uuid
    identity = identity or f"gid_{uuid.uuid4().hex[:10]}"
    tracks = db.query(Track).filter(Track.id.in_(track_ids)).all()
    for t in tracks:
        t.global_identity = identity
        db.add(t)
    # Mark pairwise ReID matches as confirmed
    ids = sorted({t.id for t in tracks})
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a_id, b_id = ids[i], ids[j]
            row = (
                db.query(ReIDMatch)
                .filter(ReIDMatch.track_a_id == a_id, ReIDMatch.track_b_id == b_id)
                .first()
            )
            if not row:
                row = ReIDMatch(track_a_id=a_id, track_b_id=b_id, score=1.0, reason={"confirmed": True})
                db.add(row)
            row.confirmed = True
            db.add(row)
    db.commit()
    return identity
