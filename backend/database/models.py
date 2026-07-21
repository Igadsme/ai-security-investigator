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


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    videos = relationship("Video", back_populates="owner")


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(512), nullable=False)
    original_filename = Column(String(512), nullable=False)
    filepath = Column(String(1024), nullable=False)
    duration_seconds = Column(Float, nullable=True)
    fps = Column(Float, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    frame_count = Column(Integer, nullable=True)
    status = Column(Enum(VideoStatus), default=VideoStatus.UPLOADED)
    error_message = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="videos")
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
