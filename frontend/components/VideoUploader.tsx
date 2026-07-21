import { useCallback, useState } from "react";
import { Upload, FileVideo, Loader2 } from "lucide-react";
import { videoApi } from "@/services/api";

interface Props {
  onUploaded: (videoId: number) => void;
}

export default function VideoUploader({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const { data } = await videoApi.upload(file, setProgress);
      onUploaded(data.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, []);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`card border-dashed border-2 transition-colors ${
        dragging ? "border-accent bg-accent/5" : "border-surface-600"
      }`}
    >
      <div className="flex flex-col items-center py-12">
        {uploading ? (
          <>
            <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
            <p className="text-slate-300 mb-2">Uploading... {progress}%</p>
            <div className="w-64 h-2 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-surface-700 flex items-center justify-center mb-4">
              <Upload className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-200 mb-1">
              Drop surveillance footage here
            </p>
            <p className="text-sm text-slate-500 mb-6">MP4, AVI, MOV, MKV supported</p>
            <label className="btn-primary cursor-pointer flex items-center gap-2">
              <FileVideo className="w-4 h-4" />
              Select Video
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </label>
          </>
        )}
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
}
