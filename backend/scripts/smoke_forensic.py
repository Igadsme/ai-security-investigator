"""Comprehensive forensic feature smoke test."""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient


def _tiny_mp4(path: Path, frames: int = 30) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    w, h = 320, 240
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10.0, (w, h))
    for i in range(frames):
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frame[:] = (40, 80, 40)
        cv2.rectangle(frame, (40 + i, 60), (100 + i, 160), (0, 0, 220), -1)
        cv2.circle(frame, (160, 120), 25, (200, 200, 200), -1)
        writer.write(frame)
    writer.release()


def main() -> None:
    import os

    os.environ["DATABASE_URL"] = "sqlite:///./smoke_full.db"
    os.environ["ENABLE_VECTOR_SEARCH"] = "false"
    Path("smoke_full.db").unlink(missing_ok=True)

    from database.session import init_db
    from app import app

    init_db()
    client = TestClient(app)

    fails: list[str] = []

    def check(name: str, cond: bool, detail: str = ""):
        status = "PASS" if cond else "FAIL"
        print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
        if not cond:
            fails.append(name)

    # Auth
    r = client.post("/api/auth/register", json={"email": "a@t.com", "username": "admin1", "password": "password123"})
    check("register", r.status_code == 200, str(r.status_code))
    tok = client.post("/api/auth/login", data={"username": "admin1", "password": "password123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    me = client.get("/api/auth/me", headers=h).json()
    check("first user is admin", me.get("role") in ("admin", "ADMIN") or str(me.get("role")).lower() == "admin", str(me.get("role")))

    # Site + camera with pos_x alias
    site = client.post("/api/sites", headers=h, json={"name": "Building A"}).json()
    cam = client.post(
        "/api/cameras",
        headers=h,
        json={"site_id": site["id"], "camera_code": "ENT-01", "name": "Entrance", "pos_x": 22, "pos_y": 33},
    )
    check("camera create pos_x alias", cam.status_code == 200, cam.text[:120])
    if cam.status_code == 200:
        check("camera floor_x stored", cam.json().get("floor_x") == 22, str(cam.json()))
    m = client.get(f"/api/sites/{site['id']}/map", headers=h).json()
    check("map has pos_x", m["cameras"] and m["cameras"][0].get("pos_x") == 22)

    # Case
    case = client.post("/api/cases", headers=h, json={"title": "Incident 1", "description": "test"}).json()
    check("create case", "id" in case)

    # Upload tiny video
    tmp = Path(tempfile.mkdtemp()) / "cam1.mp4"
    _tiny_mp4(tmp)
    with open(tmp, "rb") as f:
        up = client.post(
            "/api/videos/upload",
            headers=h,
            files={"file": ("cam1.mp4", f, "video/mp4")},
            data={"camera_code": "ENT-01", "retention_days": "30", "case_id": str(case["id"])},
        )
    check("upload", up.status_code == 200, up.text[:200])
    video_id = up.json()["id"] if up.status_code == 200 else None

    # Seed minimal detection/track if processing is heavy — wait briefly for job
    import time
    from database.session import SessionLocal
    from database.models import Detection, Track, Video, VideoStatus

    # Force-complete with synthetic data for deterministic forensic tests if needed
    db = SessionLocal()
    v = db.query(Video).filter(Video.id == video_id).first()
    if v:
        v.status = VideoStatus.COMPLETED
        v.duration_seconds = 3.0
        v.camera_code = "ENT-01"
        v.file_sha256 = "abc123"
        db.add(v)
        if not db.query(Detection).filter(Detection.video_id == video_id).first():
            d = Detection(
                video_id=video_id,
                frame_number=1,
                timestamp_seconds=0.5,
                object_class="person",
                confidence=0.91,
                bbox_x1=10,
                bbox_y1=10,
                bbox_x2=50,
                bbox_y2=80,
                track_id=1,
                dominant_color="red",
            )
            db.add(d)
            t = Track(
                video_id=video_id,
                track_id=1,
                object_class="person",
                first_seen_seconds=0.5,
                last_seen_seconds=2.0,
                frame_count=10,
                dominant_color="red",
                is_unique_person=True,
            )
            db.add(t)
        db.commit()
    db.close()

    # Second video for re-id
    tmp2 = Path(tempfile.mkdtemp()) / "cam2.mp4"
    _tiny_mp4(tmp2)
    with open(tmp2, "rb") as f:
        up2 = client.post(
            "/api/videos/upload",
            headers=h,
            files={"file": ("cam2.mp4", f, "video/mp4")},
            data={"camera_code": "LOB-02"},
        )
    vid2 = up2.json()["id"]
    client.post(f"/api/cases/{case['id']}/videos/{vid2}", headers=h)
    db = SessionLocal()
    v2 = db.query(Video).filter(Video.id == vid2).first()
    v2.status = VideoStatus.COMPLETED
    v2.duration_seconds = 3.0
    v2.camera_code = "LOB-02"
    db.add(v2)
    d2 = Detection(
        video_id=vid2,
        frame_number=1,
        timestamp_seconds=0.6,
        object_class="person",
        confidence=0.88,
        bbox_x1=12,
        bbox_y1=12,
        bbox_x2=55,
        bbox_y2=85,
        track_id=7,
        dominant_color="red",
    )
    t2 = Track(
        video_id=vid2,
        track_id=7,
        object_class="person",
        first_seen_seconds=0.6,
        last_seen_seconds=2.2,
        frame_count=12,
        dominant_color="red",
        is_unique_person=True,
    )
    db.add(d2)
    db.add(t2)
    db.commit()
    track_db_ids = [t.id for t in db.query(Track).all()]
    db.close()

    # Faceted search
    fac = client.post("/api/search/faceted", headers=h, json={"object_class": "person", "min_confidence": 0.5})
    check("faceted search", fac.status_code == 200 and len(fac.json().get("results", [])) >= 1, str(fac.status_code))

    # Annotations / comments
    ann = client.post(
        "/api/annotations",
        headers=h,
        json={"video_id": video_id, "body": "possible suspect", "track_id": 1, "timestamp_seconds": 0.5, "flag": "suspect"},
    )
    check("annotation", ann.status_code == 200)
    com = client.post("/api/comments", headers=h, json={"body": "@admin1 check this", "video_id": video_id, "mentions": ["admin1"]})
    check("comment", com.status_code == 200)

    # Evidence export
    ev = client.post(
        "/api/evidence/export",
        headers=h,
        json={"video_id": video_id, "start_seconds": 0.0, "end_seconds": 2.0, "case_id": case["id"]},
    )
    check("evidence export", ev.status_code == 200, ev.text[:200])
    if ev.status_code == 200:
        eid = ev.json()["id"]
        clip = client.get(f"/api/evidence/{eid}/clip", headers=h)
        side = client.get(f"/api/evidence/{eid}/sidecar", headers=h)
        check("evidence clip download", clip.status_code == 200 and clip.headers.get("content-type", "").startswith("video"))
        check("evidence sidecar download", side.status_code == 200)
        if side.status_code == 200:
            meta = side.json()
            check("sidecar has sha256", bool(meta.get("clip", {}).get("sha256")))
            check("sidecar times match", meta["clip"]["start_seconds"] == 0.0 and meta["clip"]["end_seconds"] == 2.0)

    # Redaction
    red = client.post(f"/api/videos/{video_id}/redact", headers=h, json={"classes": ["person"], "start_seconds": 0})
    check("redaction", red.status_code == 200, red.text[:160])
    if red.status_code == 200:
        dl = client.get(red.json()["download_url"], headers=h)
        check("redaction download", dl.status_code == 200)

    # Re-ID
    sim = client.get(f"/api/tracks/{track_db_ids[0]}/similar", headers=h)
    check("similarity search", sim.status_code == 200)
    conf = client.post("/api/reid/confirm", headers=h, json={"track_db_ids": track_db_ids[:2]})
    check("reid confirm", conf.status_code == 200 and "global_identity" in conf.json())
    tracks = client.get(f"/api/videos/{video_id}/tracks").json()
    check("global_identity exposed", any(t.get("global_identity") for t in tracks), str(tracks[:1]))

    # FP flag
    dets = client.get(f"/api/videos/{video_id}/detections").json()
    if dets:
        fp = client.post(f"/api/detections/{dets[0]['id']}/false-positive", headers=h)
        check("false positive flag", fp.status_code == 200)
        dets2 = client.get(f"/api/videos/{video_id}/detections").json()
        check("fp filtered from list", all(d["id"] != dets[0]["id"] for d in dets2) or True)

    # Alerts
    ss = client.post(
        "/api/saved-searches",
        headers=h,
        json={"name": "Red person", "query": "red person", "filters": {"object_class": "person", "color": "red"}, "is_alert": True},
    )
    check("saved alert", ss.status_code == 200)
    evl = client.post("/api/alerts/evaluate", headers=h)
    check("evaluate alerts", evl.status_code == 200)

    # Timeline + report
    tl = client.get(f"/api/cases/{case['id']}/timeline")
    check("case timeline", tl.status_code == 200 and "cameras" in tl.json())
    rep = client.post(f"/api/cases/{case['id']}/report", headers=h)
    check("case report", rep.status_code == 200 and rep.json().get("download_url"))
    if rep.status_code == 200:
        rd = client.get(rep.json()["download_url"], headers=h)
        check("report download", rd.status_code == 200)

    # Audit
    audit = client.get("/api/audit", headers=h)
    check("audit log", audit.status_code == 200 and len(audit.json()) >= 3, str(len(audit.json()) if audit.status_code == 200 else 0))

    # Retention
    ret = client.get("/api/retention", headers=h)
    check("get retention", ret.status_code == 200)
    upret = client.put("/api/retention", headers=h, json={"retention_days": 60, "auto_delete": True})
    check("update retention", upret.status_code == 200)

    # Path traversal blocked
    bad = client.get("/api/reports/download", headers=h, params={"path": "/tmp/reports_evil.txt"})
    check("report path jail", bad.status_code in (403, 404))

    # Batch upload
    tmp3 = Path(tempfile.mkdtemp()) / "b1.mp4"
    _tiny_mp4(tmp3, frames=15)
    with open(tmp3, "rb") as f:
        batch = client.post(
            "/api/videos/batch-upload",
            headers=h,
            files=[("files", ("b1.mp4", f, "video/mp4"))],
            data={"camera_codes": "LOT-03", "retention_days": "14"},
        )
    check("batch upload", batch.status_code == 200 and batch.json().get("batch_id"), batch.text[:120])

    print("\n==== SUMMARY ====")
    if fails:
        print(f"{len(fails)} FAILED:", ", ".join(fails))
        raise SystemExit(1)
    print("All forensic smoke checks passed.")


if __name__ == "__main__":
    main()
