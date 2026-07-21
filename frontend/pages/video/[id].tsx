import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import Layout from "@/components/Layout";
import ProcessingStatus from "@/components/ProcessingStatus";
import StatsCards from "@/components/StatsCards";
import EventTimeline from "@/components/EventTimeline";
import SearchBar from "@/components/SearchBar";
import {
  videoApi,
  searchApi,
  Video,
  Stats,
  ActivityEvent,
  Track,
  SearchResult,
} from "@/services/api";

export default function VideoDetailPage() {
  const router = useRouter();
  const id = Number(router.query.id);
  const [video, setVideo] = useState<Video | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [summary, setSummary] = useState("");
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "tracks" | "search">("overview");

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [v, s, e, t] = await Promise.all([
        videoApi.get(id),
        videoApi.getStats(id),
        videoApi.getEvents(id),
        videoApi.getTracks(id),
      ]);
      setVideo(v.data);
      setStats(s.data);
      setEvents(e.data);
      setTracks(t.data);
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = async (query: string) => {
    const { data } = await searchApi.query(query, id);
    setSearchResults(data);
    setTab("search");
  };

  const generateSummary = async () => {
    const { data } = await searchApi.summary(id, "8:00 PM", "10:00 PM");
    setSummary(data.summary);
  };

  const showClip = async (start: number, end: number) => {
    const { data } = await searchApi.generateClip(id, start, end);
    setClipUrl(searchApi.clipUrl(data.filename));
  };

  if (!video) {
    return (
      <Layout>
        <div className="card text-slate-500">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 truncate">{video.original_filename}</h1>
        <p className="text-slate-500 text-sm mt-1">
          Status: <span className="capitalize">{video.status}</span>
          {video.duration_seconds && ` · ${Math.round(video.duration_seconds)}s`}
        </p>
      </div>

      {video.status === "processing" && (
        <div className="mb-6">
          <ProcessingStatus videoId={id} onComplete={loadData} />
        </div>
      )}

      {video.status === "completed" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-0 overflow-hidden">
              <video
                src={videoApi.streamUrl(id)}
                controls
                className="w-full aspect-video bg-black"
              />
            </div>
            <div className="space-y-4">
              {stats && <StatsCards stats={stats} />}
              <button onClick={generateSummary} className="btn-secondary w-full">
                Generate 8PM–10PM Summary
              </button>
              {summary && (
                <div className="card">
                  <h3 className="font-semibold text-slate-200 mb-2">AI Report</h3>
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                    {summary}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <SearchBar onSearch={handleSearch} />
          </div>

          <div className="flex gap-2 mb-6">
            {(["overview", "tracks", "search"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                  tab === t
                    ? "bg-accent/15 text-accent-glow"
                    : "text-slate-400 hover:bg-surface-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <EventTimeline events={events} onShowClip={showClip} />
          )}

          {tab === "tracks" && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-surface-600">
                    <th className="pb-3 pr-4">Track ID</th>
                    <th className="pb-3 pr-4">Object</th>
                    <th className="pb-3 pr-4">Color</th>
                    <th className="pb-3 pr-4">First Seen</th>
                    <th className="pb-3 pr-4">Last Seen</th>
                    <th className="pb-3">Frames</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((t) => (
                    <tr key={t.id} className="border-b border-surface-700/50">
                      <td className="py-3 pr-4 font-mono text-accent">#{t.track_id}</td>
                      <td className="py-3 pr-4 capitalize">{t.object_class}</td>
                      <td className="py-3 pr-4">{t.dominant_color || "—"}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{t.first_seen}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{t.last_seen}</td>
                      <td className="py-3">{t.frame_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "search" && searchResults && (
            <div className="card">
              <h3 className="font-semibold mb-4">
                Search Results ({searchResults.results.length})
              </h3>
              {searchResults.summary && (
                <pre className="text-sm text-slate-300 mb-4 whitespace-pre-wrap font-sans">
                  {searchResults.summary}
                </pre>
              )}
              <div className="space-y-2">
                {searchResults.results.map((r, i) => (
                  <div
                    key={i}
                    className="flex justify-between p-3 rounded-lg bg-surface-700/50"
                  >
                    <div>
                      <span className="font-mono text-accent text-sm mr-2">{r.timestamp}</span>
                      <span className="text-sm text-slate-300">{r.description}</span>
                    </div>
                    <button
                      onClick={() => showClip(r.timestamp_seconds, r.timestamp_seconds + 5)}
                      className="btn-secondary text-xs"
                    >
                      Show Event
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clipUrl && (
            <div className="card mt-6">
              <h3 className="font-semibold text-slate-200 mb-3">Event Clip</h3>
              <video src={clipUrl} controls className="w-full rounded-lg" />
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
