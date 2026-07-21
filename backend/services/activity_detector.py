from collections import defaultdict
from typing import Optional

from database.models import ActivityEvent, ActivityType


LOITERING_THRESHOLD_SECONDS = 120  # 2 minutes in same area
ABANDONED_OBJECT_THRESHOLD_SECONDS = 60
RUNNING_SPEED_THRESHOLD = 80  # pixels per second (approximate)


class ActivityDetector:
    def __init__(self, frame_width: int, frame_height: int):
        self.frame_width = frame_width
        self.frame_height = frame_height
        self.track_positions: dict[int, list[tuple[float, float, float]]] = defaultdict(list)
        self.stationary_tracks: dict[int, dict] = {}
        self.object_stationary: dict[int, dict] = {}
        self._pending_events: list[dict] = []

    def update(
        self,
        track_id: int,
        object_class: str,
        timestamp: float,
        bbox: tuple[float, float, float, float],
    ) -> None:
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        self.track_positions[track_id].append((timestamp, cx, cy))

        if object_class == "person":
            self._detect_loitering(track_id, timestamp, cx, cy)
            self._detect_running(track_id, timestamp)
        elif object_class in ("backpack", "handbag", "suitcase"):
            self._detect_abandoned_object(track_id, object_class, timestamp, cx, cy)

    def _detect_loitering(self, track_id: int, timestamp: float, cx: float, cy: float) -> None:
        key = track_id
        if key not in self.stationary_tracks:
            self.stationary_tracks[key] = {
                "start": timestamp,
                "cx": cx,
                "cy": cy,
                "reported": False,
            }
            return

        info = self.stationary_tracks[key]
        dist = ((cx - info["cx"]) ** 2 + (cy - info["cy"]) ** 2) ** 0.5
        threshold = min(self.frame_width, self.frame_height) * 0.05

        if dist > threshold:
            info["start"] = timestamp
            info["cx"] = cx
            info["cy"] = cy
            info["reported"] = False
            return

        duration = timestamp - info["start"]
        if duration >= LOITERING_THRESHOLD_SECONDS and not info["reported"]:
            minutes = int(duration // 60)
            self._pending_events.append({
                "type": ActivityType.LOITERING,
                "description": f"Person #{track_id} remained near entrance for {minutes} minutes.",
                "start_seconds": info["start"],
                "end_seconds": timestamp,
                "track_id": track_id,
                "object_class": "person",
                "severity": "warning",
            })
            info["reported"] = True

    def _detect_running(self, track_id: int, timestamp: float) -> None:
        positions = self.track_positions[track_id]
        if len(positions) < 2:
            return

        t1, x1, y1 = positions[-2]
        t2, x2, y2 = positions[-1]
        dt = t2 - t1
        if dt <= 0:
            return

        speed = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 / dt
        if speed > RUNNING_SPEED_THRESHOLD:
            recent = [e for e in self._pending_events if e.get("track_id") == track_id and e["type"] == ActivityType.RUNNING]
            if not recent or timestamp - recent[-1]["end_seconds"] > 5:
                self._pending_events.append({
                    "type": ActivityType.RUNNING,
                    "description": f"Person #{track_id} detected running at {_format_time(timestamp)}.",
                    "start_seconds": t1,
                    "end_seconds": t2,
                    "track_id": track_id,
                    "object_class": "person",
                    "severity": "warning",
                })

    def _detect_abandoned_object(
        self,
        track_id: int,
        object_class: str,
        timestamp: float,
        cx: float,
        cy: float,
    ) -> None:
        key = track_id
        if key not in self.object_stationary:
            self.object_stationary[key] = {
                "start": timestamp,
                "cx": cx,
                "cy": cy,
                "class": object_class,
                "abandoned_reported": False,
                "removed_reported": False,
                "last_seen": timestamp,
            }
            return

        info = self.object_stationary[key]
        dist = ((cx - info["cx"]) ** 2 + (cy - info["cy"]) ** 2) ** 0.5
        threshold = min(self.frame_width, self.frame_height) * 0.03

        if dist <= threshold:
            info["last_seen"] = timestamp
            duration = timestamp - info["start"]
            if duration >= ABANDONED_OBJECT_THRESHOLD_SECONDS and not info["abandoned_reported"]:
                self._pending_events.append({
                    "type": ActivityType.ABANDONED_OBJECT,
                    "description": f"{object_class.title()} left behind at {_format_time(info['start'])}.",
                    "start_seconds": info["start"],
                    "end_seconds": timestamp,
                    "track_id": track_id,
                    "object_class": object_class,
                    "severity": "alert",
                })
                info["abandoned_reported"] = True
        else:
            if info["abandoned_reported"] and not info["removed_reported"]:
                self._pending_events.append({
                    "type": ActivityType.ABANDONED_OBJECT,
                    "description": f"{object_class.title()} removed at {_format_time(timestamp)}.",
                    "start_seconds": info["last_seen"],
                    "end_seconds": timestamp,
                    "track_id": track_id,
                    "object_class": object_class,
                    "severity": "info",
                })
                info["removed_reported"] = True

    def begin_frame(self) -> None:
        self._pending_events: list[dict] = []

    def flush_pending(self) -> list[dict]:
        events = self._pending_events
        self._pending_events = []
        return events

    def detect_entries_exits(
        self,
        track_summaries: list[dict],
        entrance_zone: Optional[tuple[float, float, float, float]] = None,
    ) -> list[dict]:
        """Detect entry/exit based on track first/last appearance near frame edges."""
        events = []
        margin = 0.1

        for track in track_summaries:
            obj = track["object_class"]
            tid = track["track_id"]
            first = track["first_seen_seconds"]
            last = track["last_seen_seconds"]

            if obj == "person":
                events.append({
                    "type": ActivityType.ENTRY,
                    "description": f"Person #{tid} entered scene at {_format_time(first)}.",
                    "start_seconds": first,
                    "end_seconds": first,
                    "track_id": tid,
                    "object_class": obj,
                    "severity": "info",
                })
            elif obj in ("car", "truck", "motorcycle", "bicycle"):
                events.append({
                    "type": ActivityType.VEHICLE_ARRIVAL,
                    "description": f"{obj.title()} #{tid} appeared at {_format_time(first)}.",
                    "start_seconds": first,
                    "end_seconds": first,
                    "track_id": tid,
                    "object_class": obj,
                    "severity": "info",
                })

        return events

    def build_activity_events(self, video_id: int, raw_events: list[dict]) -> list[ActivityEvent]:
        return [
            ActivityEvent(
                video_id=video_id,
                activity_type=e["type"],
                description=e["description"],
                start_seconds=e["start_seconds"],
                end_seconds=e.get("end_seconds"),
                track_id=e.get("track_id"),
                object_class=e.get("object_class"),
                severity=e.get("severity", "info"),
            )
            for e in raw_events
        ]


def _format_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"
