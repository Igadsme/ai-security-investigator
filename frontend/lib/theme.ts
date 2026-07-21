export const INK = "#12201E";
export const INK2 = "#4E635F";
export const ACCENT = "#2B6E6A";
export const ACCENT_HOVER = "#1F5551";
export const ACCENT_SOFT = "#DEEAE8";
export const PANEL = "#F0F3F2";
export const PANEL_ALT = "#E7EBEA";
export const CANVAS = "#FAFBFA";
export const BORDER = "#D6DCDA";

export const GRID_BG = {
  backgroundImage:
    "linear-gradient(rgba(18,32,30,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(18,32,30,0.025) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
} as const;

export const SCANLINES = {
  backgroundImage:
    "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.04) 1px, rgba(0,0,0,0.04) 2px)",
} as const;

export const EVENT_COLOR: Record<string, string> = {
  entry: ACCENT,
  exit: INK2,
  loitering: "#9C6B12",
  vehicle: "#39506B",
  vehicle_arrival: "#39506B",
  running: "#9C6B12",
  abandoned_object: "#A33232",
  trespassing: "#A33232",
};

export function formatDuration(seconds?: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function mapStatus(status: string): "completed" | "processing" | "queued" | "failed" {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "processing") return "processing";
  return "queued";
}
