"""Evidence export with tamper-evident hash + JSON sidecar metadata."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from config import settings
from database.models import Detection, EvidenceExport, Track, Video
from services.clip_generator import ClipGenerator


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class EvidenceExporter:
    def __init__(self):
        self.clipper = ClipGenerator()
        self.out_dir = Path(settings.processed_dir) / "evidence"
        self.out_dir.mkdir(parents=True, exist_ok=True)

    def export_clip(
        self,
        db: Session,
        video: Video,
        start_seconds: float,
        end_seconds: float,
        *,
        case_id: Optional[int] = None,
        exported_by: Optional[int] = None,
        include_detections: bool = True,
    ) -> EvidenceExport:
        stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        base = f"evidence_v{video.id}_{stamp}_{int(start_seconds)}_{int(end_seconds)}"
        clip_name = f"{base}.mp4"
        clip_path = self.clipper.generate_clip(
            video.filepath, start_seconds, end_seconds, clip_name, padding=0.0
        )
        clip_file = Path(clip_path)
        digest = sha256_file(clip_file)

        detections = []
        if include_detections:
            rows = (
                db.query(Detection)
                .filter(
                    Detection.video_id == video.id,
                    Detection.timestamp_seconds >= start_seconds,
                    Detection.timestamp_seconds <= end_seconds,
                    Detection.is_false_positive.is_(False),
                )
                .order_by(Detection.timestamp_seconds)
                .limit(2000)
                .all()
            )
            detections = [
                {
                    "id": d.id,
                    "timestamp_seconds": d.timestamp_seconds,
                    "object_class": d.object_class,
                    "confidence": d.confidence,
                    "track_id": d.track_id,
                    "dominant_color": d.dominant_color,
                    "bbox": [d.bbox_x1, d.bbox_y1, d.bbox_x2, d.bbox_y2],
                }
                for d in rows
            ]

        tracks = (
            db.query(Track)
            .filter(Track.video_id == video.id)
            .all()
        )
        track_meta = [
            {
                "track_id": t.track_id,
                "object_class": t.object_class,
                "first_seen_seconds": t.first_seen_seconds,
                "last_seen_seconds": t.last_seen_seconds,
                "dominant_color": t.dominant_color,
                "global_identity": t.global_identity,
            }
            for t in tracks
            if t.last_seen_seconds >= start_seconds and t.first_seen_seconds <= end_seconds
        ]

        sidecar = {
            "schema": "asci-evidence-v1",
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "source": {
                "video_id": video.id,
                "original_filename": video.original_filename,
                "camera_id": video.camera_id,
                "camera_code": video.camera_code,
                "recorded_at": video.recorded_at.isoformat() if video.recorded_at else None,
                "source_file_sha256": video.file_sha256,
                "duration_seconds": video.duration_seconds,
            },
            "clip": {
                "start_seconds": start_seconds,
                "end_seconds": end_seconds,
                "filename": clip_file.name,
                "sha256": digest,
            },
            "detections": detections,
            "tracks": track_meta,
            "case_id": case_id,
            "integrity": {
                "algorithm": "SHA-256",
                "clip_sha256": digest,
                "note": "Recompute SHA-256 of the MP4 to verify tamper-evidence.",
            },
        }

        sidecar_path = self.out_dir / f"{base}.json"
        sidecar_path.write_text(json.dumps(sidecar, indent=2), encoding="utf-8")

        # Move clip next to sidecar if clipper wrote elsewhere
        final_clip = self.out_dir / clip_file.name
        if clip_file.resolve() != final_clip.resolve():
            final_clip.write_bytes(clip_file.read_bytes())
            digest = sha256_file(final_clip)
            sidecar["clip"]["sha256"] = digest
            sidecar["integrity"]["clip_sha256"] = digest
            sidecar_path.write_text(json.dumps(sidecar, indent=2), encoding="utf-8")

        row = EvidenceExport(
            video_id=video.id,
            case_id=case_id,
            exported_by=exported_by,
            clip_path=str(final_clip),
            sidecar_path=str(sidecar_path),
            sha256=digest,
            start_seconds=start_seconds,
            end_seconds=end_seconds,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
