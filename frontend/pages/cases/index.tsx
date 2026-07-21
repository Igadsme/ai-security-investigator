import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { PrimaryBtn, TopBar } from "@/components/ui-kit";
import { Case, forensicApi, Video, videoApi } from "@/services/api";
import { BORDER, CANVAS, INK, INK2, PANEL } from "@/lib/theme";

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    forensicApi.listCases().then(({ data }) => setCases(data)).catch(() => setCases([]));
    videoApi.list().then(({ data }) => setVideos(data)).catch(() => setVideos([]));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { data } = await forensicApi.createCase({
        title: title.trim(),
        description: description.trim() || undefined,
        video_ids: selectedVideos.length ? selectedVideos : undefined,
      });
      setTitle("");
      setDescription("");
      setSelectedVideos([]);
      router.push(`/cases/${data.id}`);
    } catch {
      setError("Could not create case (login required for investigators).");
    } finally {
      setCreating(false);
    }
  };

  const toggleVideo = (id: number) => {
    setSelectedVideos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Layout>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: CANVAS }}>
        <TopBar title="Cases" subtitle="Group videos, clips, and notes under one incident" />
        <div className="flex-1 px-8 py-6 grid lg:grid-cols-[340px_1fr] gap-6">
          <div className="border rounded-lg p-5 h-fit" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: INK2 }}>
              New case
            </p>
            <input
              className="w-full text-sm px-3 py-2 border rounded-sm mb-2"
              style={{ borderColor: BORDER, color: INK, backgroundColor: CANVAS }}
              placeholder="Incident title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full text-sm px-3 py-2 border rounded-sm mb-3 min-h-[80px]"
              style={{ borderColor: BORDER, color: INK, backgroundColor: CANVAS }}
              placeholder="Description / intake notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs mb-2" style={{ color: INK2 }}>
              Attach videos (optional)
            </p>
            <div className="max-h-40 overflow-auto mb-3 space-y-1">
              {videos.slice(0, 40).map((v) => (
                <label key={v.id} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: INK }}>
                  <input
                    type="checkbox"
                    checked={selectedVideos.includes(v.id)}
                    onChange={() => toggleVideo(v.id)}
                  />
                  {v.original_filename}
                </label>
              ))}
            </div>
            {error && (
              <p className="text-xs mb-2" style={{ color: "#A33232" }}>
                {error}
              </p>
            )}
            <PrimaryBtn onClick={create} disabled={creating || !title.trim()}>
              {creating ? "Creating…" : "Create case"}
            </PrimaryBtn>
          </div>

          <div className="border rounded-lg overflow-hidden" style={{ borderColor: BORDER }}>
            <div
              className="grid text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3 border-b"
              style={{
                gridTemplateColumns: "1fr 100px 160px",
                backgroundColor: PANEL,
                color: INK2,
                borderColor: BORDER,
              }}
            >
              <div>Case</div>
              <div>Status</div>
              <div>Opened</div>
            </div>
            {cases.length === 0 && (
              <p className="px-4 py-8 text-sm" style={{ color: INK2 }}>
                No cases yet. Create one to start a multi-camera investigation.
              </p>
            )}
            {cases.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/cases/${c.id}`)}
                className="w-full grid text-left px-4 py-3 border-b last:border-0 hover:opacity-90"
                style={{
                  gridTemplateColumns: "1fr 100px 160px",
                  backgroundColor: i % 2 === 0 ? CANVAS : PANEL,
                  borderColor: BORDER,
                }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: INK }}>
                    {c.title}
                  </p>
                  {c.description && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: INK2 }}>
                      {c.description}
                    </p>
                  )}
                </div>
                <div className="text-xs capitalize self-center" style={{ color: INK2 }}>
                  {String(c.status)}
                </div>
                <div className="font-mono text-xs self-center" style={{ color: INK2 }}>
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
