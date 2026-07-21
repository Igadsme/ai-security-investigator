import subprocess
from pathlib import Path

import cv2

from config import settings


class ClipGenerator:
    def __init__(self):
        Path(settings.processed_dir).mkdir(parents=True, exist_ok=True)

    def generate_clip(
        self,
        video_path: str,
        start_seconds: float,
        end_seconds: float,
        output_name: str,
        padding: float = 2.0,
    ) -> str:
        """Extract a video clip using ffmpeg or OpenCV fallback."""
        start = max(0, start_seconds - padding)
        end = end_seconds + padding
        duration = end - start

        output_path = str(Path(settings.processed_dir) / output_name)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        if self._try_ffmpeg(video_path, start, duration, output_path):
            return output_path

        return self._opencv_clip(video_path, start, end, output_path)

    def _try_ffmpeg(
        self,
        video_path: str,
        start: float,
        duration: float,
        output_path: str,
    ) -> bool:
        try:
            cmd = [
                "ffmpeg", "-y",
                "-ss", str(start),
                "-i", video_path,
                "-t", str(duration),
                "-c", "copy",
                "-avoid_negative_ts", "make_zero",
                output_path,
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=120,
            )
            return result.returncode == 0 and Path(output_path).exists()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _opencv_clip(
        self,
        video_path: str,
        start: float,
        end: float,
        output_path: str,
    ) -> str:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000)
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            current_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
            if current_ms > end * 1000:
                break
            writer.write(frame)

        cap.release()
        writer.release()
        return output_path

    @staticmethod
    def format_clip_name(video_id: int, start: float, end: float) -> str:
        def fmt(s: float) -> str:
            h = int(s // 3600)
            m = int((s % 3600) // 60)
            sec = int(s % 60)
            return f"{h}_{m:02d}_{sec:02d}"

        return f"clip_v{video_id}_{fmt(start)}_to_{fmt(end)}.mp4"
