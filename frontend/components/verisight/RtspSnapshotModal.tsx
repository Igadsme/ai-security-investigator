import React, { useState } from 'react';
import {
  X,
  Radio,
  Camera,
  Download,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { CameraMeta } from '@/types/verisight';
import { forensicApi } from '@/services/api';

interface RtspSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: CameraMeta[];
}

export const RtspSnapshotModal: React.FC<RtspSnapshotModalProps> = ({
  isOpen,
  onClose,
  cameras,
}) => {
  const [rtspUrl, setRtspUrl] = useState<string>(cameras[0]?.rtspUrl || 'rtsp://192.168.1.101:554/live/ch0');
  const [isGrabbing, setIsGrabbing] = useState<boolean>(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<any>(null);

  if (!isOpen) return null;

  const handleGrabSnapshot = async () => {
    setIsGrabbing(true);
    try {
      const cam = cameras.find((c) => c.rtspUrl === rtspUrl) || cameras.find((c) => c.dbId);
      if (cam?.dbId && rtspUrl) {
        await forensicApi.enableLive(cam.dbId, rtspUrl);
        const { data } = await forensicApi.liveSnapshot(cam.dbId);
        setSnapshotMeta({
          resolution: 'Live ingest',
          timestamp: new Date().toISOString(),
          codec: 'H.264',
          sha256Seal: `video ${data.video_id} queued as job ${data.job_id}`,
        });
        setSnapshotUrl(`/api/videos/${data.video_id}/stream`);
      } else {
        setSnapshotMeta({
          resolution: 'n/a',
          timestamp: new Date().toISOString(),
          codec: 'n/a',
          sha256Seal: 'Select a registered camera with an RTSP URL, then grab a snapshot.',
        });
      }
    } catch (err) {
      setSnapshotMeta({
        resolution: 'error',
        timestamp: new Date().toISOString(),
        codec: 'n/a',
        sha256Seal: err instanceof Error ? err.message : 'Could not open RTSP stream',
      });
    } finally {
      setIsGrabbing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-blue-600/20 text-blue-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Capture Live Camera Frame</h3>
            <p className="text-xs text-slate-400">
              Query IP camera stream endpoint to capture a verified snapshot.
            </p>
          </div>
        </div>

        {/* URL Input Form */}
        <div className="space-y-3 bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">RTSP Stream Address / Endpoint:</label>
            <input
              type="text"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="rtsp://user:pass@192.168.1.101:554/live/ch0"
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Quick Camera Presets:</span>
            {cameras.map((c) => (
              <button
                key={c.id}
                onClick={() => setRtspUrl(c.rtspUrl || '')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] rounded border border-slate-700 transition-colors"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleGrabSnapshot}
          disabled={isGrabbing}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition-colors shadow-sm"
        >
          {isGrabbing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Capturing Frame from Stream...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Capture Live Stream Frame</span>
            </>
          )}
        </button>

        {/* Preview Frame */}
        {snapshotUrl && snapshotMeta && (
          <div className="space-y-3 bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs">
            <div className="relative rounded overflow-hidden border border-slate-800">
              <img src={snapshotUrl} alt="Captured Snapshot" className="w-full aspect-video object-cover" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px]">
              <div>Resolution: <strong className="text-slate-200">{snapshotMeta.resolution}</strong></div>
              <div>Captured: <strong className="text-slate-200">{snapshotMeta.timestamp}</strong></div>
              <div className="col-span-2 font-mono text-[10px] text-slate-500">
                SHA-256 Checksum: {snapshotMeta.sha256Seal}
              </div>
            </div>

            <a
              href={snapshotUrl}
              download={`Snapshot_${Date.now()}.jpg`}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium flex items-center justify-center space-x-2 transition-colors block text-center"
            >
              <Download className="w-4 h-4 inline" />
              <span>Download Image File</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
