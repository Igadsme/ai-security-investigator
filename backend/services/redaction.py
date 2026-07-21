"""Privacy redaction — blur faces/plates (person/vehicle ROIs) in a time range."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

import cv2
import numpy as np
from sqlalchemy.orm import Session

from config import settings
from database.models import Detection, Video


def _blur_roi(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int, k: int = 51) -> None:
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return
    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return
    k = k if k % 2 == 1 else k + 1
    frame[y1:y2, x1:x2] = cv2.GaussianBlur(roi, (k, k), 0)


class RedactionService:
    def __init__(self):
        self.out_dir = Path(settings.processed_dir) / "redacted"
        self.out_dir.mkdir(parents=True, exist_ok=True)

    def redact_video(
        self,
        db: Session,
        video: Video,
        *,
        classes: Optional[Iterable[str]] = None,
        start_seconds: float = 0.0,
        end_seconds: Optional[float] = None,
        track_ids: Optional[Iterable[int]] = None,
        exclude_track_ids: Optional[Iterable[int]] = None,
    ) -> str:
        """Blur detections matching filters. Returns output filepath."""
        classes = set(c.lower() for c in (classes or ["person", "car", "truck", "bus", "motorcycle"]))
        track_filter = set(track_ids) if track_ids is not None else None
        exclude = set(exclude_track_ids or [])
        end = end_seconds if end_seconds is not None else (video.duration_seconds or 1e9)

        dets = (
            db.query(Detection)
            .filter(
                Detection.video_id == video.id,
                Detection.timestamp_seconds >= start_seconds,
                Detection.timestamp_seconds <= end,
                Detection.is_false_positive.is_(False),
            )
            .all()
        )
        by_frame: dict[int, list[Detection]] = {}
        for d in dets:
            if d.object_class.lower() not in classes:
                continue
            if track_filter is not None and d.track_id not in track_filter:
                continue
            if d.track_id in exclude:
                continue
            by_frame.setdefault(d.frame_number, []).append(d)

        cap = cv2.VideoCapture(video.filepath)
        fps = video.fps or cap.get(cv2.CAP_PROP_FPS) or 10
        w = int(video.width or cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
        h = int(video.height or cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
        out_path = self.out_dir / f"redacted_v{video.id}_{int(start_seconds)}_{int(end)}.mp4"
        writer = cv2.VideoWriter(
            str(out_path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            float(fps),
            (w, h),
        )

        frame_idx = 0
        start_frame = int(start_seconds * fps)
        end_frame = int(end * fps)
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx < start_frame:
                frame_idx += 1
                continue
            if frame_idx > end_frame:
                break
            for d in by_frame.get(frame_idx, []):
                _blur_roi(
                    frame,
                    int(d.bbox_x1),
                    int(d.bbox_y1),
                    int(d.bbox_x2),
                    int(d.bbox_y2),
                )
            writer.write(frame)
            frame_idx += 1

        cap.release()
        writer.release()
        return str(out_path)
