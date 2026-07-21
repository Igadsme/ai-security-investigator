import logging
from datetime import datetime

import cv2
from sqlalchemy.orm import Session

from config import settings
from database.crud import (
    bulk_create_activity_events,
    bulk_create_detections,
    bulk_create_tracks,
    update_processing_job,
    update_video_metadata,
    update_video_status,
)
from database.models import Detection, Track, Video, VideoStatus
from detection import YOLODetector
from search.vector_search import get_vector_search
from tracking.deepsort_tracker import DeepSortTracker
from tracking.simple_tracker import SimpleTracker
from .activity_detector import ActivityDetector
from .clip_generator import ClipGenerator

logger = logging.getLogger(__name__)


def format_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


class VideoProcessor:
    def __init__(self):
        self.detector = YOLODetector()
        self.vector_search = get_vector_search() if settings.enable_vector_search else None

    def _index_events(self, video_id: int, tracks: list[dict], activities: list[dict]) -> None:
        """Index track summaries and activity events (not every frame) for search."""
        if self.vector_search is None:
            return
        import gc

        ids, texts, metas = [], [], []

        for t in tracks:
            color = t.get("dominant_color") or "unknown"
            text = (
                f"{t['object_class']} #{t['track_id']} tracked from "
                f"{format_timestamp(t['first_seen_seconds'])} to "
                f"{format_timestamp(t['last_seen_seconds'])} color={color}"
            )
            ids.append(f"v{video_id}_track_{t['track_id']}")
            texts.append(text)
            metas.append({
                "video_id": str(video_id),
                "timestamp_seconds": t["first_seen_seconds"],
                "object_class": t["object_class"],
                "track_id": t["track_id"],
                "color": color,
            })

        for i, evt in enumerate(activities):
            ids.append(f"v{video_id}_act_{i}")
            texts.append(evt["description"])
            metas.append({
                "video_id": str(video_id),
                "timestamp_seconds": evt["start_seconds"],
                "activity_type": evt["type"].value if hasattr(evt["type"], "value") else str(evt["type"]),
                "track_id": evt.get("track_id"),
                "object_class": evt.get("object_class"),
            })

        try:
            for i in range(0, len(ids), 20):
                self.vector_search.index_batch(ids[i : i + 20], texts[i : i + 20], metas[i : i + 20])
                gc.collect()
        except Exception:
            logger.exception("Vector indexing failed for video %s; SQL results still saved", video_id)

    def process(self, db: Session, video: Video, job_id: int) -> None:
        from database.models import ProcessingJob
        from database.crud import get_video

        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            return

        try:
            update_video_status(db, video, VideoStatus.PROCESSING)
            update_processing_job(db, job, "running", 0.0, "extracting_metadata")

            info = YOLODetector.get_video_info(video.filepath)
            update_video_metadata(
                db, video,
                info["duration_seconds"], info["fps"],
                info["width"], info["height"], info["frame_count"],
            )
            video = get_video(db, video.id)

            update_processing_job(db, job, "running", 10.0, "detecting_objects")

            cap = cv2.VideoCapture(video.filepath)
            fps = info["fps"]
            sample_rate = settings.frame_sample_rate
            tracker = DeepSortTracker() if settings.use_deepsort else SimpleTracker()
            activity = ActivityDetector(info["width"], info["height"])

            all_detections: list[Detection] = []
            all_activity_raw: list[dict] = []

            frame_idx = 0
            processed_frames = 0
            total_to_process = max(1, info["frame_count"] // sample_rate)

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % sample_rate != 0:
                    frame_idx += 1
                    continue

                timestamp = frame_idx / fps
                raw_dets = self.detector.detect_frame(frame)
                activity.begin_frame()
                tracked = tracker.update(raw_dets, frame)

                for det in tracked:
                    x1, y1, x2, y2 = det["bbox"]
                    tid = det.get("track_id")

                    all_detections.append(Detection(
                        video_id=video.id,
                        frame_number=frame_idx,
                        timestamp_seconds=timestamp,
                        object_class=det["object_class"],
                        confidence=det["confidence"],
                        bbox_x1=x1, bbox_y1=y1, bbox_x2=x2, bbox_y2=y2,
                        track_id=tid,
                        dominant_color=det.get("dominant_color"),
                    ))

                    if tid is not None:
                        tracker.record_timestamp(tid, timestamp)
                        activity.update(tid, det["object_class"], timestamp, det["bbox"])

                all_activity_raw.extend(activity.flush_pending())

                processed_frames += 1
                if processed_frames % 10 == 0:
                    progress = 10 + (processed_frames / total_to_process) * 70
                    update_processing_job(db, job, "running", min(progress, 80), "detecting_objects")

                frame_idx += 1

            cap.release()

            update_processing_job(db, job, "running", 82.0, "tracking_objects")
            track_summaries = tracker.get_track_summaries()
            entry_exit_events = activity.detect_entries_exits(track_summaries)
            all_activity_raw.extend(entry_exit_events)

            tracks = [
                Track(
                    video_id=video.id,
                    track_id=t["track_id"],
                    object_class=t["object_class"],
                    first_seen_seconds=t["first_seen_seconds"],
                    last_seen_seconds=t["last_seen_seconds"],
                    frame_count=t["frame_count"],
                    dominant_color=t.get("dominant_color"),
                    is_unique_person=t.get("is_unique_person", False),
                )
                for t in track_summaries
            ]

            update_processing_job(db, job, "running", 88.0, "indexing_search")
            if settings.enable_vector_search:
                self._index_events(video.id, track_summaries, all_activity_raw)
            else:
                logger.info("Skipping vector indexing (ENABLE_VECTOR_SEARCH=false)")

            update_processing_job(db, job, "running", 95.0, "saving_results")
            bulk_create_detections(db, all_detections)
            bulk_create_tracks(db, tracks)
            activity_events = activity.build_activity_events(video.id, all_activity_raw)
            bulk_create_activity_events(db, activity_events)

            update_processing_job(db, job, "completed", 100.0, "done")
            update_video_status(db, video, VideoStatus.COMPLETED)
            logger.info("Processed video %s: %d detections, %d tracks", video.id, len(all_detections), len(tracks))

        except Exception as e:
            logger.exception("Failed to process video %s", video.id)
            update_processing_job(db, job, "failed", job.progress, "error", str(e))
            update_video_status(db, video, VideoStatus.FAILED, str(e))
            raise
