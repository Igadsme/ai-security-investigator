import { ActivityEvent } from "@/services/api";
import { AlertTriangle, Info, AlertCircle, Play } from "lucide-react";

interface Props {
  events: ActivityEvent[];
  onShowClip?: (start: number, end: number) => void;
}

const severityIcon = {
  info: Info,
  warning: AlertTriangle,
  alert: AlertCircle,
};

const severityClass = {
  info: "badge-info",
  warning: "badge-warning",
  alert: "badge-danger",
};

export default function EventTimeline({ events, onShowClip }: Props) {
  if (!events.length) {
    return (
      <div className="card text-center text-slate-500 py-8">
        No activity events detected yet
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-200 mb-4">Event Timeline</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-surface-600" />
        <div className="space-y-4">
          {events.map((event) => {
            const Icon = severityIcon[event.severity as keyof typeof severityIcon] || Info;
            return (
              <div key={event.id} className="relative pl-10">
                <div className="absolute left-2.5 w-3 h-3 rounded-full bg-accent border-2 border-surface-800" />
                <div className="bg-surface-700/50 rounded-lg p-4 hover:bg-surface-700 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-accent">{event.start_time}</span>
                        <span className={severityClass[event.severity as keyof typeof severityClass] || "badge-info"}>
                          {event.activity_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm">{event.description}</p>
                    </div>
                    {onShowClip && (
                      <button
                        onClick={() =>
                          onShowClip(
                            event.start_seconds,
                            event.end_seconds || event.start_seconds + 5
                          )
                        }
                        className="btn-secondary text-xs flex items-center gap-1 shrink-0"
                      >
                        <Play className="w-3 h-3" />
                        Show Event
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
