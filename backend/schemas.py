from datetime import datetime
from typing import Any, Optional

from pydantic import AliasChoices, BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6)


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    role: Any = "investigator"
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
    camera_id: Optional[int] = None
    camera_code: Optional[str] = None
    file_sha256: Optional[str] = None
    batch_id: Optional[str] = None
    retention_days: Optional[int] = None
    delete_after: Optional[datetime] = None
    recorded_at: Optional[datetime] = None
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
    is_false_positive: bool = False

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
    global_identity: Optional[str] = None

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


class SiteCreate(BaseModel):
    name: str
    description: Optional[str] = None
    floor_plan_url: Optional[str] = None
    map_bounds: Optional[dict] = None


class SiteResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    floor_plan_url: Optional[str] = None
    map_bounds: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CameraCreate(BaseModel):
    camera_code: str
    name: str
    site_id: Optional[int] = None
    location_label: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    floor_x: Optional[float] = Field(None, validation_alias=AliasChoices("floor_x", "pos_x"))
    floor_y: Optional[float] = Field(None, validation_alias=AliasChoices("floor_y", "pos_y"))
    rtsp_url: Optional[str] = None

    model_config = {"populate_by_name": True}


class CameraResponse(BaseModel):
    id: int
    camera_code: str
    name: str
    site_id: Optional[int] = None
    location_label: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    floor_x: Optional[float] = None
    floor_y: Optional[float] = None
    rtsp_url: Optional[str] = None
    is_live: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    notes: Optional[str] = None
    site_id: Optional[int] = None
    video_ids: Optional[list[int]] = None


class CaseResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: Any
    notes: Optional[str] = None
    site_id: Optional[int] = None
    owner_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EvidenceExportRequest(BaseModel):
    video_id: int
    start_seconds: float
    end_seconds: float
    case_id: Optional[int] = None


class EvidenceExportResponse(BaseModel):
    id: int
    video_id: int
    sha256: str
    clip_url: str
    sidecar_url: str
    start_seconds: float
    end_seconds: float
    created_at: datetime


class RedactionRequest(BaseModel):
    classes: Optional[list[str]] = None
    start_seconds: Optional[float] = 0
    end_seconds: Optional[float] = None
    track_ids: Optional[list[int]] = None
    exclude_track_ids: Optional[list[int]] = None


class AnnotationCreate(BaseModel):
    video_id: int
    body: str
    track_id: Optional[int] = None
    timestamp_seconds: Optional[float] = None
    flag: Optional[str] = None


class AnnotationResponse(BaseModel):
    id: int
    video_id: int
    track_id: Optional[int] = None
    timestamp_seconds: Optional[float] = None
    author_id: Optional[int] = None
    body: str
    flag: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    body: str
    video_id: Optional[int] = None
    case_id: Optional[int] = None
    track_db_id: Optional[int] = None
    mentions: Optional[list[str]] = None


class CommentResponse(BaseModel):
    id: int
    body: str
    video_id: Optional[int] = None
    case_id: Optional[int] = None
    track_db_id: Optional[int] = None
    author_id: Optional[int] = None
    mentions: Optional[list] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SavedSearchCreate(BaseModel):
    name: str
    query: Optional[str] = None
    filters: Optional[dict] = None
    is_alert: bool = False


class SavedSearchResponse(BaseModel):
    id: int
    name: str
    query: Optional[str] = None
    filters: Optional[dict] = None
    is_alert: bool
    alert_status: Optional[Any] = None
    last_triggered_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FacetedSearchRequest(BaseModel):
    query: Optional[str] = None
    video_id: Optional[int] = None
    case_id: Optional[int] = None
    object_class: Optional[str] = None
    color: Optional[str] = None
    camera_code: Optional[str] = None
    min_confidence: Optional[float] = 0.4
    start_seconds: Optional[float] = None
    end_seconds: Optional[float] = None
    limit: Optional[int] = 200


class ReIDConfirmRequest(BaseModel):
    track_db_ids: list[int]
    global_identity: Optional[str] = None


class RetentionPolicyUpdate(BaseModel):
    retention_days: Optional[int] = None
    auto_delete: Optional[bool] = None
