import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      const url = String(error?.config?.url || "");
      const onAuthPage = window.location.pathname.startsWith("/login");
      const isAuthEndpoint =
        url.includes("/api/auth/login") || url.includes("/api/auth/register");
      // Only force re-login for protected calls when a token was sent (stale session)
      const hadToken = Boolean(localStorage.getItem("token"));
      if (hadToken && !onAuthPage && !isAuthEndpoint) {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);

export interface Video {
  id: number;
  filename: string;
  original_filename: string;
  status: string;
  duration_seconds?: number;
  fps?: number;
  created_at: string;
  processed_at?: string;
  error_message?: string;
  file_sha256?: string;
  camera_code?: string;
  camera_id?: number;
  batch_id?: string;
  retention_days?: number;
  delete_after?: string;
  recorded_at?: string;
}

export interface ProcessingJob {
  id: number;
  video_id: number;
  status: string;
  progress: number;
  stage: string;
}

export interface Detection {
  id: number;
  timestamp: string;
  timestamp_seconds: number;
  object_class: string;
  confidence: number;
  track_id?: number;
  dominant_color?: string;
  is_false_positive?: boolean;
}

export interface Track {
  id: number;
  track_id: number;
  object_class: string;
  first_seen: string;
  last_seen: string;
  first_seen_seconds?: number;
  last_seen_seconds?: number;
  frame_count: number;
  dominant_color?: string;
  is_unique_person: boolean;
  global_identity?: string;
}

export interface ActivityEvent {
  id: number;
  activity_type: string;
  description: string;
  start_time: string;
  end_time?: string;
  start_seconds: number;
  end_seconds?: number;
  track_id?: number;
  severity: string;
}

export interface SearchResult {
  query: string;
  parsed_filters: Record<string, unknown>;
  results: Array<{
    timestamp: string;
    timestamp_seconds: number;
    description: string;
    object_class?: string;
    track_id?: number;
    color?: string;
    confidence?: number;
    source: string;
    video_id?: number;
  }>;
  unique_count?: number;
  summary?: string;
  facets?: {
    classes?: Record<string, number>;
    colors?: Record<string, number>;
    cameras?: Record<string, number>;
  };
}

export interface Stats {
  total_detections: number;
  unique_tracks: Record<string, number>;
  unique_people: number;
  activity_count: number;
  peak_activity_timestamp?: string;
}

export interface Case {
  id: number;
  title: string;
  description?: string;
  status: string;
  notes?: string;
  site_id?: number;
  owner_id?: number;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  username?: string;
  action: string;
  resource_type?: string;
  resource_id?: number;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface Site {
  id: number;
  name: string;
  description?: string;
  floor_plan_url?: string;
  map_bounds?: Record<string, number>;
}

export interface Camera {
  id: number;
  site_id: number;
  camera_code: string;
  name: string;
  location_label?: string;
  pos_x?: number;
  pos_y?: number;
  floor_x?: number;
  floor_y?: number;
  latitude?: number;
  longitude?: number;
  is_live?: boolean;
  rtsp_url?: string;
}

export interface Annotation {
  id: number;
  video_id: number;
  track_id?: number;
  timestamp_seconds?: number;
  author_id?: number;
  body: string;
  flag?: string;
  created_at?: string;
}

export interface Comment {
  id: number;
  body: string;
  video_id?: number;
  case_id?: number;
  track_db_id?: number;
  mentions?: string[];
  author_id?: number;
  created_at: string;
}

export interface SavedSearch {
  id: number;
  name: string;
  query?: string;
  filters?: Record<string, unknown>;
  is_alert: boolean;
  alert_status?: string;
  last_triggered_at?: string;
  created_at: string;
}

export interface EvidenceExport {
  id: number;
  video_id: number;
  sha256: string;
  clip_url: string;
  sidecar_url: string;
  start_seconds: number;
  end_seconds: number;
  created_at: string;
}

export interface SimilarMatch {
  track_db_id: number;
  track_id: number;
  video_id: number;
  object_class: string;
  score: number;
  first_seen?: string;
  last_seen?: string;
  dominant_color?: string;
  global_identity?: string;
}

export const authApi = {
  register: (email: string, username: string, password: string) =>
    api.post("/api/auth/register", { email, username, password }),
  login: (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    return api.post("/api/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },
  me: () => api.get<{ id: number; email: string; username: string; role: string }>("/api/auth/me"),
};

export const videoApi = {
  upload: (
    file: File,
    opts?: {
      onProgress?: (pct: number) => void;
      camera_code?: string;
      retention_days?: number;
      case_id?: number;
    }
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (opts?.camera_code) form.append("camera_code", opts.camera_code);
    if (opts?.retention_days != null) form.append("retention_days", String(opts.retention_days));
    if (opts?.case_id != null) form.append("case_id", String(opts.case_id));
    return api.post<Video>("/api/videos/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (opts?.onProgress && e.total) {
          opts.onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
  list: () => api.get<Video[]>("/api/videos"),
  get: (id: number) => api.get<Video>(`/api/videos/${id}`),
  getJob: (id: number) => api.get<ProcessingJob>(`/api/videos/${id}/job`),
  getDetections: (id: number) => api.get<Detection[]>(`/api/videos/${id}/detections`),
  getTracks: (id: number) => api.get<Track[]>(`/api/videos/${id}/tracks`),
  getEvents: (id: number) => api.get<ActivityEvent[]>(`/api/videos/${id}/events`),
  getStats: (id: number) => api.get<Stats>(`/api/videos/${id}/stats`),
  streamUrl: (id: number) => `${API_URL}/api/videos/${id}/stream`,
  reprocess: (id: number) => api.post(`/api/videos/${id}/reprocess`),
};

export const searchApi = {
  query: (query: string, videoId?: number) =>
    api.post<SearchResult>("/api/search", { query, video_id: videoId }),
  faceted: (body: {
    query?: string;
    video_id?: number;
    case_id?: number;
    object_class?: string;
    color?: string;
    camera_code?: string;
    min_confidence?: number;
    start_seconds?: number;
    end_seconds?: number;
    limit?: number;
  }) => api.post<SearchResult>("/api/search/faceted", body),
  summary: (videoId: number, startTime?: string, endTime?: string) =>
    api.post("/api/summary", {
      video_id: videoId,
      start_time: startTime,
      end_time: endTime,
    }),
  generateClip: (videoId: number, startSeconds: number, endSeconds: number) =>
    api.post("/api/clips/generate", {
      video_id: videoId,
      start_seconds: startSeconds,
      end_seconds: endSeconds,
    }),
  clipUrl: (filename: string) => `${API_URL}/api/clips/${filename}`,
};

export const forensicApi = {
  audit: (limit = 100) => api.get<AuditEntry[]>("/api/audit", { params: { limit } }),

  listCases: () => api.get<Case[]>("/api/cases"),
  createCase: (body: { title: string; description?: string; notes?: string; site_id?: number; video_ids?: number[] }) =>
    api.post<Case>("/api/cases", body),
  getCase: (id: number) => api.get(`/api/cases/${id}`),
  addVideoToCase: (caseId: number, videoId: number) =>
    api.post(`/api/cases/${caseId}/videos/${videoId}`),
  caseTimeline: (caseId: number) => api.get(`/api/cases/${caseId}/timeline`),
  caseReport: (caseId: number) =>
    api.post<{ markdown_path?: string; html_path?: string; download_url?: string }>(`/api/cases/${caseId}/report`),

  listSites: () => api.get<Site[]>("/api/sites"),
  createSite: (body: { name: string; description?: string }) => api.post<Site>("/api/sites", body),
  listCameras: (siteId?: number) =>
    api.get<Camera[]>("/api/cameras", { params: siteId ? { site_id: siteId } : {} }),
  createCamera: (body: {
    site_id: number;
    camera_code: string;
    name: string;
    location_label?: string;
    pos_x?: number;
    pos_y?: number;
  }) => api.post<Camera>("/api/cameras", body),
  siteMap: (siteId: number) =>
    api.get<{
      site: Site;
      cameras: Array<Camera & { detection_count?: number; latest?: string }>;
    }>(`/api/sites/${siteId}/map`),

  exportEvidence: (body: { video_id: number; start_seconds: number; end_seconds: number; case_id?: number }) =>
    api.post<EvidenceExport>("/api/evidence/export", body),
  evidenceClipUrl: (id: number) => `${API_URL}/api/evidence/${id}/clip`,
  evidenceSidecarUrl: (id: number) => `${API_URL}/api/evidence/${id}/sidecar`,

  redact: (
    videoId: number,
    body: {
      classes?: string[];
      start_seconds?: number;
      end_seconds?: number;
      track_ids?: number[];
      exclude_track_ids?: number[];
    }
  ) => api.post<{ filepath: string; download_url: string }>(`/api/videos/${videoId}/redact`, body),
  fileUrl: (path: string) => `${API_URL}/api/files/download?path=${encodeURIComponent(path)}`,

  similarTracks: (trackDbId: number, caseId?: number) =>
    api.get<{ query_track_id: number; matches: SimilarMatch[] }>(`/api/tracks/${trackDbId}/similar`, {
      params: caseId ? { case_id: caseId } : {},
    }),
  confirmReid: (trackDbIds: number[], globalIdentity?: string) =>
    api.post("/api/reid/confirm", { track_db_ids: trackDbIds, global_identity: globalIdentity }),

  listAnnotations: (videoId: number) => api.get<Annotation[]>(`/api/videos/${videoId}/annotations`),
  createAnnotation: (body: {
    video_id: number;
    body: string;
    track_id?: number;
    timestamp_seconds?: number;
    flag?: string;
  }) => api.post<Annotation>("/api/annotations", body),

  listComments: (params?: { video_id?: number; case_id?: number; track_db_id?: number }) =>
    api.get<Comment[]>("/api/comments", { params }),
  createComment: (body: {
    body: string;
    video_id?: number;
    case_id?: number;
    track_db_id?: number;
    mentions?: string[];
  }) => api.post<Comment>("/api/comments", body),

  listSavedSearches: () => api.get<SavedSearch[]>("/api/saved-searches"),
  createSavedSearch: (body: {
    name: string;
    query?: string;
    filters?: Record<string, unknown>;
    is_alert?: boolean;
  }) => api.post<SavedSearch>("/api/saved-searches", body),
  evaluateAlerts: () => api.post<{ triggered: Array<{ alert_id: number; name: string; hit_count: number }> }>("/api/alerts/evaluate"),

  flagFalsePositive: (detectionId: number) =>
    api.post(`/api/detections/${detectionId}/false-positive`),

  batchUpload: (files: File[], opts?: { case_id?: number; camera_codes?: string; retention_days?: number }) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (opts?.case_id != null) form.append("case_id", String(opts.case_id));
    if (opts?.camera_codes) form.append("camera_codes", opts.camera_codes);
    if (opts?.retention_days != null) form.append("retention_days", String(opts.retention_days));
    return api.post<{ batch_id: string; videos: Array<{ video_id: number; filename: string }> }>(
      "/api/videos/batch-upload",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  getRetention: () => api.get("/api/retention"),
  updateRetention: (body: { retention_days?: number; auto_delete?: boolean }) =>
    api.put("/api/retention", body),
  runRetention: () => api.post("/api/retention/run"),

  setUserRole: (userId: number, role: string) =>
    api.patch(`/api/users/${userId}/role`, null, { params: { role } }),

  enableLive: (cameraId: number, rtspUrl: string) => {
    const form = new FormData();
    form.append("rtsp_url", rtspUrl);
    return api.post(`/api/cameras/${cameraId}/live`, form);
  },
  liveSnapshot: (cameraId: number) => api.post(`/api/cameras/${cameraId}/snapshot`),
};

/** Authenticated file download (Bearer header) — use instead of window.open for protected routes. */
export async function downloadAuthed(urlPath: string, filename?: string) {
  const path = urlPath.startsWith("http") ? urlPath.replace(API_URL, "") : urlPath;
  const res = await api.get(path, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || path.split("/").pop() || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

export default api;
export { API_URL };
