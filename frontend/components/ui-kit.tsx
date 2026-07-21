import { ReactNode } from "react";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import {
  ACCENT,
  ACCENT_HOVER,
  INK,
  INK2,
  PANEL,
  PANEL_ALT,
} from "@/lib/theme";

export function StatusChip({
  status,
}: {
  status: "completed" | "processing" | "queued" | "failed";
}) {
  const map = {
    completed: { label: "Completed", bg: "#DCEFE4", fg: "#1F7A52", Icon: CheckCircle },
    processing: { label: "Processing", bg: "#F6EAD2", fg: "#9C6B12", Icon: Loader2 },
    queued: { label: "Queued", bg: PANEL_ALT, fg: INK2, Icon: Clock },
    failed: { label: "Failed", bg: "#F7E2E2", fg: "#A33232", Icon: AlertCircle },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-sm"
      style={{ backgroundColor: map.bg, color: map.fg }}
    >
      <map.Icon size={10} className={status === "processing" ? "animate-spin" : ""} />
      {map.label}
    </span>
  );
}

export function PrimaryBtn({
  children,
  onClick,
  className = "",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2.5 rounded-sm text-sm font-medium transition-colors disabled:opacity-50 ${className}`}
      style={{ backgroundColor: ACCENT, color: "#FAFBFA" }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT_HOVER;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT;
      }}
    >
      {children}
    </button>
  );
}

export function GhostBtn({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-sm text-xs border transition-colors hover:bg-[var(--accent-soft)] ${className}`}
      style={{ color: INK2, borderColor: "var(--border)" }}
    >
      {children}
    </button>
  );
}

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      className="h-14 flex items-center px-8 border-b flex-shrink-0"
      style={{ backgroundColor: PANEL, borderColor: "var(--border)" }}
    >
      <div>
        <h1 className="text-[20px] font-semibold leading-tight" style={{ color: INK }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: INK2 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label
      className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5"
      style={{ color: INK2 }}
    >
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-sm text-sm border focus:outline-none focus:ring-2 focus:ring-[#2B6E6A]/40 transition-shadow ${props.className || ""}`}
      style={{
        backgroundColor: PANEL_ALT,
        color: INK,
        borderColor: "var(--border)",
        fontFamily: "IBM Plex Sans, system-ui, sans-serif",
        ...((props.style as object) || {}),
      }}
    />
  );
}
