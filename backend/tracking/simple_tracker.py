from typing import Optional


class SimpleTracker:
    """Lightweight centroid tracker — fast and low memory vs DeepSORT."""

    def __init__(self, max_disappeared: int = 30, max_distance: float = 100.0):
        self.next_id = 1
        self.tracks: dict[int, dict] = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def update(self, detections: list[dict], frame=None) -> list[dict]:
        if not detections:
            self._age_tracks()
            return []

        centroids = []
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            centroids.append(((x1 + x2) / 2, (y1 + y2) / 2))

        if not self.tracks:
            return self._register_all(detections, centroids)

        track_ids = list(self.tracks.keys())
        track_centroids = [self.tracks[tid]["centroid"] for tid in track_ids]

        used_tracks: set[int] = set()
        used_dets: set[int] = set()
        results: list[dict] = []

        pairs = []
        for di, dc in enumerate(centroids):
            for ti, tc in enumerate(track_centroids):
                dist = ((dc[0] - tc[0]) ** 2 + (dc[1] - tc[1]) ** 2) ** 0.5
                if dist < self.max_distance:
                    pairs.append((dist, di, ti))

        pairs.sort(key=lambda x: x[0])

        for _, di, ti in pairs:
            if di in used_dets or ti in used_tracks:
                continue
            tid = track_ids[ti]
            det = detections[di]
            self._update_track(tid, det, centroids[di])
            used_dets.add(di)
            used_tracks.add(ti)
            results.append({**det, "track_id": tid})

        for di, det in enumerate(detections):
            if di not in used_dets:
                tid = self.next_id
                self.next_id += 1
                self._update_track(tid, det, centroids[di])
                results.append({**det, "track_id": tid})

        for ti, tid in enumerate(track_ids):
            if ti not in used_tracks:
                self.tracks[tid]["disappeared"] += 1

        self._purge_stale()
        return results

    def _register_all(self, detections: list[dict], centroids: list) -> list[dict]:
        results = []
        for det, cent in zip(detections, centroids):
            tid = self.next_id
            self.next_id += 1
            self._update_track(tid, det, cent)
            results.append({**det, "track_id": tid})
        return results

    def _update_track(self, tid: int, det: dict, centroid: tuple) -> None:
        if tid not in self.tracks:
            self.tracks[tid] = {
                "object_class": det["object_class"],
                "centroid": centroid,
                "disappeared": 0,
                "frame_count": 0,
                "dominant_color": det.get("dominant_color"),
                "_timestamps": [],
            }
        info = self.tracks[tid]
        info["centroid"] = centroid
        info["disappeared"] = 0
        info["frame_count"] += 1
        if det.get("dominant_color"):
            info["dominant_color"] = det["dominant_color"]

    def _age_tracks(self) -> None:
        for tid in list(self.tracks.keys()):
            self.tracks[tid]["disappeared"] += 1
        self._purge_stale()

    def _purge_stale(self) -> None:
        stale = [tid for tid, t in self.tracks.items() if t["disappeared"] > self.max_disappeared]
        for tid in stale:
            del self.tracks[tid]

    def record_timestamp(self, track_id: int, timestamp: float) -> None:
        if track_id in self.tracks:
            self.tracks[track_id].setdefault("_timestamps", []).append(timestamp)

    def get_track_summaries(self) -> list[dict]:
        summaries = []
        for track_id, info in self.tracks.items():
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
