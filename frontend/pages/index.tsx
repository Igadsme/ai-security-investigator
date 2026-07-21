import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight, Clock, Upload } from "lucide-react";
import Layout from "@/components/Layout";
import { PrimaryBtn, StatusChip, TopBar } from "@/components/ui-kit";
import { videoApi, Video } from "@/services/api";
import {
  ACCENT,
  ACCENT_HOVER,
  ACCENT_SOFT,
  BORDER,
  CANVAS,
  GRID_BG,
  INK,
  INK2,
  PANEL,
  PANEL_ALT,
  SCANLINES,
  formatDate,
  formatDuration,
  mapStatus,
} from "@/lib/theme";

function VideoThumb({ status, timecode }: { status: string; timecode: string }) {
  return (
    <div className="relative w-[88px] h-[50px] rounded flex-shrink-0 overflow-hidden" style={{ backgroundColor: "#0F1C19" }}>
      <div className="absolute inset-0 pointer-events-none" style={SCANLINES} />
      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1">
        <span className="font-mono text-[8px] leading-none tracking-wider" style={{ color: "#88BB88" }}>
          {timecode}
        </span>
      </div>
      {(status === "queued" || status === "uploaded") && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Clock size={14} style={{ color: INK2, opacity: 0.5 }} />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [jobs, setJobs] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await videoApi.list();
        if (cancelled) return;
        setVideos(data);
        const progress: Record<number, number> = {};
        await Promise.all(
          data
            .filter((v) => mapStatus(v.status) === "processing" || mapStatus(v.status) === "queued")
            .map(async (v) => {
              try {
                const { data: job } = await videoApi.getJob(v.id);
                progress[v.id] = Math.round(job.progress || 0);
              } catch {
                /* ignore */
              }
            })
        );
        if (!cancelled) setJobs(progress);
      } catch {
        if (!cancelled) setVideos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const completed = videos.filter((v) => mapStatus(v.status) === "completed").length;
  const processing = videos.filter((v) => {
    const s = mapStatus(v.status);
    return s === "processing" || s === "queued";
  }).length;
  const cols = "88px 1fr 130px 100px 100px 118px 110px";

  return (
    <Layout>
      {videos.length === 0 && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-screen" style={{ backgroundColor: CANVAS, ...GRID_BG }}>
          <div className="text-center max-w-xs">
            <div className="font-mono text-xs mb-8 tracking-[0.08em]" style={{ color: INK2 }}>
              [ ASCI ]
            </div>
            <h2 className="text-2xl font-semibold mb-3" style={{ color: INK }}>
              No footage on record.
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: INK2 }}>
              Upload CCTV. Detect people and vehicles. Ask what happened.
            </p>
            <PrimaryBtn onClick={() => router.push("/upload")}>
              <span className="flex items-center gap-2">
                <Upload size={13} />
                Upload footage
              </span>
            </PrimaryBtn>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-screen" style={{ backgroundColor: CANVAS }}>
          <TopBar
            title="Dashboard"
            subtitle={`${videos.length} footage sources · ${completed} completed · ${processing} processing`}
          />
          <div className="flex-1 overflow-auto px-8 py-6" style={GRID_BG}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: INK2 }}>
                Footage sources
              </span>
              <button
                type="button"
                onClick={() => router.push("/upload")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors"
                style={{ backgroundColor: ACCENT, color: "#FAFBFA" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT_HOVER;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT;
                }}
              >
                <Upload size={11} /> Upload
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden" style={{ borderColor: BORDER }}>
              <div
                className="grid text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3 border-b"
                style={{ gridTemplateColumns: cols, backgroundColor: PANEL, color: INK2, borderColor: BORDER }}
              >
                <div>Thumb</div>
                <div>Filename</div>
                <div>Status</div>
                <div>Duration</div>
                <div className="text-right">Detections</div>
                <div>Uploaded</div>
                <div />
              </div>

              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="grid items-center px-4 py-3 border-b last:border-0 animate-pulse gap-4"
                      style={{ gridTemplateColumns: cols, backgroundColor: i % 2 === 0 ? CANVAS : PANEL, borderColor: BORDER }}
                    >
                      <div className="h-[50px] w-[88px] rounded" style={{ backgroundColor: PANEL_ALT }} />
                      <div className="h-3.5 rounded w-3/5" style={{ backgroundColor: PANEL_ALT }} />
                      <div className="h-5 rounded w-24" style={{ backgroundColor: PANEL_ALT }} />
                      <div className="h-3.5 rounded w-16" style={{ backgroundColor: PANEL_ALT }} />
                      <div className="h-3.5 rounded w-10 ml-auto" style={{ backgroundColor: PANEL_ALT }} />
                      <div className="h-3.5 rounded w-20" style={{ backgroundColor: PANEL_ALT }} />
                      <div />
                    </div>
                  ))
                : videos.map((video, i) => {
                    const status = mapStatus(video.status);
                    const rowBg = i % 2 === 0 ? CANVAS : PANEL;
                    const progress = jobs[video.id];
                    return (
                      <div
                        key={video.id}
                        className="group grid items-center px-4 py-3 border-b last:border-0 transition-colors"
                        style={{ gridTemplateColumns: cols, backgroundColor: rowBg, borderColor: BORDER }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT_SOFT;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = rowBg;
                        }}
                      >
                        <div>
                          <VideoThumb status={status} timecode={formatDuration(video.duration_seconds).slice(0, 8)} />
                        </div>
                        <div className="min-w-0 pr-4">
                          <p className="text-sm font-medium truncate" style={{ color: INK }}>
                            {video.original_filename}
                          </p>
                          {status === "processing" && progress != null && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="h-1 rounded-full overflow-hidden" style={{ width: 100, backgroundColor: BORDER }}>
                                <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: "#9C6B12" }} />
                              </div>
                              <span className="font-mono text-[10px]" style={{ color: "#9C6B12" }}>
                                {progress}%
                              </span>
                            </div>
                          )}
                          {status === "failed" && video.error_message && (
                            <p className="text-[11px] mt-0.5 truncate" style={{ color: "#A33232" }}>
                              {video.error_message}
                            </p>
                          )}
                        </div>
                        <div>
                          <StatusChip status={status} />
                        </div>
                        <div className="font-mono text-sm" style={{ color: INK }}>
                          {formatDuration(video.duration_seconds)}
                        </div>
                        <div className="font-mono text-sm text-right" style={{ color: INK2 }}>
                          —
                        </div>
                        <div className="text-sm" style={{ color: INK2 }}>
                          {formatDate(video.created_at)}
                        </div>
                        <div className="flex items-center justify-end">
                          {status === "completed" && (
                            <Link
                              href={`/video/${video.id}`}
                              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-all"
                              style={{ color: ACCENT }}
                            >
                              Investigate <ChevronRight size={11} />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
