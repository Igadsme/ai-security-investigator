import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import VideoUploader from "@/components/VideoUploader";
import ProcessingStatus from "@/components/ProcessingStatus";
import { useState } from "react";

export default function UploadPage() {
  const router = useRouter();
  const [videoId, setVideoId] = useState<number | null>(null);

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Upload Video</h1>
        <p className="text-slate-500">
          Upload surveillance footage for AI analysis with YOLO detection and DeepSORT tracking
        </p>
      </div>

      {!videoId ? (
        <VideoUploader onUploaded={setVideoId} />
      ) : (
        <div className="space-y-6">
          <ProcessingStatus
            videoId={videoId}
            onComplete={() => router.push(`/video/${videoId}`)}
          />
          <p className="text-sm text-slate-500 text-center">
            Processing may take a few minutes depending on video length.
            You&apos;ll be redirected when complete.
          </p>
        </div>
      )}
    </Layout>
  );
}
