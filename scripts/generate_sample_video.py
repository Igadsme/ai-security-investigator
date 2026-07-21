#!/usr/bin/env python3
"""Generate a sample surveillance video using real images for YOLO detection."""

import urllib.request
from pathlib import Path

import cv2
import numpy as np

OUTPUT = Path(__file__).parent.parent / "uploads" / "parking_lot_sample.mp4"
ASSETS = Path(__file__).parent / "assets"


def download_image(url: str, name: str) -> np.ndarray:
    ASSETS.mkdir(parents=True, exist_ok=True)
    path = ASSETS / name
    if not path.exists():
        print(f"Downloading {name}...")
        urllib.request.urlretrieve(url, path)
    img = cv2.imread(str(path))
    if img is None:
        raise RuntimeError(f"Failed to load {path}")
    return img


def overlay(frame: np.ndarray, img: np.ndarray, x: int, y: int, scale: float = 0.3) -> None:
    h, w = img.shape[:2]
    nw, nh = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (nw, nh))
    fh, fw = frame.shape[:2]
    x2, y2 = min(fw, x + nw), min(fh, y + nh)
    if x >= fw or y >= fh:
        return
    roi = frame[y:y2, x:x2]
    patch = resized[: y2 - y, : x2 - x]
    if roi.shape == patch.shape:
        frame[y:y2, x:x2] = patch


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    # Ultralytics sample images (contain person, car, etc.)
    person = download_image(
        "https://ultralytics.com/images/bus.jpg", "bus.jpg"
    )
    car_img = download_image(
        "https://ultralytics.com/images/zidane.jpg", "zidane.jpg"
    )

    w, h, fps = 1280, 720, 10
    duration = 20
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(OUTPUT), fourcc, fps, (w, h))

    for i in range(duration * fps):
        frame = np.full((h, w, 3), (35, 40, 45), dtype=np.uint8)
        cv2.rectangle(frame, (0, int(h * 0.6)), (w, h), (50, 55, 60), -1)

        # Moving person scene
        px = int(-200 + (i * 12) % (w + 200))
        overlay(frame, person, px, int(h * 0.15), scale=0.55)

        # Second person entering later
        if i > fps * 8:
            px2 = int(-200 + ((i - fps * 8) * 10) % (w + 200))
            overlay(frame, car_img, px2, int(h * 0.2), scale=0.45)

        cv2.putText(
            frame, "SAMPLE SURVEILLANCE FOOTAGE", (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX, 1, (180, 180, 180), 2,
        )
        writer.write(frame)

    writer.release()
    print(f"Created {OUTPUT} ({duration}s, {fps}fps)")


if __name__ == "__main__":
    main()
