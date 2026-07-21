import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { GhostBtn, PrimaryBtn, TopBar } from "@/components/ui-kit";
import { forensicApi, Video, videoApi, downloadAuthed } from "@/services/api";
import { ACCENT, BORDER, CANVAS, INK, INK2, PANEL } from "@/lib/theme";

type TimelineLane = {
  video_id: number;
  camera_code?: string;
  filename?: string;
  events: Array<{
    start_seconds: number;
    end_seconds?: number;
    description?: string;
    activity_type?: string;
    track_id?: number;
  }>;
};

export default function CaseDetailPage() {
  const router = useRouter();
  const id = Number(router.query.id);
  const [detail, setDetail] = useState<any>(null);
  const [lanes, setLanes] = useState<TimelineLane[]>([]);
  const [duration, setDuration] = useState(1);
  const [videos, setVideos] = useState<Video[]>([]);
  const [addVideoId, setAddVideoId] = useState<number | "">("");
  const [reportMsg, setReportMsg] = useState("");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, t, v, cm] = await Promise.all([
        forensicApi.getCase(id),
        forensicApi.caseTimeline(id),
        videoApi.list(),
        forensicApi.listComments({ case_id: id }),
      ]);
      setDetail(c.data);
      const cams = (t.data as any).cameras || [];
      const events = (t.data as any).events || [];
      const built: TimelineLane[] = cams.map((cam: any) => ({
        video_id: cam.video_id,
        camera_code: cam.camera_code,
        filename: cam.filename,
        events: events
          .filter((e: any) => e.video_id === cam.video_id)
          .map((e: any) => ({
            start_seconds: e.sync_seconds ?? e.start_seconds,
            end_seconds: e.end_seconds,
            description: e.description,
            activity_type: e.activity_type,
            track_id: e.track_id,
          })),
      }));
      setLanes(built);
      const maxDur = Math.max(
        1,
        ...cams.map((cam: any) => (cam.sync_offset_seconds || 0) + (cam.duration_seconds || 0)),
        ...events.map((e: any) => e.sync_seconds || e.start_seconds || 0)
      );
      setDuration(maxDur);
      setVideos(v.data);
      setComments(cm.data);
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!detail) {
    return (
      <Layout>
        <div className="p-8 text-sm" style={{ color: INK2 }}>
          Loading case…
        </div>
      </Layout>
    );
  }

  const caseVideos: any[] = detail.videos || [];

  return (
    <Layout>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: CANVAS }}>
        <TopBar
          title={detail.title || `Case #${id}`}
          subtitle={detail.description || "Multi-camera investigation"}
        />
        <div className="px-8 py-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            <PrimaryBtn
              onClick={async () => {
                try {
                  const { data } = await forensicApi.caseReport(id);
                  setReportMsg(data.html_path || data.markdown_path || "Report generated");
                  if (data.download_url) {
                    await downloadAuthed(data.download_url, `case_${id}_report.html`);
                  }
                } catch {
                  setReportMsg("Report failed — ensure you are logged in as investigator.");
                }
              }}
            >
              One-click report
            </PrimaryBtn>
            <GhostBtn onClick={() => router.push("/search")}>Search in case</GhostBtn>
            {reportMsg && (
              <span className="text-xs self-center font-mono" style={{ color: INK2 }}>
                {reportMsg}
              </span>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="border rounded-lg p-5" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: INK2 }}>
                Case videos
              </p>
              <ul className="space-y-2 mb-4">
                {(caseVideos.length ? caseVideos : []).map((v: any) => (
                  <li key={v.id || v.video_id}>
                    <button
                      type="button"
                      className="text-sm underline-offset-2 hover:underline"
                      style={{ color: ACCENT }}
                      onClick={() => router.push(`/video/${v.id || v.video_id}`)}
                    >
                      {v.original_filename || v.filename || `Video ${v.id || v.video_id}`}
                      {v.camera_code ? ` · ${v.camera_code}` : ""}
                    </button>
                  </li>
                ))}
                {!caseVideos.length && (
                  <li className="text-sm" style={{ color: INK2 }}>
                    No videos attached yet.
                  </li>
                )}
              </ul>
              <div className="flex gap-2">
                <select
                  className="flex-1 text-sm px-2 py-2 border rounded-sm"
                  style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                  value={addVideoId}
                  onChange={(e) => setAddVideoId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Add video…</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.original_filename}
                    </option>
                  ))}
                </select>
                <PrimaryBtn
                  disabled={!addVideoId}
                  onClick={async () => {
                    if (!addVideoId) return;
                    await forensicApi.addVideoToCase(id, Number(addVideoId));
                    setAddVideoId("");
                    load();
                  }}
                >
                  Attach
                </PrimaryBtn>
              </div>
              {detail.notes && (
                <p className="text-sm mt-4 pt-4 border-t" style={{ color: INK, borderColor: BORDER }}>
                  {detail.notes}
                </p>
              )}
            </div>

            <div className="border rounded-lg p-5" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: INK2 }}>
                Collaboration
              </p>
              <div className="space-y-2 max-h-48 overflow-auto mb-3">
                {comments.map((c) => (
                  <div key={c.id} className="text-sm border-b pb-2" style={{ borderColor: BORDER, color: INK }}>
                    <p>{c.body}</p>
                    <p className="font-mono text-[10px] mt-1" style={{ color: INK2 }}>
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
                {!comments.length && (
                  <p className="text-sm" style={{ color: INK2 }}>
                    No comments yet. Mention teammates with @username.
                  </p>
                )}
              </div>
              <textarea
                className="w-full text-sm px-3 py-2 border rounded-sm mb-2 min-h-[64px]"
                style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                placeholder="Add a note or @mention…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <PrimaryBtn
                disabled={!comment.trim()}
                onClick={async () => {
                  const mentions = Array.from(comment.matchAll(/@(\w+)/g)).map((m) => m[1]);
                  await forensicApi.createComment({ body: comment.trim(), case_id: id, mentions });
                  setComment("");
                  load();
                }}
              >
                Post comment
              </PrimaryBtn>
            </div>
          </div>

          <div className="border rounded-lg p-5" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-4" style={{ color: INK2 }}>
              Multi-camera timeline sync
            </p>
            {!lanes.length && (
              <p className="text-sm" style={{ color: INK2 }}>
                Attach completed videos to see synchronized lanes.
              </p>
            )}
            <div className="space-y-4">
              {lanes.map((lane) => (
                <div key={lane.video_id}>
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      className="text-xs font-mono"
                      style={{ color: ACCENT }}
                      onClick={() => router.push(`/video/${lane.video_id}`)}
                    >
                      {lane.camera_code || lane.filename || `CAM-${lane.video_id}`}
                    </button>
                    <span className="text-[10px]" style={{ color: INK2 }}>
                      {lane.events?.length || 0} events
                    </span>
                  </div>
                  <div className="relative h-8 rounded-sm border" style={{ backgroundColor: CANVAS, borderColor: BORDER }}>
                    {(lane.events || []).slice(0, 60).map((ev, i) => {
                      const left = Math.min(98, Math.max(0, (ev.start_seconds / duration) * 100));
                      return (
                        <button
                          key={`${lane.video_id}-${i}`}
                          type="button"
                          title={ev.description || ev.activity_type}
                          className="absolute top-1.5 w-2 h-5 rounded-sm"
                          style={{ left: `${left}%`, backgroundColor: ACCENT }}
                          onClick={() => router.push(`/video/${lane.video_id}?t=${ev.start_seconds}`)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
