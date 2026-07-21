import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PrimaryBtn, TopBar } from "@/components/ui-kit";
import { Camera, forensicApi, Site } from "@/services/api";
import { ACCENT, BORDER, CANVAS, INK, INK2, PANEL } from "@/lib/theme";

export default function MapPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<number | "">("");
  const [cameras, setCameras] = useState<Array<Camera & { detection_count?: number }>>([]);
  const [name, setName] = useState("");
  const [camForm, setCamForm] = useState({ camera_code: "", name: "", pos_x: 50, pos_y: 50 });
  const [rtsp, setRtsp] = useState("");
  const [selectedCam, setSelectedCam] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const loadSites = () =>
    forensicApi.listSites().then(({ data }) => {
      setSites(data);
      if (data.length && !siteId) setSiteId(data[0].id);
    });

  useEffect(() => {
    loadSites().catch(() => {});
  }, []);

  useEffect(() => {
    if (!siteId) return;
    forensicApi
      .siteMap(Number(siteId))
      .then(({ data }) => setCameras(data.cameras || []))
      .catch(() =>
        forensicApi.listCameras(Number(siteId)).then(({ data }) => setCameras(data))
      );
  }, [siteId]);

  return (
    <Layout>
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: CANVAS }}>
        <TopBar title="Site map" subtitle="Camera positions and spatial detection density" />
        <div className="px-8 py-6 grid lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-4">
            <div className="border rounded-lg p-4" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: INK2 }}>
                Site
              </p>
              <select
                className="w-full text-sm px-2 py-2 border rounded-sm mb-3"
                style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                value={siteId}
                onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full text-sm px-2 py-2 border rounded-sm mb-2"
                style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                placeholder="New site name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <PrimaryBtn
                onClick={async () => {
                  if (!name.trim()) return;
                  const { data } = await forensicApi.createSite({ name: name.trim() });
                  setName("");
                  await loadSites();
                  setSiteId(data.id);
                }}
              >
                Add site
              </PrimaryBtn>
            </div>

            {siteId && (
              <div className="border rounded-lg p-4" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: INK2 }}>
                  Add camera
                </p>
                <input
                  className="w-full text-sm px-2 py-2 border rounded-sm mb-2"
                  style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                  placeholder="Code (e.g. ENT-01)"
                  value={camForm.camera_code}
                  onChange={(e) => setCamForm({ ...camForm, camera_code: e.target.value })}
                />
                <input
                  className="w-full text-sm px-2 py-2 border rounded-sm mb-2"
                  style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                  placeholder="Display name"
                  value={camForm.name}
                  onChange={(e) => setCamForm({ ...camForm, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="number"
                    className="text-sm px-2 py-2 border rounded-sm"
                    style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                    placeholder="X %"
                    value={camForm.pos_x}
                    onChange={(e) => setCamForm({ ...camForm, pos_x: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className="text-sm px-2 py-2 border rounded-sm"
                    style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                    placeholder="Y %"
                    value={camForm.pos_y}
                    onChange={(e) => setCamForm({ ...camForm, pos_y: Number(e.target.value) })}
                  />
                </div>
                <PrimaryBtn
                  onClick={async () => {
                    await forensicApi.createCamera({
                      site_id: Number(siteId),
                      camera_code: camForm.camera_code,
                      name: camForm.name || camForm.camera_code,
                      pos_x: camForm.pos_x,
                      pos_y: camForm.pos_y,
                    });
                    setCamForm({ camera_code: "", name: "", pos_x: 50, pos_y: 50 });
                    const { data } = await forensicApi.siteMap(Number(siteId));
                    setCameras(data.cameras || []);
                  }}
                >
                  Place camera
                </PrimaryBtn>
              </div>
            )}

            {selectedCam && (
              <div className="border rounded-lg p-4" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: INK2 }}>
                  Live RTSP (admin)
                </p>
                <input
                  className="w-full text-sm px-2 py-2 border rounded-sm mb-2"
                  style={{ borderColor: BORDER, backgroundColor: CANVAS, color: INK }}
                  placeholder="rtsp://…"
                  value={rtsp}
                  onChange={(e) => setRtsp(e.target.value)}
                />
                <div className="flex gap-2 flex-wrap">
                  <PrimaryBtn
                    onClick={async () => {
                      try {
                        await forensicApi.enableLive(selectedCam, rtsp);
                        setMsg("RTSP registered");
                      } catch {
                        setMsg("Admin role required");
                      }
                    }}
                  >
                    Enable live
                  </PrimaryBtn>
                  <PrimaryBtn
                    onClick={async () => {
                      try {
                        const { data } = await forensicApi.liveSnapshot(selectedCam);
                        setMsg(`Snapshot queued: video ${(data as any).video_id || "ok"}`);
                      } catch {
                        setMsg("Snapshot failed");
                      }
                    }}
                  >
                    Grab snapshot
                  </PrimaryBtn>
                </div>
                {msg && (
                  <p className="text-xs mt-2" style={{ color: INK2 }}>
                    {msg}
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            className="relative border rounded-lg min-h-[480px] overflow-hidden"
            style={{
              backgroundColor: PANEL,
              borderColor: BORDER,
              backgroundImage:
                "linear-gradient(rgba(43,110,106,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(43,110,106,0.06) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          >
            {!siteId && (
              <p className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: INK2 }}>
                Create or select a site to place cameras.
              </p>
            )}
            {cameras.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCam(c.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${c.pos_x ?? c.floor_x ?? 50}%`, top: `${c.pos_y ?? c.floor_y ?? 50}%` }}
                title={c.name}
              >
                <span
                  className="w-4 h-4 rounded-full border-2"
                  style={{
                    backgroundColor: selectedCam === c.id ? ACCENT : "#FAFBFA",
                    borderColor: ACCENT,
                    boxShadow: c.detection_count ? `0 0 0 6px rgba(43,110,106,0.15)` : undefined,
                  }}
                />
                <span className="mt-1 px-1.5 py-0.5 text-[10px] font-mono rounded-sm" style={{ backgroundColor: PANEL, color: INK, border: `1px solid ${BORDER}` }}>
                  {c.camera_code}
                  {c.detection_count != null ? ` · ${c.detection_count}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
