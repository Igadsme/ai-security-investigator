export type ObjectClass = 'person' | 'car' | 'truck' | 'bike' | 'dog' | 'bag';

export type ActivityAction = 'entry' | 'exit' | 'loitering' | 'running' | 'left_object' | 'stationary' | 'passing';

export type UserRole = 'viewer' | 'investigator' | 'admin';

export interface BoundingBox {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  w: number; // percentage 0-100
  h: number; // percentage 0-100
}

export interface DetectionPoint {
  timeSeconds: number;
  box: BoundingBox;
  confidence: number;
  action: ActivityAction;
  actionDetails?: string;
  speedPxPerSec?: number;
  color?: string;
}

export interface TrackedSubject {
  id: string; // e.g. "Person #1" or "Vehicle #4"
  dbId?: number;
  trackId?: number;
  targetClass: ObjectClass;
  camera: string;
  color: string;
  firstSeenSec: number;
  lastSeenSec: number;
  confidence: number;
  isFalsePositive?: boolean;
  falsePositiveReason?: string;
  notes?: string;
  points: DetectionPoint[];
  crossCameraReId?: {
    globalSubjectId: string;
    aliasName?: string;
    linkedTracks: { camera: string; trackId: string; timeRange: string }[];
  };
}

export interface ActivityEvent {
  id: string;
  timestamp: string; // "00:01:24"
  timeSeconds: number;
  camera: string;
  trackId: string;
  targetClass: ObjectClass;
  action: ActivityAction;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  thumbnailUrl?: string;
  verified?: boolean;
}

export interface CameraMeta {
  id: string;
  dbId?: number;
  name: string;
  cameraCode?: string;
  location: string;
  zone: string;
  resolution: string;
  fps: number;
  status: 'online' | 'recorded' | 'maintenance';
  mapCoords: { x: number; y: number; angle: number; fov: number };
  rtspUrl?: string;
}

export interface VideoClip {
  id: string;
  videoId?: number;
  title: string;
  filename: string;
  fileSizeMb: number;
  durationSeconds: number;
  camera: string;
  recordedAt: string;
  videoUrl?: string;
  isCustomUpload?: boolean;
  sha256: string;
  tracks: TrackedSubject[];
  events: ActivityEvent[];
  status?: string;
  width?: number;
  height?: number;
  job?: { status?: string; progress?: number; stage?: string } | null;
}

export interface CaseNote {
  id: string;
  author: string;
  timestampSec: number;
  createdAt: string;
  text: string;
  camera: string;
  tags: string[];
}

export type InvestigatorNote = CaseNote;

export interface CaseData {
  id: string;
  dbId?: number;
  caseNumber: string;
  title: string;
  description: string;
  status: 'open' | 'under_review' | 'closed' | 'exported';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedInvestigator: string;
  createdAt: string;
  incidentTime: string;
  cameras: CameraMeta[];
  clips: VideoClip[];
  notes: CaseNote[];
  auditLogs: AuditLogEntry[];
  standingAlerts: StandingAlert[];
}

export interface StandingAlert {
  id: string;
  name: string;
  targetClass: ObjectClass | 'any';
  camera: string | 'all';
  action: ActivityAction | 'any';
  color?: string;
  timeWindow?: { start: string; end: string };
  minConfidence: number;
  enabled: boolean;
  createdAt: string;
  triggeredCount: number;
  lastTriggered?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  investigator: string;
  actionType: 'upload' | 'view' | 'search' | 'flag_false_positive' | 'add_note' | 'export_evidence' | 'redact' | 'alert_created' | 'sha_verified';
  details: string;
  sha256Proof?: string;
  ipAddress?: string;
}

export interface SearchFilterState {
  query: string;
  selectedClasses: ObjectClass[];
  selectedColors: string[];
  selectedCameras: string[];
  selectedActions: ActivityAction[];
  minConfidence: number;
  timeRange: [number, number]; // [minSec, maxSec]
}

export interface SearchResultMatch {
  id: string;
  trackId: string;
  targetClass: ObjectClass;
  camera: string;
  timeSeconds: number;
  timestamp: string;
  confidence: number;
  action: ActivityAction;
  color: string;
  reason: string;
  box: BoundingBox;
}

export interface ExportManifest {
  caseNumber: string;
  caseTitle: string;
  exportTimestamp: string;
  exportedBy: string;
  clipsExported: {
    filename: string;
    camera: string;
    sha256: string;
    duration: number;
    inPointSec?: number;
    outPointSec?: number;
  }[];
  tracksTotal: number;
  eventsTotal: number;
  sha256PackageSeal: string;
  digitalSignature: string;
  redacted: boolean;
  evidenceItems: {
    type: string;
    description: string;
    timestamp: string;
    hash: string;
  }[];
}
