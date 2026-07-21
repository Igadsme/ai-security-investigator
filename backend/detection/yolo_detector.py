from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from ultralytics import YOLO

from config import settings

# COCO class names mapped to surveillance-relevant objects
TARGET_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
    16: "dog",
    24: "backpack",
    26: "handbag",
    28: "suitcase",
}

COLOR_NAMES = [
    ("white", (200, 200, 200)),
    ("black", (30, 30, 30)),
    ("gray", (128, 128, 128)),
    ("red", (180, 50, 50)),
    ("blue", (50, 50, 180)),
    ("green", (50, 150, 50)),
    ("yellow", (200, 200, 50)),
    ("orange", (200, 120, 50)),
    ("brown", (120, 80, 50)),
    ("silver", (170, 170, 180)),
]


def get_dominant_color(frame: np.ndarray, bbox: tuple[float, float, float, float]) -> str:
    x1, y1, x2, y2 = [int(v) for v in bbox]
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return "unknown"

    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return "unknown"

    # Focus on center region to avoid background bleed
    ch, cw = crop.shape[:2]
    margin_h, margin_w = int(ch * 0.2), int(cw * 0.2)
    center = crop[margin_h : ch - margin_h, margin_w : cw - margin_w]
    if center.size == 0:
        center = crop

    avg = center.mean(axis=(0, 1))  # BGR
    b, g, r = avg

    best_name = "unknown"
    best_dist = float("inf")
    for name, (tr, tg, tb) in COLOR_NAMES:
        dist = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2
        if dist < best_dist:
            best_dist = dist
            best_name = name
    return best_name


class YOLODetector:
    def __init__(self, model_path: Optional[str] = None):
        path = model_path or str(Path(settings.models_dir) / "yolov8n.pt")
        self.model = YOLO(path)
        self.confidence = settings.confidence_threshold

    def detect_frame(self, frame: np.ndarray) -> list[dict]:
        results = self.model(frame, verbose=False, conf=self.confidence)[0]
        detections = []

        if results.boxes is None:
            return detections

        for box in results.boxes:
            cls_id = int(box.cls[0])
            if cls_id not in TARGET_CLASSES:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            obj_class = TARGET_CLASSES[cls_id]
            color = get_dominant_color(frame, (x1, y1, x2, y2))

            detections.append({
                "object_class": obj_class,
                "confidence": conf,
                "bbox": (x1, y1, x2, y2),
                "dominant_color": color,
            })

        return detections

    @staticmethod
    def get_video_info(video_path: str) -> dict:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()

        return {
            "fps": fps,
            "frame_count": frame_count,
            "width": width,
            "height": height,
            "duration_seconds": duration,
        }
