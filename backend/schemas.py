from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6)


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class VideoResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    status: str
    duration_seconds: Optional[float] = None
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    frame_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProcessingJobResponse(BaseModel):
    id: int
    video_id: int
    status: str
    progress: float
    stage: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class DetectionResponse(BaseModel):
    id: int
    frame_number: int
    timestamp_seconds: float
    timestamp: str
    object_class: str
    confidence: float
    track_id: Optional[int] = None
    dominant_color: Optional[str] = None
    bbox: dict

    class Config:
        from_attributes = True


class TrackResponse(BaseModel):
    id: int
    track_id: int
    object_class: str
    first_seen_seconds: float
    last_seen_seconds: float
    first_seen: str
    last_seen: str
    frame_count: int
    dominant_color: Optional[str] = None
    is_unique_person: bool

    class Config:
        from_attributes = True


class ActivityEventResponse(BaseModel):
    id: int
    activity_type: str
    description: str
    start_seconds: float
    end_seconds: Optional[float] = None
    start_time: str
    end_time: Optional[str] = None
    track_id: Optional[int] = None
    object_class: Optional[str] = None
    severity: str

    class Config:
        from_attributes = True


class SearchRequest(BaseModel):
    query: str
    video_id: Optional[int] = None


class SearchResultItem(BaseModel):
    timestamp_seconds: float
    timestamp: str
    object_class: Optional[str] = None
    track_id: Optional[int] = None
    color: Optional[str] = None
    description: str
    activity_type: Optional[str] = None
    confidence: Optional[float] = None
    source: str = "database"


class SearchResponse(BaseModel):
    query: str
    parsed_filters: dict
    results: list[SearchResultItem]
    unique_count: Optional[int] = None
    summary: Optional[str] = None


class SummaryRequest(BaseModel):
    video_id: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class SummaryResponse(BaseModel):
    video_id: int
    time_range: Optional[str] = None
    stats: dict[str, Any]
    events: list[dict]
    summary: str


class ClipRequest(BaseModel):
    video_id: int
    start_seconds: float
    end_seconds: float


class ClipResponse(BaseModel):
    clip_url: str
    filename: str
    start_seconds: float
    end_seconds: float


class StatsResponse(BaseModel):
    video_id: int
    total_detections: int
    unique_tracks: dict[str, int]
    unique_people: int
    activity_count: int
    peak_activity_timestamp: Optional[str] = None
