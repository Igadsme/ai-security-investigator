"""Forensic / collaboration / multi-camera API routes."""
from __future__ import annotations

import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from auth import get_current_user, get_current_user_optional, require_roles
from config import settings
from database import get_db
from database.crud import create_processing_job, create_video, get_video
from database.models import (
    Annotation,
    ActivityEvent,
    AuditLog,
    Case,
    CaseItem,
    CaseStatus,
    Camera,
    Comment,
    Detection,
    EvidenceExport,
    ProcessingJob,
    ReIDMatch,
    RetentionPolicy,
    SavedSearch,
    Site,
    Track,
    User,
    UserRole,
    Video,
)
from schemas import (
    AnnotationCreate,
    AnnotationResponse,
    CaseCreate,
    CaseResponse,
    CameraCreate,
    CameraResponse,
    CommentCreate,
    CommentResponse,
    EvidenceExportRequest,
    EvidenceExportResponse,
    FacetedSearchRequest,
    RedactionRequest,
    ReIDConfirmRequest,
    RetentionPolicyUpdate,
    SavedSearchCreate,
    SavedSearchResponse,
    SiteCreate,
    SiteResponse,
)
from services.audit import log_action
from services.evidence_export import EvidenceExporter, sha256_file
from services.redaction import RedactionService
from services.reid import assign_global_identity, suggest_matches
from services.report import ReportGenerator
from services.retention import apply_retention_on_upload, get_or_create_policy, run_retention_cleanup
from services.video_processor import format_timestamp

router = APIRouter(prefix="/api", tags=["forensic"])


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _enum_val(v):
    return v.value if hasattr(v, "value") else v


def _next_case_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"VS-{year}-"
    count = db.query(Case).filter(Case.case_number.like(f"{prefix}%")).count()
    return f"{prefix}{count + 1:04d}"


def _case_videos(db: Session, case_id: int) -> list[Video]:
    items = db.query(CaseItem).filter(CaseItem.case_id == case_id, CaseItem.item_type == "video").all()
    videos = []
    for it in items:
        if it.video_id:
            v = get_video(db, it.video_id)
            if v:
                videos.append(v)
    return videos


def _map_class(name: Optional[str]) -> str:
    raw = (name or "person").lower()
    if raw in ("bicycle", "motorcycle"):
        return "bike"
    if raw in ("backpack", "handbag", "suitcase"):
        return "bag"
    if raw in ("person", "car", "truck", "bike", "dog", "bag"):
        return raw
    return "person"


def _map_action(activity_type) -> str:
    val = _enum_val(activity_type) or ""
    mapping = {
        "abandoned_object": "left_object",
        "vehicle_arrival": "entry",
        "vehicle_departure": "exit",
        "trespassing": "passing",
        "loitering": "loitering",
        "running": "running",
        "entry": "entry",
        "exit": "exit",
    }
    return mapping.get(str(val), "passing")


def _severity(activity_type, stored: Optional[str] = None) -> str:
    if stored and stored in ("low", "medium", "high", "critical"):
        return stored
    val = str(_enum_val(activity_type) or "")
    if val in ("trespassing", "abandoned_object"):
        return "high"
    if val in ("loitering", "running"):
        return "medium"
    return "low"


def build_case_workspace(db: Session, case: Case) -> dict:
    videos = _case_videos(db, case.id)
    video_ids = [v.id for v in videos]
    cameras = []
    seen_cam = set()
    for v in videos:
        if v.camera_id and v.camera_id not in seen_cam:
            cam = db.query(Camera).filter(Camera.id == v.camera_id).first()
            if cam:
                seen_cam.add(cam.id)
                cameras.append(cam)
        elif v.camera_code:
            cam = db.query(Camera).filter(Camera.camera_code == v.camera_code).first()
            if cam and cam.id not in seen_cam:
                seen_cam.add(cam.id)
                cameras.append(cam)
    if case.site_id:
        for cam in db.query(Camera).filter(Camera.site_id == case.site_id).all():
            if cam.id not in seen_cam:
                seen_cam.add(cam.id)
                cameras.append(cam)

    clips = []
    for v in videos:
        job = None
        if v.jobs:
            job = v.jobs[-1]
        tracks = db.query(Track).filter(Track.video_id == v.id).order_by(Track.track_id).all()
        events = db.query(ActivityEvent).filter(ActivityEvent.video_id == v.id).order_by(ActivityEvent.start_seconds).all()
        fp_tracks = {
            d.track_id
            for d in db.query(Detection)
            .filter(Detection.video_id == v.id, Detection.is_false_positive.is_(True), Detection.track_id != None)  # noqa: E711
            .all()
        }
        fp_reason = {}
        for d in db.query(Detection).filter(
            Detection.video_id == v.id, Detection.is_false_positive.is_(True), Detection.false_positive_reason != None  # noqa: E711
        ).all():
            if d.track_id is not None and d.track_id not in fp_reason:
                fp_reason[d.track_id] = d.false_positive_reason

        reid = {}
        for t in tracks:
            if t.global_identity:
                linked = db.query(Track).filter(Track.global_identity == t.global_identity, Track.id != t.id).all()
                reid[t.id] = {
                    "globalSubjectId": t.global_identity,
                    "linkedTracks": [
                        {
                            "camera": (get_video(db, lt.video_id).camera_code if get_video(db, lt.video_id) else "") or "",
                            "trackId": f"{_map_class(lt.object_class).title()} #{lt.track_id}",
                            "timeRange": f"{format_timestamp(lt.first_seen_seconds)}–{format_timestamp(lt.last_seen_seconds)}",
                        }
                        for lt in linked[:8]
                    ],
                }

        clips.append({
            "id": str(v.id),
            "videoId": v.id,
            "title": v.original_filename,
            "filename": v.original_filename,
            "fileSizeMb": round(Path(v.filepath).stat().st_size / 1e6, 2) if Path(v.filepath).is_file() else 0,
            "durationSeconds": v.duration_seconds or 0,
            "camera": v.camera_code or (v.camera.name if v.camera else f"CAM-{v.id}"),
            "recordedAt": (v.recorded_at or v.created_at).isoformat() if (v.recorded_at or v.created_at) else None,
            "videoUrl": f"/api/videos/{v.id}/stream",
            "sha256": v.file_sha256 or "",
            "status": _enum_val(v.status),
            "width": v.width,
            "height": v.height,
            "job": {
                "status": job.status if job else None,
                "progress": job.progress if job else None,
                "stage": job.stage if job else None,
            } if job else None,
            "tracks": [
                {
                    "id": f"{_map_class(t.object_class).title()} #{t.track_id}",
                    "dbId": t.id,
                    "trackId": t.track_id,
                    "targetClass": _map_class(t.object_class),
                    "camera": v.camera_code or f"CAM-{v.id}",
                    "color": t.dominant_color or "unknown",
                    "firstSeenSec": t.first_seen_seconds,
                    "lastSeenSec": t.last_seen_seconds,
                    "confidence": 0.8,
                    "isFalsePositive": t.track_id in fp_tracks,
                    "falsePositiveReason": fp_reason.get(t.track_id),
                    "points": [],
                    "crossCameraReId": reid.get(t.id),
                }
                for t in tracks
            ],
            "events": [
                {
                    "id": str(ev.id),
                    "timestamp": format_timestamp(ev.start_seconds),
                    "timeSeconds": ev.start_seconds,
                    "camera": v.camera_code or f"CAM-{v.id}",
                    "trackId": f"{_map_class(ev.object_class).title()} #{ev.track_id}" if ev.track_id is not None else "",
                    "targetClass": _map_class(ev.object_class),
                    "action": _map_action(ev.activity_type),
                    "title": str(_enum_val(ev.activity_type)).replace("_", " ").title(),
                    "description": ev.description,
                    "severity": _severity(ev.activity_type, ev.severity),
                }
                for ev in events
            ],
        })

    notes = []
    if video_ids:
        for a in db.query(Annotation).filter(Annotation.video_id.in_(video_ids)).order_by(Annotation.created_at.desc()).all():
            author = db.query(User).filter(User.id == a.author_id).first() if a.author_id else None
            v = get_video(db, a.video_id)
            notes.append({
                "id": str(a.id),
                "author": author.username if author else "Investigator",
                "timestampSec": a.timestamp_seconds or 0,
                "createdAt": a.created_at.isoformat() if a.created_at else None,
                "text": a.body,
                "camera": v.camera_code if v else "",
                "tags": a.tags or ([a.flag] if a.flag else []),
                "videoId": a.video_id,
            })

    alerts = db.query(SavedSearch).filter(SavedSearch.is_alert == True).order_by(SavedSearch.created_at.desc()).all()  # noqa: E712
    standing = []
    for al in alerts:
        filt = al.filters or {}
        standing.append({
            "id": str(al.id),
            "name": al.name,
            "targetClass": filt.get("object_class") or "any",
            "camera": filt.get("camera_code") or "all",
            "action": filt.get("activity_type") or "any",
            "color": filt.get("color"),
            "minConfidence": float(filt.get("min_confidence") or 0.4),
            "enabled": _enum_val(al.alert_status) != "paused",
            "createdAt": al.created_at.isoformat() if al.created_at else None,
            "triggeredCount": 1 if al.last_triggered_at else 0,
            "lastTriggered": al.last_triggered_at.isoformat() if al.last_triggered_at else None,
            "query": al.query,
        })

    audits = (
        db.query(AuditLog)
        .filter(AuditLog.resource_type.in_(["case", "video", "evidence", "annotation"]))
        .order_by(AuditLog.created_at.desc())
        .limit(80)
        .all()
    )
    audit_logs = [
        {
            "id": str(r.id),
            "timestamp": r.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if r.created_at else "",
            "investigator": r.username or "system",
            "actionType": r.action,
            "details": r.details if isinstance(r.details, str) else (str(r.details) if r.details else r.action),
            "sha256Proof": (r.details or {}).get("sha256") if isinstance(r.details, dict) else None,
            "ipAddress": r.ip_address,
        }
        for r in audits
    ]

    owner = db.query(User).filter(User.id == case.owner_id).first() if case.owner_id else None
    status = _enum_val(case.status)
    if status == "archived":
        ui_status = "closed"
    else:
        ui_status = status or "open"

    return {
        "id": str(case.id),
        "dbId": case.id,
        "caseNumber": case.case_number or f"VS-{case.id:04d}",
        "title": case.title,
        "description": case.description or "",
        "status": ui_status,
        "priority": case.priority or "medium",
        "assignedInvestigator": case.assigned_investigator or (owner.username if owner else ""),
        "createdAt": case.created_at.isoformat() if case.created_at else None,
        "incidentTime": case.incident_time.isoformat() if case.incident_time else (case.created_at.isoformat() if case.created_at else None),
        "siteId": case.site_id,
        "cameras": [
            {
                "id": str(c.id),
                "dbId": c.id,
                "name": c.name,
                "cameraCode": c.camera_code,
                "location": c.location_label or c.name,
                "zone": c.zone or "main",
                "resolution": "1080p",
                "fps": 10,
                "status": "online" if c.is_live else "recorded",
                "mapCoords": {
                    "x": (c.floor_x if c.floor_x is not None else 40),
                    "y": (c.floor_y if c.floor_y is not None else 40),
                    "angle": c.map_angle if c.map_angle is not None else 45,
                    "fov": c.map_fov if c.map_fov is not None else 70,
                },
                "rtspUrl": c.rtsp_url,
            }
            for c in cameras
        ],
        "clips": clips,
        "notes": notes,
        "auditLogs": audit_logs,
        "standingAlerts": standing,
    }


# ── Audit ─────────────────────────────────────────────────────────────────────

@router.get("/audit")
def list_audit(
    limit: int = Query(100, le=500),
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    from database.models import AuditLog

    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        q = q.filter(AuditLog.action == action)
    rows = q.limit(limit).all()
    return [
        {
            "id": r.id,
            "username": r.username,
            "action": r.action,
            "resource_type": r.resource_type,
            "resource_id": r.resource_id,
            "details": r.details,
            "ip_address": r.ip_address,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# ── Sites / Cameras / Map ─────────────────────────────────────────────────────

@router.post("/sites", response_model=SiteResponse)
def create_site(body: SiteCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.ADMIN, UserRole.INVESTIGATOR))):
    site = Site(name=body.name, description=body.description, floor_plan_url=body.floor_plan_url, map_bounds=body.map_bounds)
    db.add(site)
    db.commit()
    db.refresh(site)
    log_action(db, action="site.create", user=user, resource_type="site", resource_id=site.id)
    return site


@router.get("/sites", response_model=list[SiteResponse])
def list_sites(db: Session = Depends(get_db)):
    return db.query(Site).order_by(Site.id.desc()).all()


@router.post("/cameras", response_model=CameraResponse)
def create_camera(body: CameraCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.ADMIN, UserRole.INVESTIGATOR))):
    data = body.model_dump()
    cam = Camera(**data)
    db.add(cam)
    db.commit()
    db.refresh(cam)
    log_action(db, action="camera.create", user=user, resource_type="camera", resource_id=cam.id)
    return cam


@router.get("/cameras", response_model=list[CameraResponse])
def list_cameras(site_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Camera)
    if site_id:
        q = q.filter(Camera.site_id == site_id)
    return q.order_by(Camera.id).all()


@router.get("/sites/{site_id}/map")
def site_map(site_id: int, db: Session = Depends(get_db)):
    from database.models import VideoStatus

    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(404, "Site not found")
    cameras = db.query(Camera).filter(Camera.site_id == site_id).all()
    plots = []
    for cam in cameras:
        vids = db.query(Video).filter(Video.camera_id == cam.id, Video.status == VideoStatus.COMPLETED).all()
        det_count = 0
        for v in vids:
            det_count += db.query(Detection).filter(Detection.video_id == v.id, Detection.is_false_positive.is_(False)).count()
        plots.append({
            "id": cam.id,
            "camera_id": cam.id,
            "camera_code": cam.camera_code,
            "name": cam.name,
            "lat": cam.lat,
            "lng": cam.lng,
            "floor_x": cam.floor_x,
            "floor_y": cam.floor_y,
            "zone": cam.zone,
            "map_angle": cam.map_angle,
            "map_fov": cam.map_fov,
            "pos_x": cam.floor_x,
            "pos_y": cam.floor_y,
            "detection_count": det_count,
            "video_count": len(vids),
            "is_live": bool(cam.is_live),
        })
    return {"site": {"id": site.id, "name": site.name, "floor_plan_url": site.floor_plan_url, "map_bounds": site.map_bounds}, "cameras": plots}


# ── Cases ─────────────────────────────────────────────────────────────────────

@router.post("/cases", response_model=CaseResponse)
def create_case(body: CaseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    status = CaseStatus.OPEN
    if body.status:
        try:
            status = CaseStatus(body.status)
        except ValueError:
            status = CaseStatus.OPEN
    case = Case(
        title=body.title,
        description=body.description,
        notes=body.notes,
        owner_id=user.id,
        site_id=body.site_id,
        case_number=body.case_number or _next_case_number(db),
        priority=body.priority or "medium",
        assigned_investigator=body.assigned_investigator or user.username,
        incident_time=body.incident_time,
        status=status,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    if body.video_ids:
        for vid in body.video_ids:
            db.add(CaseItem(case_id=case.id, item_type="video", video_id=vid))
        db.commit()
    log_action(db, action="case.create", user=user, resource_type="case", resource_id=case.id)
    return case


@router.get("/cases", response_model=list[CaseResponse])
def list_cases(db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)):
    return db.query(Case).order_by(Case.updated_at.desc()).all()


@router.get("/cases/{case_id}")
def get_case(case_id: int, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    items = db.query(CaseItem).filter(CaseItem.case_id == case_id).all()
    videos = []
    for it in items:
        if it.video_id:
            v = get_video(db, it.video_id)
            if v:
                videos.append({
                    "id": v.id,
                    "original_filename": v.original_filename,
                    "camera_code": v.camera_code,
                    "status": v.status.value if hasattr(v.status, "value") else v.status,
                    "duration_seconds": v.duration_seconds,
                    "recorded_at": v.recorded_at,
                })
    log_action(db, action="case.view", user=user, resource_type="case", resource_id=case_id)
    return {
        "id": case.id,
        "title": case.title,
        "case_number": case.case_number,
        "description": case.description,
        "status": _enum_val(case.status),
        "priority": case.priority or "medium",
        "assigned_investigator": case.assigned_investigator,
        "incident_time": case.incident_time,
        "notes": case.notes,
        "site_id": case.site_id,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
        "items": [{"id": i.id, "item_type": i.item_type, "video_id": i.video_id, "reference": i.reference, "meta": i.meta} for i in items],
        "videos": videos,
    }


@router.get("/cases/{case_id}/workspace")
def case_workspace(case_id: int, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    log_action(db, action="case.view", user=user, resource_type="case", resource_id=case_id)
    return build_case_workspace(db, case)


@router.post("/cases/{case_id}/verify-integrity")
def verify_case_integrity(case_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    results = []
    ok = True
    for v in _case_videos(db, case_id):
        path = Path(v.filepath)
        if not path.is_file():
            results.append({"video_id": v.id, "filename": v.original_filename, "ok": False, "reason": "missing_file"})
            ok = False
            continue
        digest = sha256_file(path)
        match = bool(v.file_sha256) and digest == v.file_sha256
        if not match:
            ok = False
        results.append({
            "video_id": v.id,
            "filename": v.original_filename,
            "stored": v.file_sha256,
            "computed": digest,
            "ok": match,
        })
    log_action(
        db, action="sha_verified", user=user, resource_type="case", resource_id=case_id,
        details={"ok": ok, "clips": len(results)},
    )
    return {"ok": ok, "clips": results}


@router.post("/cases/{case_id}/summary")
def case_ai_summary(case_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from search.nl_search import _complete, _fallback_summary
    import json

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    ws = build_case_workspace(db, case)
    payload = {
        "caseNumber": ws["caseNumber"],
        "title": ws["title"],
        "clips": [
            {
                "filename": c["filename"],
                "camera": c["camera"],
                "tracks": [{"id": t["id"], "class": t["targetClass"], "color": t["color"], "first": t["firstSeenSec"], "last": t["lastSeenSec"]} for t in c["tracks"][:20]],
                "events": [{"time": e["timestamp"], "action": e["action"], "description": e["description"]} for e in c["events"][:20]],
            }
            for c in ws["clips"]
        ],
    }
    prompt = f"""You are a forensic video analyst for VeriSight. Write a structured incident summary as JSON only.

Case data:
{json.dumps(payload)[:12000]}

Return JSON with keys:
- executiveSummary (string)
- chronologicalBreakdown (array of {{time, camera, subject, action, significance}})
- subjectInventory (array of {{id, classification, firstSeen, lastSeen, dominantTraits, threatLevel}})
- anomaliesAndViolations (string array)
- investigatorRecommendations (string array)
- integrityStatement (string)
"""
    gemini_used = False
    parsed = None
    try:
        content = _complete(prompt, temperature=0.2, max_tokens=1200, timeout=60)
        if content:
            gemini_used = True
            match = None
            import re
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                parsed = json.loads(match.group())
    except Exception:
        parsed = None

    if not parsed:
        events = []
        for c in ws["clips"]:
            events.extend(c["events"][:8])
        stats = {
            "clips": len(ws["clips"]),
            "tracks": sum(len(c["tracks"]) for c in ws["clips"]),
            "events": sum(len(c["events"]) for c in ws["clips"]),
        }
        parsed = {
            "executiveSummary": _fallback_summary(stats, events),
            "chronologicalBreakdown": [
                {
                    "time": e.get("timestamp"),
                    "camera": e.get("camera"),
                    "subject": e.get("trackId"),
                    "action": e.get("action"),
                    "significance": (e.get("severity") or "low").title(),
                }
                for e in events[:12]
            ],
            "subjectInventory": [
                {
                    "id": t["id"],
                    "classification": t["targetClass"],
                    "firstSeen": format_timestamp(t["firstSeenSec"]),
                    "lastSeen": format_timestamp(t["lastSeenSec"]),
                    "dominantTraits": t.get("color") or "unknown",
                    "threatLevel": "Watch" if t.get("isFalsePositive") else "Review",
                }
                for c in ws["clips"] for t in c["tracks"][:12]
            ],
            "anomaliesAndViolations": [e["description"] for c in ws["clips"] for e in c["events"] if e.get("severity") in ("high", "critical")][:8],
            "investigatorRecommendations": [
                "Review flagged tracks and confirm false positives.",
                "Export evidence clips for chain-of-custody packaging.",
            ],
            "integrityStatement": "Hashes recorded at ingest. Run Verify Integrity to recompute SHA-256 against stored files.",
        }

    log_action(db, action="case.summary", user=user, resource_type="case", resource_id=case_id)
    return {"geminiUsed": gemini_used, **parsed}


@router.get("/videos/{video_id}/overlay")
def video_overlay(
    video_id: int,
    track_id: Optional[int] = None,
    start_seconds: Optional[float] = None,
    end_seconds: Optional[float] = None,
    stride: int = Query(2, ge=1, le=30),
    limit: int = Query(800, le=4000),
    db: Session = Depends(get_db),
):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    w = float(video.width or 1280)
    h = float(video.height or 720)
    q = db.query(Detection).filter(Detection.video_id == video_id, Detection.is_false_positive.is_(False))
    if track_id is not None:
        q = q.filter(Detection.track_id == track_id)
    if start_seconds is not None:
        q = q.filter(Detection.timestamp_seconds >= start_seconds)
    if end_seconds is not None:
        q = q.filter(Detection.timestamp_seconds <= end_seconds)
    rows = q.order_by(Detection.timestamp_seconds, Detection.id).limit(limit * stride).all()
    points = []
    for i, d in enumerate(rows):
        if i % stride != 0:
            continue
        points.append({
            "t": d.timestamp_seconds,
            "x": round(100.0 * d.bbox_x1 / w, 3),
            "y": round(100.0 * d.bbox_y1 / h, 3),
            "w": round(100.0 * max(1.0, d.bbox_x2 - d.bbox_x1) / w, 3),
            "h": round(100.0 * max(1.0, d.bbox_y2 - d.bbox_y1) / h, 3),
            "conf": d.confidence,
            "class": _map_class(d.object_class),
            "track_id": d.track_id,
            "color": d.dominant_color,
            "detection_id": d.id,
        })
        if len(points) >= limit:
            break
    return {"video_id": video_id, "width": w, "height": h, "points": points}


@router.post("/cases/{case_id}/videos/{video_id}")
def add_video_to_case(case_id: int, video_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    if not get_video(db, video_id):
        raise HTTPException(404, "Video not found")
    db.add(CaseItem(case_id=case_id, item_type="video", video_id=video_id))
    case.updated_at = datetime.utcnow()
    db.commit()
    log_action(db, action="case.add_video", user=user, resource_type="case", resource_id=case_id, details={"video_id": video_id})
    return {"ok": True}


@router.get("/cases/{case_id}/timeline")
def case_multicam_timeline(case_id: int, db: Session = Depends(get_db)):
    """Synchronized multi-camera timeline for all videos in a case."""
    items = db.query(CaseItem).filter(CaseItem.case_id == case_id, CaseItem.item_type == "video").all()
    tracks_out = []
    events_out = []
    for it in items:
        v = get_video(db, it.video_id)
        if not v:
            continue
        offset = 0.0
        if v.recorded_at:
            # Relative to earliest recorded_at in case
            pass
        tracks_out.append({
            "video_id": v.id,
            "camera_code": v.camera_code or f"CAM-{v.id}",
            "filename": v.original_filename,
            "duration_seconds": v.duration_seconds,
            "recorded_at": v.recorded_at,
        })
        from database.models import ActivityEvent
        for ev in db.query(ActivityEvent).filter(ActivityEvent.video_id == v.id).all():
            events_out.append({
                "video_id": v.id,
                "camera_code": v.camera_code,
                "activity_type": ev.activity_type.value if hasattr(ev.activity_type, "value") else ev.activity_type,
                "description": ev.description,
                "start_seconds": ev.start_seconds,
                "end_seconds": ev.end_seconds,
                "track_id": ev.track_id,
                "absolute_time": (v.recorded_at.timestamp() + ev.start_seconds) if v.recorded_at else None,
            })
    # Normalize offsets using earliest recorded_at
    recorded = [t["recorded_at"] for t in tracks_out if t["recorded_at"]]
    epoch0 = min(recorded).timestamp() if recorded else None
    for t in tracks_out:
        t["sync_offset_seconds"] = (t["recorded_at"].timestamp() - epoch0) if (epoch0 and t["recorded_at"]) else 0.0
    for e in events_out:
        e["sync_seconds"] = (e["absolute_time"] - epoch0) if (epoch0 and e["absolute_time"]) else e["start_seconds"]
    events_out.sort(key=lambda x: x["sync_seconds"] or 0)
    return {"case_id": case_id, "cameras": tracks_out, "events": events_out}


@router.post("/cases/{case_id}/report")
def case_report(case_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    report = ReportGenerator().generate_case_report(db, case)
    log_action(db, action="case.report", user=user, resource_type="case", resource_id=case_id)
    return report


@router.get("/reports/download")
def download_report(path: str, user: User = Depends(get_current_user)):
    p = Path(path).resolve()
    reports_root = (Path(settings.processed_dir) / "reports").resolve()
    try:
        p.relative_to(reports_root)
    except ValueError:
        raise HTTPException(403, "Forbidden path")
    if not p.is_file():
        raise HTTPException(404, "Report not found")
    return FileResponse(p)


# ── Evidence export ───────────────────────────────────────────────────────────

@router.post("/evidence/export", response_model=EvidenceExportResponse)
def export_evidence(
    body: EvidenceExportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    video = get_video(db, body.video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    row = EvidenceExporter().export_clip(
        db, video, body.start_seconds, body.end_seconds,
        case_id=body.case_id, exported_by=user.id,
    )
    log_action(
        db, action="evidence.export", user=user, resource_type="video", resource_id=video.id,
        details={"export_id": row.id, "sha256": row.sha256, "start": body.start_seconds, "end": body.end_seconds},
        ip_address=_ip(request),
    )
    return EvidenceExportResponse(
        id=row.id,
        video_id=row.video_id,
        sha256=row.sha256,
        clip_url=f"/api/evidence/{row.id}/clip",
        sidecar_url=f"/api/evidence/{row.id}/sidecar",
        start_seconds=row.start_seconds,
        end_seconds=row.end_seconds,
        created_at=row.created_at,
    )


@router.get("/evidence/{export_id}/clip")
def download_evidence_clip(export_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(EvidenceExport).filter(EvidenceExport.id == export_id).first()
    if not row or not Path(row.clip_path).is_file():
        raise HTTPException(404)
    log_action(db, action="evidence.download_clip", user=user, resource_type="evidence", resource_id=export_id)
    return FileResponse(row.clip_path, media_type="video/mp4", filename=Path(row.clip_path).name)


@router.get("/evidence/{export_id}/sidecar")
def download_evidence_sidecar(export_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(EvidenceExport).filter(EvidenceExport.id == export_id).first()
    if not row or not Path(row.sidecar_path).is_file():
        raise HTTPException(404)
    log_action(db, action="evidence.download_sidecar", user=user, resource_type="evidence", resource_id=export_id)
    return FileResponse(row.sidecar_path, media_type="application/json", filename=Path(row.sidecar_path).name)


# ── Redaction ─────────────────────────────────────────────────────────────────

@router.post("/videos/{video_id}/redact")
def redact_video(
    video_id: int,
    body: RedactionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.INVESTIGATOR, UserRole.ADMIN)),
):
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    path = RedactionService().redact_video(
        db, video,
        classes=body.classes,
        start_seconds=body.start_seconds or 0,
        end_seconds=body.end_seconds,
        track_ids=body.track_ids,
        exclude_track_ids=body.exclude_track_ids,
    )
    log_action(db, action="video.redact", user=user, resource_type="video", resource_id=video_id, details={"path": path})
    from urllib.parse import quote
    return {"filepath": path, "download_url": f"/api/files/download?path={quote(path)}"}


@router.get("/files/download")
def download_file(path: str, user: User = Depends(get_current_user)):
    resolved = Path(path).resolve()
    allowed_roots = [
        Path(settings.processed_dir).resolve(),
        Path(settings.upload_dir).resolve(),
    ]
    if not any(str(resolved).startswith(str(root) + "/") or resolved == root for root in allowed_roots):
        # Prefer is_relative_to when available
        ok = False
        for root in allowed_roots:
            try:
                resolved.relative_to(root)
                ok = True
                break
            except ValueError:
                continue
        if not ok:
            raise HTTPException(403, "Forbidden path")
    if not resolved.is_file():
        raise HTTPException(404)
    return FileResponse(resolved)


# ── Re-ID / similarity ────────────────────────────────────────────────────────

@router.get("/tracks/{track_db_id}/similar")
def similar_tracks(
    track_db_id: int,
    case_id: Optional[int] = None,
    min_score: float = 0.72,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    track = db.query(Track).filter(Track.id == track_db_id).first()
    if not track:
        raise HTTPException(404, "Track not found")
    video_ids = None
    if case_id:
        video_ids = [i.video_id for i in db.query(CaseItem).filter(CaseItem.case_id == case_id, CaseItem.video_id != None).all()]  # noqa: E711
    matches = suggest_matches(db, track, case_video_ids=video_ids, min_score=min_score)
    log_action(db, action="track.similarity_search", user=user, resource_type="track", resource_id=track_db_id)
    return {"query_track_id": track_db_id, "matches": matches}


@router.post("/reid/confirm")
def confirm_reid(body: ReIDConfirmRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    identity = assign_global_identity(db, body.track_db_ids, body.global_identity)
    log_action(db, action="reid.confirm", user=user, resource_type="identity", resource_id=identity, details={"tracks": body.track_db_ids})
    return {"global_identity": identity}


# ── Annotations / comments ────────────────────────────────────────────────────

@router.post("/annotations", response_model=AnnotationResponse)
def create_annotation(body: AnnotationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = Annotation(
        video_id=body.video_id,
        track_id=body.track_id,
        timestamp_seconds=body.timestamp_seconds,
        author_id=user.id,
        body=body.body,
        flag=body.flag,
        tags=body.tags,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(db, action="annotation.create", user=user, resource_type="annotation", resource_id=row.id)
    return row


@router.get("/videos/{video_id}/annotations", response_model=list[AnnotationResponse])
def list_annotations(video_id: int, db: Session = Depends(get_db)):
    return db.query(Annotation).filter(Annotation.video_id == video_id).order_by(Annotation.created_at.desc()).all()


@router.post("/comments", response_model=CommentResponse)
def create_comment(body: CommentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = Comment(
        video_id=body.video_id,
        track_db_id=body.track_db_id,
        case_id=body.case_id,
        author_id=user.id,
        body=body.body,
        mentions=body.mentions,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(db, action="comment.create", user=user, resource_type="comment", resource_id=row.id)
    return row


@router.get("/comments")
def list_comments(
    video_id: Optional[int] = None,
    case_id: Optional[int] = None,
    track_db_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Comment)
    if video_id:
        q = q.filter(Comment.video_id == video_id)
    if case_id:
        q = q.filter(Comment.case_id == case_id)
    if track_db_id:
        q = q.filter(Comment.track_db_id == track_db_id)
    rows = q.order_by(Comment.created_at.desc()).limit(200).all()
    return [
        {
            "id": r.id,
            "body": r.body,
            "video_id": r.video_id,
            "case_id": r.case_id,
            "track_db_id": r.track_db_id,
            "mentions": r.mentions,
            "author_id": r.author_id,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# ── Saved searches / alerts ───────────────────────────────────────────────────

@router.post("/saved-searches", response_model=SavedSearchResponse)
def create_saved_search(body: SavedSearchCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = SavedSearch(
        name=body.name,
        query=body.query,
        filters=body.filters,
        owner_id=user.id,
        is_alert=body.is_alert,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_action(db, action="saved_search.create", user=user, resource_type="saved_search", resource_id=row.id)
    return row


@router.get("/saved-searches", response_model=list[SavedSearchResponse])
def list_saved_searches(db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user_optional)):
    return db.query(SavedSearch).order_by(SavedSearch.created_at.desc()).all()


@router.post("/alerts/evaluate")
def evaluate_alerts(db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.ADMIN, UserRole.INVESTIGATOR))):
    """Run standing alerts against recent detections (proactive watch)."""
    from database.models import AlertStatus
    from search.nl_search import NaturalLanguageSearch

    alerts = db.query(SavedSearch).filter(SavedSearch.is_alert == True).all()  # noqa: E712
    nl = NaturalLanguageSearch()
    triggered = []
    for alert in alerts:
        if alert.alert_status and alert.alert_status.value == "paused":
            continue
        filters = dict(alert.filters or {})
        if alert.query:
            filters.update({k: v for k, v in nl.parse_query(alert.query).items() if v is not None})
        q = db.query(Detection).filter(Detection.is_false_positive.is_(False))
        if filters.get("object_class"):
            q = q.filter(Detection.object_class == filters["object_class"])
        if filters.get("color"):
            q = q.filter(Detection.dominant_color == filters["color"])
        if filters.get("min_confidence") is not None:
            q = q.filter(Detection.confidence >= float(filters["min_confidence"]))
        if filters.get("video_id"):
            q = q.filter(Detection.video_id == int(filters["video_id"]))
        # After-hours style: start_hour
        hits = q.order_by(Detection.id.desc()).limit(50).all()
        if hits:
            alert.last_triggered_at = datetime.utcnow()
            alert.alert_status = AlertStatus.TRIGGERED
            db.add(alert)
            triggered.append({"alert_id": alert.id, "name": alert.name, "hit_count": len(hits)})
    db.commit()
    log_action(db, action="alerts.evaluate", user=user, details={"triggered": len(triggered)})
    return {"triggered": triggered}


# ── Faceted search ────────────────────────────────────────────────────────────

@router.post("/search/faceted")
def faceted_search(
    body: FacetedSearchRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    from search.nl_search import NaturalLanguageSearch

    filters = {}
    if body.query:
        filters.update(NaturalLanguageSearch().parse_query(body.query))
    if body.object_class:
        filters["object_class"] = body.object_class
    if body.color:
        filters["color"] = body.color
    if body.camera_code:
        filters["camera_code"] = body.camera_code
    min_conf = body.min_confidence if body.min_confidence is not None else 0.0

    q = db.query(Detection).filter(Detection.is_false_positive.is_(False), Detection.confidence >= min_conf)
    if body.video_id:
        q = q.filter(Detection.video_id == body.video_id)
    if body.case_id:
        vids = [i.video_id for i in db.query(CaseItem).filter(CaseItem.case_id == body.case_id).all() if i.video_id]
        q = q.filter(Detection.video_id.in_(vids or [-1]))
    if filters.get("object_class"):
        q = q.filter(Detection.object_class == filters["object_class"])
    if filters.get("color"):
        q = q.filter(Detection.dominant_color == filters["color"])
    if body.start_seconds is not None:
        q = q.filter(Detection.timestamp_seconds >= body.start_seconds)
    if body.end_seconds is not None:
        q = q.filter(Detection.timestamp_seconds <= body.end_seconds)
    if body.camera_code:
        vids = [v.id for v in db.query(Video).filter(Video.camera_code == body.camera_code).all()]
        q = q.filter(Detection.video_id.in_(vids or [-1]))

    rows = q.order_by(Detection.timestamp_seconds).limit(body.limit or 200).all()

    # Facet counts
    facet_q = db.query(Detection).filter(Detection.is_false_positive.is_(False))
    if body.video_id:
        facet_q = facet_q.filter(Detection.video_id == body.video_id)
    all_for_facets = facet_q.limit(5000).all()
    classes: dict[str, int] = {}
    colors: dict[str, int] = {}
    for d in all_for_facets:
        classes[d.object_class] = classes.get(d.object_class, 0) + 1
        if d.dominant_color:
            colors[d.dominant_color] = colors.get(d.dominant_color, 0) + 1

    results = []
    seen = set()
    for d in rows:
        key = (d.video_id, d.track_id, round(d.timestamp_seconds, 1))
        if key in seen:
            continue
        seen.add(key)
        v = get_video(db, d.video_id)
        results.append({
            "video_id": d.video_id,
            "camera_code": v.camera_code if v else None,
            "filename": v.original_filename if v else None,
            "timestamp_seconds": d.timestamp_seconds,
            "timestamp": format_timestamp(d.timestamp_seconds),
            "object_class": d.object_class,
            "track_id": d.track_id,
            "color": d.dominant_color,
            "confidence": d.confidence,
            "description": f"{d.object_class} #{d.track_id or '?'} ({d.dominant_color or 'n/a'}) at {format_timestamp(d.timestamp_seconds)} conf={d.confidence:.2f}",
            "match_reason": {
                "attributes": [x for x in [filters.get("object_class"), filters.get("color")] if x],
                "confidence_threshold": min_conf,
                "frame_number": d.frame_number,
            },
            "source": "faceted",
        })

    log_action(
        db, action="search.faceted", user=user, resource_type="search",
        details={"query": body.query, "filters": filters, "result_count": len(results)},
        ip_address=_ip(request),
    )
    return {
        "query": body.query,
        "filters": {**filters, "min_confidence": min_conf, "camera_code": body.camera_code},
        "facets": {"object_class": classes, "color": colors},
        "results": results,
    }


# ── False positives / confidence ──────────────────────────────────────────────

@router.post("/detections/{detection_id}/false-positive")
def flag_false_positive(
    detection_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    d = db.query(Detection).filter(Detection.id == detection_id).first()
    if not d:
        raise HTTPException(404)
    d.is_false_positive = True
    d.false_positive_reason = reason
    db.add(d)
    db.commit()
    log_action(db, action="flag_false_positive", user=user, resource_type="detection", resource_id=detection_id, details={"reason": reason})
    return {"ok": True}


@router.post("/videos/{video_id}/tracks/{track_id}/false-positive")
def flag_track_false_positive(
    video_id: int,
    track_id: int,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Detection).filter(Detection.video_id == video_id, Detection.track_id == track_id)
    rows = q.all()
    if not rows:
        raise HTTPException(404, "No detections for track")
    for d in rows:
        d.is_false_positive = True
        d.false_positive_reason = reason
        db.add(d)
    db.commit()
    log_action(
        db, action="flag_false_positive", user=user, resource_type="track",
        resource_id=track_id, details={"video_id": video_id, "reason": reason, "count": len(rows)},
    )
    return {"ok": True, "flagged": len(rows)}


# ── Batch upload ──────────────────────────────────────────────────────────────

@router.post("/videos/batch-upload")
async def batch_upload(
    background_tasks: BackgroundTasks,
    request: Request,
    files: list[UploadFile] = File(...),
    case_id: Optional[int] = Form(None),
    camera_codes: Optional[str] = Form(None),  # comma-separated matching file order
    retention_days: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    from app import _run_processing

    batch_id = uuid.uuid4().hex
    codes = [c.strip() for c in (camera_codes or "").split(",")] if camera_codes else []
    created = []
    upload_root = Path(settings.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)

    for i, f in enumerate(files):
        ext = Path(f.filename or "video.mp4").suffix or ".mp4"
        stored = f"{uuid.uuid4().hex}{ext}"
        dest = upload_root / stored
        with open(dest, "wb") as out:
            shutil.copyfileobj(f.file, out)
        digest = sha256_file(dest)
        cam_code = codes[i] if i < len(codes) and codes[i] else None
        camera = db.query(Camera).filter(Camera.camera_code == cam_code).first() if cam_code else None
        video = create_video(
            db,
            filename=stored,
            original_filename=f.filename or stored,
            filepath=str(dest),
            owner_id=user.id if user else None,
        )
        video.file_sha256 = digest
        video.batch_id = batch_id
        video.camera_code = cam_code
        if camera:
            video.camera_id = camera.id
        db.add(video)
        db.commit()
        db.refresh(video)
        apply_retention_on_upload(db, video, retention_days)
        if case_id:
            db.add(CaseItem(case_id=case_id, item_type="video", video_id=video.id, meta={"batch_id": batch_id}))
            db.commit()
        job = create_processing_job(db, video.id)
        background_tasks.add_task(_run_processing, video.id, job.id)
        created.append({"video_id": video.id, "filename": video.original_filename, "sha256": digest, "camera_code": cam_code})

    log_action(db, action="video.batch_upload", user=user, details={"batch_id": batch_id, "count": len(created)}, ip_address=_ip(request))
    return {"batch_id": batch_id, "videos": created}


# ── Live RTSP registration ────────────────────────────────────────────────────

@router.post("/cameras/{camera_id}/live")
def enable_live(camera_id: int, rtsp_url: str = Form(...), db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.ADMIN, UserRole.INVESTIGATOR))):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(404)
    cam.rtsp_url = rtsp_url
    cam.is_live = True
    db.add(cam)
    db.commit()
    log_action(db, action="camera.live_enable", user=user, resource_type="camera", resource_id=camera_id)
    return {"ok": True, "camera_id": camera_id, "is_live": True, "note": "RTSP URL stored. Snapshot ingestion can be polled via /api/cameras/{id}/snapshot."}


@router.post("/cameras/{camera_id}/snapshot")
def live_snapshot(camera_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.INVESTIGATOR, UserRole.ADMIN))):
    """Grab a short sample from RTSP and enqueue as a video for analysis."""
    import cv2
    from app import _run_processing

    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam or not cam.rtsp_url:
        raise HTTPException(400, "Camera has no RTSP URL")
    out = Path(settings.upload_dir) / f"live_{camera_id}_{uuid.uuid4().hex}.mp4"
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(cam.rtsp_url)
    if not cap.isOpened():
        raise HTTPException(502, "Cannot open RTSP stream")
    fps = cap.get(cv2.CAP_PROP_FPS) or 10
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*"mp4v"), float(fps), (w, h))
    for _ in range(int(fps * 8)):
        ret, frame = cap.read()
        if not ret:
            break
        writer.write(frame)
    cap.release()
    writer.release()
    digest = sha256_file(out)
    video = create_video(db, filename=out.name, original_filename=f"LIVE_{cam.camera_code}.mp4", filepath=str(out), owner_id=user.id)
    video.file_sha256 = digest
    video.camera_id = cam.id
    video.camera_code = cam.camera_code
    video.recorded_at = datetime.utcnow()
    db.add(video)
    db.commit()
    db.refresh(video)
    apply_retention_on_upload(db, video)
    job = create_processing_job(db, video.id)
    background_tasks.add_task(_run_processing, video.id, job.id)
    log_action(db, action="camera.snapshot", user=user, resource_type="camera", resource_id=camera_id, details={"video_id": video.id})
    return {"video_id": video.id, "job_id": job.id}


# ── Retention ─────────────────────────────────────────────────────────────────

@router.get("/retention")
def get_retention(db: Session = Depends(get_db)):
    return get_or_create_policy(db)


@router.put("/retention")
def update_retention(body: RetentionPolicyUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.ADMIN))):
    pol = get_or_create_policy(db)
    if body.retention_days is not None:
        pol.retention_days = body.retention_days
    if body.auto_delete is not None:
        pol.auto_delete = body.auto_delete
    db.add(pol)
    db.commit()
    db.refresh(pol)
    log_action(db, action="retention.update", user=user, details={"days": pol.retention_days, "auto_delete": pol.auto_delete})
    return pol


@router.post("/retention/run")
def run_retention(db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.ADMIN))):
    result = run_retention_cleanup(db)
    log_action(db, action="retention.cleanup", user=user, details=result)
    return result


# ── Roles ─────────────────────────────────────────────────────────────────────

@router.patch("/users/{user_id}/role")
def set_role(user_id: int, role: UserRole, db: Session = Depends(get_db), admin: User = Depends(require_roles(UserRole.ADMIN))):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404)
    u.role = role
    db.add(u)
    db.commit()
    log_action(db, action="user.role_change", user=admin, resource_type="user", resource_id=user_id, details={"role": role.value})
    return {"id": u.id, "username": u.username, "role": u.role.value}
