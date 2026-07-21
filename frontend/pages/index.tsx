import { useEffect, useState } from "react";
import Link from "next/link";
import { FileVideo, Clock, ChevronRight } from "lucide-react";
import Layout from "@/components/Layout";
import { videoApi, Video } from "@/services/api";

const statusColors: Record<string, string> = {
  uploaded: "badge-info",
  processing: "badge-warning",
  completed: "bg-green-500/20 text-green-300",
  failed: "badge-danger",
};

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    videoApi.list()
      .then(({ data }) => setVideos(data))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Dashboard</h1>
        <p className="text-slate-500">
          AI-powered surveillance video investigation platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card bg-gradient-to-br from-accent/10 to-transparent border-accent/20">
          <h3 className="font-semibold text-slate-200 mb-1">Upload Footage</h3>
          <p className="text-sm text-slate-500 mb-4">Analyze new surveillance video</p>
          <Link href="/upload" className="btn-primary text-sm inline-block">
            Upload Video
          </Link>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-1">Natural Language Search</h3>
          <p className="text-sm text-slate-500 mb-4">Query footage with plain English</p>
          <Link href="/search" className="btn-secondary text-sm inline-block">
            Start Searching
          </Link>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-200 mb-1">YOLO + DeepSORT</h3>
          <p className="text-sm text-slate-500">
            Object detection, tracking, and suspicious activity analysis
          </p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-slate-200 mb-4">Recent Videos</h2>

      {loading ? (
        <div className="card text-slate-500">Loading videos...</div>
      ) : videos.length === 0 ? (
        <div className="card text-center py-12">
          <FileVideo className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No videos uploaded yet</p>
          <Link href="/upload" className="btn-primary">
            Upload your first video
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <Link
              key={v.id}
              href={`/video/${v.id}`}
              className="card flex items-center gap-4 hover:border-accent/30 transition-colors group"
            >
              <div className="w-12 h-12 rounded-lg bg-surface-700 flex items-center justify-center">
                <FileVideo className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-200 truncate">{v.original_filename}</p>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className={`badge ${statusColors[v.status] || "badge-info"}`}>
                    {v.status}
                  </span>
                  {v.duration_seconds && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.round(v.duration_seconds)}s
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-accent transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
