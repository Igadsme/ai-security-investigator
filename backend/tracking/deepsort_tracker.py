from deep_sort_realtime.deepsort_tracker import DeepSort

CLASS_TO_CATEGORY = {
    "person": 0,
    "bicycle": 1,
    "car": 2,
    "motorcycle": 3,
    "bus": 5,
    "truck": 7,
    "dog": 16,
    "backpack": 24,
    "handbag": 26,
    "suitcase": 28,
}


class DeepSortTracker:
    def __init__(self, max_age: int = 30):
        self.tracker = DeepSort(
            max_age=max_age,
            n_init=3,
            nms_max_overlap=0.7,
            max_cosine_distance=0.4,
            embedder="mobilenet",
            half=True,
            embedder_gpu=False,
        )
        self.track_history: dict[int, dict] = {}

    def update(self, detections: list[dict], frame) -> list[dict]:
        """
        Update tracker with detections for current frame.
        Returns detections enriched with track_id.
        """
        raw = []
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            w, h = x2 - x1, y2 - y1
            cat = CLASS_TO_CATEGORY.get(det["object_class"], 0)
            conf = det["confidence"]
            raw.append(([x1, y1, w, h], conf, cat))

        tracks = self.tracker.update_tracks(raw, frame=frame)
        tracked = []

        for track in tracks:
            if not track.is_confirmed():
                continue

            track_id = track.track_id
            ltrb = track.to_ltrb()
            x1, y1, x2, y2 = ltrb

            # Match back to original detection by IoU
            best_det = None
            best_iou = 0.0
            for det in detections:
                iou = _iou(det["bbox"], (x1, y1, x2, y2))
                if iou > best_iou:
                    best_iou = iou
                    best_det = det

            if best_det is None or best_iou < 0.3:
                continue

            enriched = {**best_det, "track_id": track_id}
            tracked.append(enriched)

            if track_id not in self.track_history:
                self.track_history[track_id] = {
                    "object_class": best_det["object_class"],
                    "first_seen": None,
                    "last_seen": None,
                    "frame_count": 0,
                    "dominant_color": best_det.get("dominant_color"),
                }
            self.track_history[track_id]["frame_count"] += 1
            if self.track_history[track_id]["dominant_color"] is None:
                self.track_history[track_id]["dominant_color"] = best_det.get("dominant_color")

        return tracked

    def finalize_tracks(self, timestamps: dict[int, float]) -> list[dict]:
        """Build track summaries after processing all frames."""
        summaries = []
        for track_id, info in self.track_history.items():
            ts_list = [t for tid, t in timestamps.items() if tid == track_id]
            if not ts_list:
                continue
            summaries.append({
                "track_id": track_id,
                "object_class": info["object_class"],
                "first_seen_seconds": min(ts_list),
                "last_seen_seconds": max(ts_list),
                "frame_count": info["frame_count"],
                "dominant_color": info.get("dominant_color"),
                "is_unique_person": info["object_class"] == "person",
            })
        return summaries

    def record_timestamp(self, track_id: int, timestamp: float) -> None:
        if track_id not in self.track_history:
            return
        hist = self.track_history[track_id]
        if hist.get("_timestamps") is None:
            hist["_timestamps"] = []
        hist["_timestamps"].append(timestamp)

    def get_track_summaries(self) -> list[dict]:
        summaries = []
        for track_id, info in self.track_history.items():
            timestamps = info.get("_timestamps", [])
            if not timestamps:
                continue
            summaries.append({
                "track_id": track_id,
                "object_class": info["object_class"],
                "first_seen_seconds": min(timestamps),
                "last_seen_seconds": max(timestamps),
                "frame_count": info["frame_count"],
                "dominant_color": info.get("dominant_color"),
                "is_unique_person": info["object_class"] == "person",
            })
        return summaries


def _iou(box_a: tuple, box_b: tuple) -> float:
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a + area_b - inter_area
    return inter_area / union if union > 0 else 0.0
