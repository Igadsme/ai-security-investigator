"""Case investigation report generation (Markdown + HTML package)."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from config import settings
from database.models import Annotation, Case, CaseItem, Track, Video


class ReportGenerator:
    def __init__(self):
        self.out_dir = Path(settings.processed_dir) / "reports"
        self.out_dir.mkdir(parents=True, exist_ok=True)

    def generate_case_report(self, db: Session, case: Case) -> dict:
        items = db.query(CaseItem).filter(CaseItem.case_id == case.id).all()
        video_ids = [i.video_id for i in items if i.video_id]
        videos = db.query(Video).filter(Video.id.in_(video_ids)).all() if video_ids else []
        annotations = (
            db.query(Annotation).filter(Annotation.video_id.in_(video_ids)).all()
            if video_ids else []
        )

        lines = [
            f"# Investigation Report — {case.title}",
            "",
            f"- **Case ID:** {case.id}",
            f"- **Status:** {case.status.value if hasattr(case.status, 'value') else case.status}",
            f"- **Generated:** {datetime.utcnow().isoformat()}Z",
            f"- **Description:** {case.description or '—'}",
            "",
            "## Notes",
            case.notes or "_No case notes._",
            "",
            "## Footage sources",
        ]
        for v in videos:
            lines.append(
                f"- **V{v.id}** `{v.original_filename}` camera=`{v.camera_code or 'n/a'}` "
                f"sha256=`{(v.file_sha256 or 'n/a')[:16]}…` status={v.status.value if hasattr(v.status,'value') else v.status}"
            )

        lines += ["", "## Key tracks"]
        for v in videos:
            tracks = db.query(Track).filter(Track.video_id == v.id).order_by(Track.track_id).limit(30).all()
            for t in tracks:
                lines.append(
                    f"- V{v.id} Track №{t.track_id} {t.object_class} "
                    f"color={t.dominant_color or 'n/a'} "
                    f"{t.first_seen_seconds:.1f}s–{t.last_seen_seconds:.1f}s "
                    f"gid={t.global_identity or '—'}"
                )

        lines += ["", "## Investigator annotations"]
        if not annotations:
            lines.append("_None._")
        for a in annotations:
            lines.append(
                f"- V{a.video_id} t={a.timestamp_seconds} track={a.track_id} "
                f"flag={a.flag or '—'} — {a.body}"
            )

        md = "\n".join(lines) + "\n"
        stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        md_path = self.out_dir / f"case_{case.id}_report_{stamp}.md"
        html_path = self.out_dir / f"case_{case.id}_report_{stamp}.html"
        md_path.write_text(md, encoding="utf-8")
        html = (
            "<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<title>Case {case.id} Report</title>"
            "<style>body{font-family:IBM Plex Sans,system-ui,sans-serif;max-width:860px;margin:40px auto;color:#12201E}"
            "code{background:#E7EBEA;padding:2px 6px;border-radius:4px}</style></head><body>"
            + md.replace("\n", "<br/>").replace("# ", "<h1>").replace("## ", "<h2>")
            + "</body></html>"
        )
        html_path.write_text(html, encoding="utf-8")
        return {
            "case_id": case.id,
            "markdown_path": str(md_path),
            "html_path": str(html_path),
            "download_url": f"/api/reports/download?path={html_path}",
            "markdown": md,
        }
