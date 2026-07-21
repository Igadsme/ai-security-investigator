import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { CheckCircle, FileVideo, Loader2, UploadCloud } from "lucide-react";
import Layout from "@/components/Layout";
import { PrimaryBtn, TopBar } from "@/components/ui-kit";
import { Case, forensicApi, videoApi } from "@/services/api";
import {
  ACCENT,
  ACCENT_SOFT,
  BORDER,
  CANVAS,
  INK,
  INK2,
  PANEL,
} from "@/lib/theme";

const STAGES = ["Extracting metadata", "Detecting objects", "Tracking", "Saving"];

function stageIndex(stage?: string, progress?: number): number {
  if (!stage) return 0;
  const s = stage.toLowerCase();
  if (s.includes("done") || s.includes("saving") || (progress ?? 0) >= 95) return 4;
  if (s.includes("index") || s.includes("track")) return 2;
  if (s.includes("detect")) return 1;
  if (s.includes("extract") || s.includes("meta")) return 0;
  if ((progress ?? 0) >= 80) return 2;
  if ((progress ?? 0) >= 10) return 1;
  return 0;
}

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [videoId, setVideoId] = useState<number | null>(null);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [cameraCode, setCameraCode] = useState("");
  const [retentionDays, setRetentionDays] = useState("");
  const [caseId, setCaseId] = useState<number | "">("");
  const [cases, setCases] = useState<Case[]>([]);
  const [batchMsg, setBatchMsg] = useState("");

  useEffect(() => {
    forensicApi.listCases().then(({ data }) => setCases(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const [{ data: video }, { data: job }] = await Promise.all([
          videoApi.get(videoId),
          videoApi.getJob(videoId),
        ]);
        if (cancelled) return;
        const idx = stageIndex(job.stage, job.progress);
        setStage(idx);
        if (video.status === "completed" || job.status === "completed") {
          setStage(4);
          setTimeout(() => router.push(`/video/${videoId}`), 800);
        } else if (video.status === "failed" || job.status === "failed") {
          setError(video.error_message || "Processing failed");
        }
      } catch {
        /* keep polling */
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [videoId, router]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setBatchFiles([]);
    setStage(-1);
    setError("");
    setVideoId(null);
  };

  const startUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setStage(0);
    try {
      const { data } = await videoApi.upload(file, {
        camera_code: cameraCode || undefined,
        retention_days: retentionDays ? Number(retentionDays) : undefined,
        case_id: caseId === "" ? undefined : Number(caseId),
      });
      setVideoId(data.id);
    } catch {
      setError("Upload failed");
      setStage(-1);
    } finally {
      setUploading(false);
    }
  };

  const startBatch = async () => {
    if (!batchFiles.length) return;
    setUploading(true);
    setError("");
    setBatchMsg("");
    try {
      const codes = cameraCode
        ? batchFiles.map((_, i) => `${cameraCode}${i > 0 ? `-${i + 1}` : ""}`).join(",")
        : undefined;
      const { data } = await forensicApi.batchUpload(batchFiles, {
        case_id: caseId === "" ? undefined : Number(caseId),
        camera_codes: codes,
        retention_days: retentionDays ? Number(retentionDays) : undefined,
      });
      setBatchMsg(`Batch ${data.batch_id.slice(0, 8)}… — ${data.videos.length} videos queued`);
      if (data.videos[0]) setVideoId(data.videos[0].video_id);
      setStage(0);
    } catch {
      setError("Batch upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-screen" style={{ backgroundColor: CANVAS }}>
        <TopBar title="Upload" subtitle="Single or batch CCTV ingest — camera tags & retention" />
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="max-w-xl space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px]" style={{ color: INK2 }}>
                Camera code
                <input
                  className="mt-1 w-full text-sm px-3 py-2 border rounded-sm"
                  style={{ borderColor: BORDER, backgroundColor: PANEL, color: INK }}
                  placeholder="ENT-01"
                  value={cameraCode}
                  onChange={(e) => setCameraCode(e.target.value)}
                />
              </label>
              <label className="block text-[11px]" style={{ color: INK2 }}>
                Retention days
                <input
                  className="mt-1 w-full text-sm px-3 py-2 border rounded-sm"
                  style={{ borderColor: BORDER, backgroundColor: PANEL, color: INK }}
                  placeholder="90"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-[11px]" style={{ color: INK2 }}>
              Attach to case (optional)
              <select
                className="mt-1 w-full text-sm px-3 py-2 border rounded-sm"
                style={{ borderColor: BORDER, backgroundColor: PANEL, color: INK }}
                value={caseId}
                onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">None</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>

            <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: INK2 }}>
              Footage source
            </p>

            <div
              className="relative flex flex-col items-center justify-center p-14 rounded-lg cursor-pointer transition-all"
              style={{
                border: `2px dashed ${isDragOver ? ACCENT : BORDER}`,
                backgroundColor: isDragOver ? ACCENT_SOFT : PANEL,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 1) {
                  setBatchFiles(files);
                  setFile(null);
                } else {
                  pickFile(files[0]);
                }
              }}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".mp4,.avi,.mov,.mkv,.webm"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <UploadCloud size={40} className="mb-4" style={{ color: isDragOver ? ACCENT : INK2 }} />
              {file ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FileVideo size={14} style={{ color: ACCENT }} />
                    <p className="text-sm font-medium" style={{ color: INK }}>
                      {file.name}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: INK2 }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
                  </p>
                </div>
              ) : batchFiles.length ? (
                <div className="text-center">
                  <p className="text-sm font-medium mb-1" style={{ color: INK }}>
                    {batchFiles.length} files selected for batch
                  </p>
                  <p className="text-xs" style={{ color: INK2 }}>
                    {batchFiles.map((f) => f.name).join(", ").slice(0, 80)}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium mb-1" style={{ color: INK }}>
                    Drop footage here, or click to browse
                  </p>
                  <p className="text-xs" style={{ color: INK2 }}>
                    Accepts MP4, AVI, MOV · drop multiple for batch
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {file && stage < 0 && (
                <>
                  <PrimaryBtn onClick={startUpload} disabled={uploading}>
                    {uploading ? "Uploading…" : "Begin analysis"}
                  </PrimaryBtn>
                  <button type="button" className="text-sm" style={{ color: INK2 }} onClick={() => setFile(null)}>
                    Remove
                  </button>
                </>
              )}
              <input
                ref={batchRef}
                type="file"
                multiple
                accept=".mp4,.avi,.mov,.mkv,.webm"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setBatchFiles(files);
                  setFile(null);
                }}
              />
              <button
                type="button"
                className="text-sm px-3 py-2 border rounded-sm"
                style={{ borderColor: BORDER, color: INK, backgroundColor: PANEL }}
                onClick={() => batchRef.current?.click()}
              >
                Select batch…
              </button>
              {batchFiles.length > 0 && stage < 0 && (
                <PrimaryBtn onClick={startBatch} disabled={uploading}>
                  {uploading ? "Uploading…" : `Batch upload (${batchFiles.length})`}
                </PrimaryBtn>
              )}
            </div>

            {batchMsg && (
              <p className="text-sm font-mono" style={{ color: INK2 }}>
                {batchMsg}
              </p>
            )}

            {error && (
              <p className="text-sm" style={{ color: "#A33232" }}>
                {error}
              </p>
            )}

            {stage >= 0 && (
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: BORDER }}>
                <div className="px-5 py-4 border-b" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium" style={{ color: INK }}>
                      {stage < STAGES.length ? "Analysing footage…" : "Analysis complete"}
                    </p>
                    {stage >= STAGES.length && (
                      <span className="text-xs font-medium" style={{ color: "#1F7A52" }}>
                        Ready to investigate
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs mt-0.5" style={{ color: INK2 }}>
                    {file?.name || `${batchFiles.length} files`}
                  </p>
                </div>
                <div className="px-5 py-4 flex flex-col gap-4" style={{ backgroundColor: CANVAS }}>
                  {STAGES.map((s, i) => {
                    const done = i < stage;
                    const active = i === stage && stage < STAGES.length;
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {done ? (
                            <CheckCircle size={16} style={{ color: "#1F7A52" }} />
                          ) : active ? (
                            <Loader2 size={16} className="animate-spin" style={{ color: ACCENT }} />
                          ) : (
                            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: "#E7EBEA", borderColor: BORDER }} />
                          )}
                        </div>
                        <span
                          className="text-sm flex-1"
                          style={{
                            color: done ? "#1F7A52" : active ? ACCENT : INK2,
                            fontWeight: active ? 500 : 400,
                          }}
                        >
                          {s}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
