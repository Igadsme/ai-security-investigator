import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { videoApi, ProcessingJob } from "@/services/api";

interface Props {
  videoId: number;
  onComplete?: () => void;
}

export default function ProcessingStatus({ videoId, onComplete }: Props) {
  const [job, setJob] = useState<ProcessingJob | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const { data } = await videoApi.getJob(videoId);
        if (!active) return;
        setJob(data);
        if (data.status === "completed") {
          onComplete?.();
          return;
        }
        if (data.status !== "failed") {
          setTimeout(poll, 2000);
        }
      } catch {
        setTimeout(poll, 3000);
      }
    };
    poll();
    return () => { active = false; };
  }, [videoId, onComplete]);

  if (!job) {
    return (
      <div className="card flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span className="text-slate-400">Loading processing status...</span>
      </div>
    );
  }

  const icon =
    job.status === "completed" ? (
      <CheckCircle className="w-5 h-5 text-green-400" />
    ) : job.status === "failed" ? (
      <XCircle className="w-5 h-5 text-red-400" />
    ) : (
      <Loader2 className="w-5 h-5 animate-spin text-accent" />
    );

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <div>
          <p className="font-medium text-slate-200 capitalize">{job.stage.replace(/_/g, " ")}</p>
          <p className="text-sm text-slate-500">Status: {job.status}</p>
        </div>
        <span className="ml-auto font-mono text-accent">{Math.round(job.progress)}%</span>
      </div>
      <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-accent-glow transition-all duration-500"
          style={{ width: `${job.progress}%` }}
        />
      </div>
    </div>
  );
}
