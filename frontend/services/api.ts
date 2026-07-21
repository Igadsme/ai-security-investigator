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
}

export interface Track {
  id: number;
  track_id: number;
  object_class: string;
  first_seen: string;
  last_seen: string;
  frame_count: number;
  dominant_color?: string;
  is_unique_person: boolean;
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
    source: string;
  }>;
  unique_count?: number;
  summary?: string;
}

export interface Stats {
  total_detections: number;
  unique_tracks: Record<string, number>;
  unique_people: number;
  activity_count: number;
  peak_activity_timestamp?: string;
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
  me: () => api.get("/api/auth/me"),
};

export const videoApi = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<Video>("/api/videos/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
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

export default api;
