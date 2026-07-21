import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ArrowRight, Eye, Play } from "lucide-react";
import Layout from "@/components/Layout";
import { PrimaryBtn, TopBar } from "@/components/ui-kit";
import { Case, forensicApi, searchApi, Video, videoApi } from "@/services/api";
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
} from "@/lib/theme";

type ResultRow = {
  timestamp: string;
  timestamp_seconds: number;
  description: string;
  object_class?: string;
  track_id?: number;
  confidence?: number;
  source: string;
  video_id?: number;
  color?: string;
  match_reason?: { attributes?: string[]; confidence_threshold?: number; frame_number?: number };
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<number | "">("");
  const [selectedCase, setSelectedCase] = useState<number | "">("");
  const [objectClass, setObjectClass] = useState("");
  const [color, setColor] = useState("");
  const [cameraCode, setCameraCode] = useState("");
  const [minConfidence, setMinConfidence] = useState(0.4);
  const [startSec, setStartSec] = useState("");
  const [endSec, setEndSec] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [facets, setFacets] = useState<{ object_class?: Record<string, number>; color?: Record<string, number> }>({});
  const [summary, setSummary] = useState<string | undefined>();
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState("");

  const examples = [
    "Show me every person who entered",
    "When did the white car appear?",
    "Find backpacks between 8 PM and 10 PM",
  ];

  useEffect(() => {
    videoApi
      .list()
      .then(({ data }) => {
        const completed = data.filter((v) => v.status === "completed");
        setVideos(completed);
        if (completed.length) setSelectedVideo(completed[0].id);
      })
      .catch(() => setVideos([]));
    forensicApi.listCases().then(({ data }) => setCases(data)).catch(() => {});
  }, []);

  const runSearch = async (q?: string) => {
    const text = q ?? query;
    setQuery(text);
    setHasSearched(true);
    setLoading(true);
    try {
      const { data } = await searchApi.faceted({
        query: text.trim() || undefined,
        video_id: selectedVideo ? Number(selectedVideo) : undefined,
        case_id: selectedCase ? Number(selectedCase) : undefined,
        object_class: objectClass || undefined,
        color: color || undefined,
        camera_code: cameraCode || undefined,
        min_confidence: minConfidence,
        start_seconds: startSec ? Number(startSec) : undefined,
        end_seconds: endSec ? Number(endSec) : undefined,
      });
      setResults((data.results || []) as ResultRow[]);
      setFacets((data as any).facets || {});
      setSummary(data.summary);
    } catch {
      // Fallback to NL-only search
      try {
        const { data } = await searchApi.query(text, selectedVideo ? Number(selectedVideo) : undefined);
        setResults(data.results || []);
        setSummary(data.summary);
      } catch {
        setResults([]);
        setSummary(undefined);
      }
    } finally {
      setLoading(false);
    }
  };

  const resultCols = "90px 1fr 90px 70px 70px 110px";

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-screen" style={{ backgroundColor: CANVAS }}>
        <TopBar title="Search" subtitle="Natural language + facet filters with explainable matches" />
        <div className="flex-1 overflow-auto px-8 py-6" style={GRID_BG}>
          <div className="grid lg:grid-cols-[240px_1fr] gap-6">
            <aside className="border rounded-lg p-4 h-fit space-y-3" style={{ backgroundColor: PANEL, borderColor: BORDER }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: INK2 }}>
                Facets
              </p>
              <label className="block text-[11px]" style={{ color: INK2 }}>
                Video
                <select
                  className="mt-1 w-full text-sm px-2 py-1.5 border rounded-sm"
                  style={{ backgroundColor: CANVAS, color: INK, borderColor: BORDER }}
                  value={selectedVideo}
                  onChange={(e) => setSelectedVideo(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">All videos</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.original_filename}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px]" style={{ color: INK2 }}>
                Case
                <select
                  className="mt-1 w-full text-sm px-2 py-1.5 border rounded-sm"
                  style={{ backgroundColor: CANVAS, color: INK, borderColor: BORDER }}
                  value={selectedCase}
                  onChange={(e) => setSelectedCase(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Any case</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px]" style={{ color: INK2 }}>
                Object class
                <input
                  className="mt-1 w-full text-sm px-2 py-1.5 border rounded-sm"
                  style={{ backgroundColor: CANVAS, color: INK, borderColor: BORDER }}
                  value={objectClass}
                  onChange={(e) => setObjectClass(e.target.value)}
                  placeholder="person, car…"
                />
              </label>
              <label className="block text-[11px]" style={{ color: INK2 }}>
                Color
                <input
                  className="mt-1 w-full text-sm px-2 py-1.5 border rounded-sm"
                  style={{ backgroundColor: CANVAS, color: INK, borderColor: BORDER }}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="red, white…"
                />
              </label>
              <label className="block text-[11px]" style={{ color: INK2 }}>
                Camera code
                <input
                  className="mt-1 w-full text-sm px-2 py-1.5 border rounded-sm"
                  style={{ backgroundColor: CANVAS, color: INK, borderColor: BORDER }}
                  value={cameraCode}
                  onChange={(e) => setCameraCode(e.target.value)}
                  placeholder="ENT-01"
                />
              </label>
              <label className="block text-[11px]" style={{ color: INK2 }}>
                Min confidence ({minConfidence.toFixed(2)})
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  className="mt-1 w-full"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px]" style={{ color: INK2 }}>
                  Start (s)
                  <input
                    className="mt-1 w-full text-sm px-2 py-1.5 border rounded-sm"
                    style={{ backgroundColor: CANVAS, color: INK, borderColor: BORDER }}
                    value={startSec}
                    onChange={(e) => setStartSec(e.target.value)}
                  />
                </label>
                <label className="block text-[11px]" style={{ color: INK2 }}>
                  End (s)
                  <input
                    className="mt-1 w-full text-sm px-2 py-1.5 border rounded-sm"
                    style={{ backgroundColor: CANVAS, color: INK, borderColor: BORDER }}
                    value={endSec}
                    onChange={(e) => setEndSec(e.target.value)}
                  />
                </label>
              </div>
              {Object.keys(facets.object_class || {}).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase mb-1" style={{ color: INK2 }}>
                    Classes in corpus
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(facets.object_class || {})
                      .slice(0, 12)
                      .map(([k, n]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setObjectClass(k)}
                          className="text-[10px] px-1.5 py-0.5 rounded-sm border"
                          style={{ borderColor: BORDER, color: INK, backgroundColor: objectClass === k ? ACCENT_SOFT : CANVAS }}
                        >
                          {k} ({n})
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <PrimaryBtn className="w-full" onClick={() => runSearch()}>
                Apply filters
              </PrimaryBtn>
            </aside>

            <div>
              <div className="max-w-3xl mb-5">
                <div className="relative flex items-stretch">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch();
                    }}
                    placeholder="Ask a question about the footage…"
                    className="flex-1 pl-4 pr-14 py-3.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2B6E6A]/30"
                    style={{ backgroundColor: PANEL, color: INK, borderColor: BORDER }}
                  />
                  <button
                    type="button"
                    onClick={() => runSearch()}
                    disabled={loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-sm transition-colors disabled:opacity-50"
                    style={{ backgroundColor: ACCENT, color: "#FAFBFA" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT_HOVER;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = ACCENT;
                    }}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => runSearch(ex)}
                      className="text-xs px-2.5 py-1 rounded-sm border"
                      style={{ borderColor: BORDER, color: INK2, backgroundColor: PANEL }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-3 items-center">
                  <input
                    className="text-xs px-2 py-1.5 border rounded-sm flex-1 max-w-xs"
                    style={{ borderColor: BORDER, backgroundColor: PANEL, color: INK }}
                    placeholder="Save as alert name…"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="text-xs px-3 py-1.5 rounded-sm border"
                    style={{ borderColor: BORDER, color: INK }}
                    onClick={async () => {
                      if (!saveName.trim()) return;
                      await forensicApi.createSavedSearch({
                        name: saveName.trim(),
                        query: query || undefined,
                        filters: {
                          object_class: objectClass || undefined,
                          color: color || undefined,
                          camera_code: cameraCode || undefined,
                          min_confidence: minConfidence,
                          video_id: selectedVideo || undefined,
                        },
                        is_alert: true,
                      });
                      setSaveName("");
                      router.push("/alerts");
                    }}
                  >
                    Save as alert
                  </button>
                </div>
              </div>

              {summary && (
                <p className="text-sm mb-4 max-w-3xl" style={{ color: INK2 }}>
                  {summary}
                </p>
              )}

              {hasSearched && (
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: BORDER }}>
                  <div
                    className="grid text-[11px] font-semibold uppercase tracking-[0.06em] px-4 py-3 border-b"
                    style={{ gridTemplateColumns: resultCols, backgroundColor: PANEL, color: INK2, borderColor: BORDER }}
                  >
                    <div>Time</div>
                    <div>Match</div>
                    <div>Class</div>
                    <div>Conf</div>
                    <div>Why</div>
                    <div className="text-right">Open</div>
                  </div>
                  {loading && (
                    <p className="px-4 py-6 text-sm" style={{ color: INK2 }}>
                      Searching…
                    </p>
                  )}
                  {!loading && !results.length && (
                    <p className="px-4 py-6 text-sm" style={{ color: INK2 }}>
                      No matches. Loosen confidence or clear a facet.
                    </p>
                  )}
                  {results.map((r, i) => (
                    <div
                      key={`${r.timestamp_seconds}-${i}`}
                      className="grid items-center px-4 py-3 border-b last:border-0 text-sm"
                      style={{
                        gridTemplateColumns: resultCols,
                        backgroundColor: i % 2 === 0 ? CANVAS : PANEL_ALT,
                        borderColor: BORDER,
                        color: INK,
                      }}
                    >
                      <div className="font-mono text-xs">{r.timestamp}</div>
                      <div className="text-xs pr-2">{r.description}</div>
                      <div className="text-xs capitalize">{r.object_class || "—"}</div>
                      <div className="font-mono text-xs">
                        {r.confidence != null ? r.confidence.toFixed(2) : "—"}
                      </div>
                      <div className="text-[10px]" style={{ color: INK2 }}>
                        {r.match_reason?.frame_number != null
                          ? `frame ${r.match_reason.frame_number}`
                          : r.source}
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border"
                          style={{ borderColor: BORDER, color: INK2 }}
                          onClick={() => {
                            const vid = r.video_id || selectedVideo;
                            if (vid) router.push(`/video/${vid}?t=${r.timestamp_seconds}`);
                          }}
                        >
                          <Eye size={9} />
                          View
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border"
                          style={{ borderColor: BORDER, color: INK2 }}
                          onClick={() => {
                            const vid = r.video_id || selectedVideo;
                            if (vid) router.push(`/video/${vid}?t=${r.timestamp_seconds}`);
                          }}
                        >
                          <Play size={9} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
