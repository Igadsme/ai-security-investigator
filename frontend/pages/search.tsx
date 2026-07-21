import { useEffect, useState } from "react";
import { Play, Filter } from "lucide-react";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import { searchApi, videoApi, Video, SearchResult } from "@/services/api";

export default function SearchPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<number | "">("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);

  useEffect(() => {
    videoApi.list().then(({ data }) => {
      const completed = data.filter((v) => v.status === "completed");
      setVideos(completed);
      if (completed.length) setSelectedVideo(completed[0].id);
    });
  }, []);

  const handleSearch = async (query: string) => {
    setLoading(true);
    setClipUrl(null);
    try {
      const { data } = await searchApi.query(
        query,
        selectedVideo ? Number(selectedVideo) : undefined
      );
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const showClip = async (start: number, end: number) => {
    if (!selectedVideo) return;
    try {
      const { data } = await searchApi.generateClip(Number(selectedVideo), start, end);
      setClipUrl(searchApi.clipUrl(data.filename));
    } catch {
      alert("Failed to generate clip");
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Natural Language Search</h1>
        <p className="text-slate-500">
          Ask questions about your surveillance footage in plain English
        </p>
      </div>

      {videos.length > 0 && (
        <div className="mb-6">
          <label className="text-sm text-slate-400 mb-2 block">Select Video</label>
          <select
            className="input-field max-w-md"
            value={selectedVideo}
            onChange={(e) => setSelectedVideo(e.target.value ? Number(e.target.value) : "")}
          >
            {videos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.original_filename}
              </option>
            ))}
          </select>
        </div>
      )}

      <SearchBar onSearch={handleSearch} loading={loading} />

      {results && (
        <div className="mt-8 space-y-6">
          {results.parsed_filters && Object.keys(results.parsed_filters).length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-400">Parsed Filters</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(results.parsed_filters).map(([k, v]) => (
                  <span key={k} className="badge-info font-mono text-xs">
                    {k}={String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {results.unique_count !== undefined && results.unique_count !== null && (
            <div className="card bg-accent/5 border-accent/20">
              <p className="text-lg">
                Unique matches: <span className="font-bold text-accent-glow">{results.unique_count}</span>
              </p>
            </div>
          )}

          {results.summary && (
            <div className="card">
              <h3 className="font-semibold text-slate-200 mb-3">AI Summary</h3>
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                {results.summary}
              </pre>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold text-slate-200 mb-4">
              Results ({results.results.length})
            </h3>
            {results.results.length === 0 ? (
              <p className="text-slate-500">No matching events found</p>
            ) : (
              <div className="space-y-2">
                {results.results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-700/50 hover:bg-surface-700"
                  >
                    <div>
                      <span className="font-mono text-sm text-accent mr-3">{r.timestamp}</span>
                      <span className="text-sm text-slate-300">{r.description}</span>
                      <span className="ml-2 text-xs text-slate-600">({r.source})</span>
                    </div>
                    <button
                      onClick={() => showClip(r.timestamp_seconds, r.timestamp_seconds + 5)}
                      className="btn-secondary text-xs flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Clip
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {clipUrl && (
            <div className="card">
              <h3 className="font-semibold text-slate-200 mb-3">Generated Clip</h3>
              <video src={clipUrl} controls className="w-full rounded-lg" />
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
