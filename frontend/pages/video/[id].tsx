import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Car,
  Eye,
  FileLock2,
  Link2,
  MessageSquare,
  Scissors,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import Layout from "@/components/Layout";
import { PrimaryBtn, TopBar } from "@/components/ui-kit";
import {
  Annotation,
  Comment,
  Detection,
  forensicApi,
  searchApi,
  downloadAuthed,
  Stats,
  ActivityEvent,
  Track,
  Video,
  videoApi,
} from "@/services/api";
import {
  ACCENT,
  ACCENT_HOVER,
  ACCENT_SOFT,
  BORDER,
  CANVAS,
  EVENT_COLOR,
  INK,
  INK2,
  PANEL,
  SCANLINES,
  formatDuration,
} from "@/lib/theme";

function eventTypeKey(t: string): string {
  const s = t.toLowerCase();
  if (s.includes("entry") || s === "entry") return "entry";
  if (s.includes("exit") || s === "exit") return "exit";
  if (s.includes("loiter")) return "loitering";
  if (s.includes("vehicle") || s.includes("arrival")) return "vehicle";
  return s;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + (parts[1] || 0);
  return parts[0] || 0;
}

export default function VideoDetailPage() {
  const router = useRouter();
  const id = Number(router.query.id);
  const jumpT = router.query.t ? Number(router.query.t) : null;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [video, setVideo] = useState<Video | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentTime, setCurrentTime] = useState("00:00:00");
  const [jumpInput, setJumpInput] = useState("");
  const [hovered, setHovered] = useState<ActivityEvent | null>(null);
  const [tooltipXY, setTooltipXY] = useState({ x: 0, y: 0 });
  const [note, setNote] = useState("");
  const [noteTrack, setNoteTrack] = useState<number | "">("");
  const [commentBody, setCommentBody] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [similar, setSimilar] = useState<any[]>([]);
  const [selectedTrackDbId, setSelectedTrackDbId] = useState<number | null>(null);
  const [redactMsg, setRedactMsg] = useState("");

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [v, s, e, t, d] = await Promise.all([
        videoApi.get(id),
        videoApi.getStats(id),
        videoApi.getEvents(id),
        videoApi.getTracks(id),
        videoApi.getDetections(id),
      ]);
      setVideo(v.data);
      setStats(s.data);
      setEvents(e.data);
      setTracks(t.data);
      setDetections(d.data.slice(0, 200));
    } catch {
      /* core video load failed */
    }
    try {
      const [a, c] = await Promise.all([
        forensicApi.listAnnotations(id),
        forensicApi.listComments({ video_id: id }),
      ]);
      setAnnotations(a.data);
      setComments(c.data);
    } catch {
      setAnnotations([]);
      setComments([]);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (jumpT != null && videoRef.current && !Number.isNaN(jumpT)) {
      videoRef.current.currentTime = jumpT;
      setCurrentTime(formatDuration(jumpT));
    }
  }, [jumpT, video]);

  const duration = video?.duration_seconds || 1;

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    }
    setCurrentTime(formatDuration(seconds));
  };

  const onTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(formatDuration(videoRef.current.currentTime));
    }
  };

  const findLikeThis = async (track: Track) => {
    setSelectedTrackDbId(track.id);
    try {
      const { data } = await forensicApi.similarTracks(track.id);
      setSimilar(data.matches || []);
    } catch {
      setSimilar([]);
    }
  };

  if (!video) {
    return (
      <Layout>
        <div className="p-8 text-sm" style={{ color: INK2 }}>
          Loading…
        </div>
      </Layout>
    );
  }

  const uniqueVehicles = Object.entries(stats?.unique_tracks || {})
    .filter(([k]) => !["person"].includes(k))
    .reduce((a, [, n]) => a + n, 0);

  const trackCols = "20px 50px 160px 1fr 1fr 70px 200px";

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-screen" style={{ backgroundColor: CANVAS }}>
        <TopBar
          title="Investigation"
          subtitle={`${video.original_filename}${video.camera_code ? ` · ${video.camera_code}` : ""} · ${formatDuration(video.duration_seconds)}`}
        />
        <div className="flex-1 overflow-auto">
          <div
            className="relative w-full bg-black"
            style={{ aspectRatio: "16/9", maxHeight: "460px", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
          >
            <video
              ref={videoRef}
              src={videoApi.streamUrl(id)}
              controls
              className="w-full h-full object-contain"
              onTimeUpdate={onTimeUpdate}
            />
            <div className="absolute inset-0 pointer-events-none z-10" style={SCANLINES} />
            <div className="absolute top-3 left-4 z-20 flex flex-col gap-0.5 pointer-events-none">
              <span className="font-mono text-[11px] tracking-[0.12em]" style={{ color: "#88BB88" }}>
                CAM — {video.camera_code || video.original_filename.slice(0, 24)}
              </span>
              {video.file_sha256 && (
                <span className="font-mono text-[9px]" style={{ color: "#668866" }}>
                  sha256 {video.file_sha256.slice(0, 16)}…
                </span>
              )}
            </div>
            <div className="absolute bottom-3 left-4 z-20 pointer-events-none">
              <span className="font-mono text-[13px] tracking-[0.08em]" style={{ color: "#BBEEBB" }}>
                {currentTime}
              </span>
            </div>
          </div>

          <div className="px-8 py-6 flex flex-col gap-7">
            <div className="flex flex-wrap gap-2">
              <PrimaryBtn
                onClick={async () => {
                  const t = videoRef.current?.currentTime || 0;
                  try {
                    const { data } = await forensicApi.exportEvidence({
                      video_id: id,
                      start_seconds: Math.max(0, t - 2),
                      end_seconds: t + 8,
                    });
                    setExportMsg(`Evidence #${data.id} sha256=${data.sha256.slice(0, 12)}…`);
                    await downloadAuthed(data.clip_url, `evidence_${data.id}.mp4`);
                    await downloadAuthed(data.sidecar_url, `evidence_${data.id}.json`);
                  } catch {
                    setExportMsg("Export failed (investigator role required)");
                  }
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileLock2 size={14} /> Evidence export + sidecar
                </span>
              </PrimaryBtn>
              <PrimaryBtn
                onClick={async () => {
                  try {
                    const { data } = await forensicApi.redact(id, {
                      classes: ["person", "car", "truck", "bus", "motorcycle"],
                      start_seconds: 0,
                    });
                    setRedactMsg("Redacted copy ready");
                    await downloadAuthed(data.download_url, `redacted_v${id}.mp4`);
                  } catch {
                    setRedactMsg("Redaction failed");
                  }
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Shield size={14} /> Redact / blur
                </span>
              </PrimaryBtn>
              {(exportMsg || redactMsg) && (
                <span className="text-xs self-center font-mono" style={{ color: INK2 }}>
                  {exportMsg || redactMsg}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total detections", value: String(stats?.total_detections ?? "—"), Icon: Activity },
                { label: "Unique people", value: String(stats?.unique_people ?? "—"), Icon: Users },
                { label: "Unique vehicles", value: String(uniqueVehicles || "—"), Icon: Car },
                {
                  label: "Peak activity",
                  value: stats?.peak_activity_timestamp || "—",
                  Icon: Zap,
                },
              ].map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className="border rounded-lg px-5 py-4"
                  style={{ backgroundColor: PANEL, borderColor: BORDER }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={12} style={{ color: INK2 }} />
                    <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: INK2 }}>
                      {label}
                    </span>
                  </div>
                  <span className="font-mono text-xl font-semibold" style={{ color: INK }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: INK2 }}>
                Jump to
              </span>
              <input
                type="text"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && jumpInput.trim()) {
                    seekTo(parseTimestamp(jumpInput.trim()));
                    setJumpInput("");
                  }
                }}
                placeholder="HH:MM:SS"
                className="font-mono text-sm px-3 py-1.5 border rounded-sm focus:outline-none w-28"
                style={{ backgroundColor: "#E7EBEA", color: INK, borderColor: BORDER }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!jumpInput.trim()) return;
                  seekTo(parseTimestamp(jumpInput.trim()));
                  setJumpInput("");
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
                style={{ backgroundColor: ACCENT, color: "#FAFBFA" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT_HOVER;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT;
                }}
              >
                Jump
              </button>
              <span className="font-mono text-xs" style={{ color: INK2 }}>
                Current: <span style={{ color: ACCENT }}>{currentTime}</span>
              </span>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-5" style={{ color: INK2 }}>
                Event timeline
              </p>
              <div className="relative" style={{ paddingTop: 24, paddingBottom: 32 }}>
                <div
                  className="absolute left-0 right-0 h-px cursor-crosshair"
                  style={{ top: 24, backgroundColor: BORDER }}
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    seekTo(pct * duration);
                  }}
                />
                {events.slice(0, 80).map((ev) => {
                  const pct = Math.min(100, Math.max(0, (ev.start_seconds / duration) * 100));
                  const key = eventTypeKey(ev.activity_type);
                  return (
                    <div
                      key={ev.id}
                      className="absolute -translate-x-1/2 cursor-pointer transition-transform hover:scale-125"
                      style={{ left: `${pct}%`, top: 18 }}
                      onMouseEnter={(e) => {
                        setHovered(ev);
                        setTooltipXY({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => seekTo(ev.start_seconds)}
                    >
                      <div
                        className="w-2.5 h-2.5 rotate-45"
                        style={{ backgroundColor: EVENT_COLOR[key] || ACCENT }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-5 mt-2 flex-wrap">
                {(["entry", "exit", "loitering", "vehicle"] as const).map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rotate-45" style={{ backgroundColor: EVENT_COLOR[t] }} />
                    <span className="text-xs capitalize" style={{ color: INK2 }}>
                      {t}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3 flex items-center gap-1.5" style={{ color: INK2 }}>
                  <MessageSquare size={12} /> Investigator notes
                </p>
                <div className="space-y-2 max-h-36 overflow-auto mb-3">
                  {annotations.map((a) => (
                    <div key={a.id} className="text-xs border-b pb-2" style={{ borderColor: BORDER, color: INK }}>
                      <span className="font-mono" style={{ color: ACCENT }}>
                        {a.flag || "note"}
                      </span>{" "}
                      {a.body}
                      {a.track_id != null && (
                        <span className="font-mono" style={{ color: INK2 }}>
                          {" "}
                          · track {a.track_id}
                        </span>
                      )}
                    </div>
                  ))}
                  {!annotations.length && (
                    <p className="text-xs" style={{ color: INK2 }}>
                      Flag a track or timestamp for the team.
                    </p>
                  )}
                </div>
                <textarea
                  className="w-full text-sm px-3 py-2 border rounded-sm mb-2 min-h-[56px]"
                  style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                  placeholder="possible suspect, matches description…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex gap-2 mb-2">
                  <input
                    className="w-24 text-xs px-2 py-1.5 border rounded-sm"
                    style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                    placeholder="Track #"
                    value={noteTrack}
                    onChange={(e) => setNoteTrack(e.target.value ? Number(e.target.value) : "")}
                  />
                  <PrimaryBtn
                    disabled={!note.trim()}
                    onClick={async () => {
                      await forensicApi.createAnnotation({
                        video_id: id,
                        body: note.trim(),
                        track_id: noteTrack === "" ? undefined : Number(noteTrack),
                        timestamp_seconds: videoRef.current?.currentTime,
                        flag: "investigator",
                      });
                      setNote("");
                      loadData();
                    }}
                  >
                    Add note
                  </PrimaryBtn>
                </div>
                <div className="pt-3 border-t" style={{ borderColor: BORDER }}>
                  <p className="text-[11px] mb-2" style={{ color: INK2 }}>
                    Comments / @mentions
                  </p>
                  {comments.slice(0, 5).map((c) => (
                    <p key={c.id} className="text-xs mb-1" style={{ color: INK }}>
                      {c.body}
                    </p>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input
                      className="flex-1 text-xs px-2 py-1.5 border rounded-sm"
                      style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                      placeholder="@alice check this…"
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                    />
                    <PrimaryBtn
                      disabled={!commentBody.trim()}
                      onClick={async () => {
                        const mentions = Array.from(commentBody.matchAll(/@(\w+)/g)).map((m) => m[1]);
                        await forensicApi.createComment({
                          body: commentBody.trim(),
                          video_id: id,
                          mentions,
                        });
                        setCommentBody("");
                        loadData();
                      }}
                    >
                      Post
                    </PrimaryBtn>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3 flex items-center gap-1.5" style={{ color: INK2 }}>
                  <Link2 size={12} /> Cross-video re-ID suggestions
                </p>
                {!selectedTrackDbId && (
                  <p className="text-xs" style={{ color: INK2 }}>
                    Click “Find like this” on a track to surface matches across cameras.
                  </p>
                )}
                <div className="space-y-2 max-h-64 overflow-auto">
                  {similar.map((m, i) => {
                    const t = m.track || m;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs border-b pb-2"
                        style={{ borderColor: BORDER }}
                      >
                        <div style={{ color: INK }}>
                          <span className="font-mono" style={{ color: ACCENT }}>
                            {(m.score * 100).toFixed(0)}%
                          </span>{" "}
                          V{t.video_id} Track №{String(t.track_id).padStart(4, "0")}{" "}
                          {t.camera_code || ""} {t.dominant_color || ""}
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="px-2 py-1 border rounded-sm"
                            style={{ borderColor: BORDER, color: INK2 }}
                            onClick={() => router.push(`/video/${t.video_id}`)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 border rounded-sm"
                            style={{ borderColor: BORDER, color: INK2 }}
                            onClick={async () => {
                              if (!selectedTrackDbId || !t.db_id) return;
                              await forensicApi.confirmReid([selectedTrackDbId, t.db_id]);
                              loadData();
                            }}
                          >
                            Confirm same
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: INK2 }}>
                Detected tracks — {tracks.length} total
              </p>
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: BORDER }}>
                <div
                  className="grid text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3 border-b"
                  style={{ gridTemplateColumns: trackCols, backgroundColor: PANEL, color: INK2, borderColor: BORDER }}
                >
                  <div />
                  <div>Track</div>
                  <div>Classification</div>
                  <div>First seen</div>
                  <div>Last seen</div>
                  <div className="text-right">Frames</div>
                  <div className="text-right">Actions</div>
                </div>
                {tracks.map((track, i) => {
                  const rowBg = i % 2 === 0 ? CANVAS : PANEL;
                  const color =
                    track.dominant_color === "white"
                      ? "#C8C8C8"
                      : track.dominant_color === "black"
                        ? "#404040"
                        : track.dominant_color === "red"
                          ? "#A33232"
                          : track.dominant_color === "blue"
                            ? "#2E5080"
                            : ACCENT;
                  return (
                    <div
                      key={track.id}
                      className="group grid items-center px-4 py-3 border-b last:border-0 transition-colors"
                      style={{ gridTemplateColumns: trackCols, backgroundColor: rowBg, borderColor: BORDER }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT_SOFT;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = rowBg;
                      }}
                    >
                      <div>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      </div>
                      <div>
                        <span className="font-mono text-xs" style={{ color: INK2 }}>
                          №{String(track.track_id).padStart(4, "0")}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm capitalize" style={{ color: INK }}>
                          {track.object_class}
                          {track.dominant_color ? ` — ${track.dominant_color}` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="font-mono text-sm" style={{ color: INK }}>
                          {track.first_seen}
                        </span>
                      </div>
                      <div>
                        <span className="font-mono text-sm" style={{ color: INK }}>
                          {track.last_seen}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm" style={{ color: INK }}>
                          {track.frame_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1 flex-wrap opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => seekTo(parseTimestamp(track.first_seen))}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border"
                          style={{ color: INK2, borderColor: BORDER }}
                        >
                          <Eye size={9} />
                          Jump
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const start = parseTimestamp(track.first_seen);
                            const end = parseTimestamp(track.last_seen);
                            try {
                              const { data } = await searchApi.generateClip(id, start, Math.max(start + 3, end));
                              window.open(searchApi.clipUrl(data.filename), "_blank");
                            } catch {
                              /* ignore */
                            }
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border"
                          style={{ color: INK2, borderColor: BORDER }}
                        >
                          <Scissors size={9} />
                          Clip
                        </button>
                        <button
                          type="button"
                          onClick={() => findLikeThis(track)}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border"
                          style={{ color: INK2, borderColor: BORDER }}
                        >
                          Find like this
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const start = parseTimestamp(track.first_seen);
                            const end = Math.max(start + 3, parseTimestamp(track.last_seen));
                            try {
                              const { data } = await forensicApi.exportEvidence({
                                video_id: id,
                                start_seconds: start,
                                end_seconds: end,
                              });
                              await downloadAuthed(data.clip_url, `evidence_${data.id}.mp4`);
                              await downloadAuthed(data.sidecar_url, `evidence_${data.id}.json`);
                            } catch {
                              /* ignore */
                            }
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border"
                          style={{ color: INK2, borderColor: BORDER }}
                        >
                          Evidence
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: INK2 }}>
                Recent detections — flag false positives
              </p>
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto" style={{ borderColor: BORDER }}>
                {detections.slice(0, 40).map((d, i) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between px-4 py-2 border-b last:border-0 text-xs"
                    style={{
                      backgroundColor: i % 2 === 0 ? CANVAS : PANEL,
                      borderColor: BORDER,
                      color: INK,
                    }}
                  >
                    <span>
                      <span className="font-mono" style={{ color: INK2 }}>
                        {d.timestamp}
                      </span>{" "}
                      {d.object_class} conf={d.confidence.toFixed(2)}
                      {d.track_id != null ? ` · #${d.track_id}` : ""}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 border rounded-sm"
                      style={{ borderColor: BORDER, color: "#A33232" }}
                      onClick={async () => {
                        await forensicApi.flagFalsePositive(d.id);
                        loadData();
                      }}
                    >
                      False positive
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {hovered && (
          <div
            className="fixed z-50 pointer-events-none border rounded-md px-3 py-2.5"
            style={{
              left: tooltipXY.x + 14,
              top: tooltipXY.y - 70,
              backgroundColor: PANEL,
              borderColor: BORDER,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <p className="font-mono text-xs font-medium mb-0.5" style={{ color: ACCENT }}>
              {hovered.start_time}
            </p>
            <p className="text-xs" style={{ color: INK }}>
              {hovered.description}
            </p>
            {hovered.track_id != null && (
              <p className="font-mono text-[10px] mt-0.5" style={{ color: INK2 }}>
                Track №{hovered.track_id}
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
