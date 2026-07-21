import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class VideoStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ActivityType(str, enum.Enum):
    LOITERING = "loitering"
    RUNNING = "running"
    ABANDONED_OBJECT = "abandoned_object"
    TRESPASSING = "trespassing"
    ENTRY = "entry"
    EXIT = "exit"
    VEHICLE_ARRIVAL = "vehicle_arrival"
    VEHICLE_DEPARTURE = "vehicle_departure"


class UserRole(str, enum.Enum):
    VIEWER = "viewer"
    INVESTIGATOR = "investigator"
    ADMIN = "admin"


class CaseStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    ARCHIVED = "archived"


class AlertStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    TRIGGERED = "triggered"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.INVESTIGATOR)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    videos = relationship("Video", back_populates="owner")
    audit_logs = relationship("AuditLog", back_populates="user")
    cases = relationship("Case", back_populates="owner")
    annotations = relationship("Annotation", back_populates="author")
    comments = relationship("Comment", back_populates="author")


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    floor_plan_url = Column(String(1024), nullable=True)
    map_bounds = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cameras = relationship("Camera", back_populates="site", cascade="all, delete-orphan")


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    camera_code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    location_label = Column(String(255), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    floor_x = Column(Float, nullable=True)
    floor_y = Column(Float, nullable=True)
    rtsp_url = Column(String(1024), nullable=True)
    is_live = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    site = relationship("Site", back_populates="cameras")
    videos = relationship("Video", back_populates="camera")


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(512), nullable=False)
    original_filename = Column(String(512), nullable=False)
    filepath = Column(String(1024), nullable=False)
    file_sha256 = Column(String(64), nullable=True, index=True)
    duration_seconds = Column(Float, nullable=True)
    fps = Column(Float, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    frame_count = Column(Integer, nullable=True)
    status = Column(Enum(VideoStatus), default=VideoStatus.UPLOADED)
    error_message = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=True, index=True)
    camera_code = Column(String(100), nullable=True, index=True)
    recorded_at = Column(DateTime, nullable=True)
    retention_days = Column(Integer, nullable=True)
    delete_after = Column(DateTime, nullable=True, index=True)
    batch_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="videos")
    camera = relationship("Camera", back_populates="videos")
    detections = relationship("Detection", back_populates="video", cascade="all, delete-orphan")
    tracks = relationship("Track", back_populates="video", cascade="all, delete-orphan")
    activity_events = relationship("ActivityEvent", back_populates="video", cascade="all, delete-orphan")
    jobs = relationship("ProcessingJob", back_populates="video", cascade="all, delete-orphan")


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    frame_number = Column(Integer, nullable=False)
    timestamp_seconds = Column(Float, nullable=False)
    object_class = Column(String(100), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    bbox_x1 = Column(Float, nullable=False)
    bbox_y1 = Column(Float, nullable=False)
    bbox_x2 = Column(Float, nullable=False)
    bbox_y2 = Column(Float, nullable=False)
    track_id = Column(Integer, nullable=True, index=True)
    dominant_color = Column(String(50), nullable=True)
    is_false_positive = Column(Boolean, default=False)
    extra_metadata = Column(JSON, nullable=True)

    video = relationship("Video", back_populates="detections")


class Track(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    track_id = Column(Integer, nullable=False, index=True)
    object_class = Column(String(100), nullable=False)
    first_seen_seconds = Column(Float, nullable=False)
    last_seen_seconds = Column(Float, nullable=False)
    frame_count = Column(Integer, default=0)
    dominant_color = Column(String(50), nullable=True)
    is_unique_person = Column(Boolean, default=False)
    appearance_vector = Column(JSON, nullable=True)
    global_identity = Column(String(64), nullable=True, index=True)

    video = relationship("Video", back_populates="tracks")


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    activity_type = Column(Enum(ActivityType), nullable=False)
    description = Column(Text, nullable=False)
    start_seconds = Column(Float, nullable=False)
    end_seconds = Column(Float, nullable=True)
    track_id = Column(Integer, nullable=True)
    object_class = Column(String(100), nullable=True)
    severity = Column(String(20), default="info")
    extra_metadata = Column(JSON, nullable=True)

    video = relationship("Video", back_populates="activity_events")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    status = Column(String(50), default="pending")
    progress = Column(Float, default=0.0)
    stage = Column(String(100), default="queued")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    video = relationship("Video", back_populates="jobs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=True, index=True)
    resource_id = Column(String(100), nullable=True, index=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="audit_logs")


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(CaseStatus), default=CaseStatus.OPEN)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="cases")
    items = relationship("CaseItem", back_populates="case", cascade="all, delete-orphan")


class CaseItem(Base):
    __tablename__ = "case_items"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    item_type = Column(String(50), nullable=False)  # video|clip|search|note|export
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=True)
    reference = Column(String(512), nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="items")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    track_id = Column(Integer, nullable=True, index=True)
    timestamp_seconds = Column(Float, nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    body = Column(Text, nullable=False)
    flag = Column(String(50), nullable=True)  # suspect|person_of_interest|cleared
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User", back_populates="annotations")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=True, index=True)
    track_db_id = Column(Integer, ForeignKey("tracks.id"), nullable=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    body = Column(Text, nullable=False)
    mentions = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User", back_populates="comments")


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    query = Column(String(1024), nullable=True)
    filters = Column(JSON, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_alert = Column(Boolean, default=False)
    alert_status = Column(Enum(AlertStatus), default=AlertStatus.ACTIVE)
    last_triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EvidenceExport(Base):
    __tablename__ = "evidence_exports"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    exported_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    clip_path = Column(String(1024), nullable=False)
    sidecar_path = Column(String(1024), nullable=False)
    sha256 = Column(String(64), nullable=False)
    start_seconds = Column(Float, nullable=False)
    end_seconds = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReIDMatch(Base):
    __tablename__ = "reid_matches"
    __table_args__ = (UniqueConstraint("track_a_id", "track_b_id", name="uq_reid_pair"),)

    id = Column(Integer, primary_key=True, index=True)
    track_a_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, index=True)
    track_b_id = Column(Integer, ForeignKey("tracks.id"), nullable=False, index=True)
    score = Column(Float, nullable=False)
    reason = Column(JSON, nullable=True)
    confirmed = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RetentionPolicy(Base):
    __tablename__ = "retention_policies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, default="default")
    retention_days = Column(Integer, nullable=False, default=90)
    auto_delete = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
