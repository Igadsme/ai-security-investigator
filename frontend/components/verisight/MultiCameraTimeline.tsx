import React, { useState, useEffect } from 'react';
import {
  Clock,
  Video,
  User,
  Car,
  Package,
  Layers,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Share2,
} from 'lucide-react';
import { CaseData, TrackedSubject } from '@/types/verisight';
import { formatTimestamp } from '@/lib/format';

interface MultiCameraTimelineProps {
  currentCase: CaseData;
  onOpenClipAtTime: (clipId: string, timeSec: number) => void;
}

export const MultiCameraTimeline: React.FC<MultiCameraTimelineProps> = ({
  currentCase,
  onOpenClipAtTime,
}) => {
  const [masterTimeSec, setMasterTimeSec] = useState<number>(36);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [highlightReIdSubject, setHighlightReIdSubject] = useState<string | null>('SUBJECT-ALPHA-01');

  const maxDuration = Math.max(...(currentCase?.clips || []).map((c) => c.durationSeconds || 0), 120);

  // Playback timer effect
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setMasterTimeSec((prev) => {
          if (prev >= maxDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, maxDuration]);

  return (
    <div id="multi-camera-timeline-view" className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            Multi-Camera Synchronized Timeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronize playback across all facility angles and correlate entity movement across camera coverage zones.
          </p>
        </div>

        {/* Master Playback Controls */}
        <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 p-1.5 rounded-lg">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            title={isPlaying ? 'Pause master sync' : 'Play master sync'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            onClick={() => {
              setMasterTimeSec(0);
              setIsPlaying(false);
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
            title="Reset to 00:00"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="font-mono text-slate-200 text-xs font-medium px-2.5 py-1 bg-slate-900 rounded border border-slate-800">
            <span>{formatTimestamp(masterTimeSec)}</span>
            <span className="text-slate-500"> / {formatTimestamp(maxDuration)}</span>
          </div>
        </div>
      </div>

      {/* Cross-Camera Subject Tracking Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
            <Share2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Cross-Camera Subject Correlation:</span>
          </span>
          <span className="text-xs text-slate-400">Select entity to trace movement between cameras</span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setHighlightReIdSubject('SUBJECT-ALPHA-01')}
            className={`px-3.5 py-2 rounded-lg border text-xs flex items-center space-x-2.5 transition-colors ${
              highlightReIdSubject === 'SUBJECT-ALPHA-01'
                ? 'bg-blue-950/50 border-blue-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <User className="w-4 h-4 text-blue-400" />
            <div className="text-left">
              <div className="font-medium">Subject 01 (Person in Dark Hoodie)</div>
              <div className="text-[11px] text-slate-400">Gate Entrance → Loading Bay 4 → Staging Room</div>
            </div>
          </button>

          <button
            onClick={() => setHighlightReIdSubject('VEHICLE-ALPHA-01')}
            className={`px-3.5 py-2 rounded-lg border text-xs flex items-center space-x-2.5 transition-colors ${
              highlightReIdSubject === 'VEHICLE-ALPHA-01'
                ? 'bg-blue-950/50 border-blue-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Car className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="font-medium">Vehicle 01 (White Sedan)</div>
              <div className="text-[11px] text-slate-400">Gate Entrance → Loading Bay 4 Ingress</div>
            </div>
          </button>
        </div>
      </div>

      {/* Multi-Camera Synchronized Tracks */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
        {/* Master Timeline Scrubber Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400 px-1">
            <span>Master Timeline Scrubber</span>
            <span className="font-mono text-slate-300">{formatTimestamp(masterTimeSec)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxDuration}
            value={masterTimeSec}
            onChange={(e) => setMasterTimeSec(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Timeline Lanes */}
        <div className="space-y-3 pt-2">
          {(currentCase.clips || []).map((clip) => {
            const hasTracks = (clip.tracks || []).length > 0;
            return (
              <div
                key={clip.id}
                className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Video className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white">{clip.camera}</span>
                    <span className="text-[11px] text-slate-400">
                      ({clip.tracks.length} detected objects)
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenClipAtTime(clip.id, masterTimeSec)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1"
                  >
                    <span>Open in Player</span>
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Track Lane Visualization */}
                <div className="relative h-9 bg-slate-900 rounded border border-slate-800/80 overflow-hidden flex items-center">
                  {/* Master Playhead Indicator */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
                    style={{ left: `${(masterTimeSec / maxDuration) * 100}%` }}
                  />

                  {/* Render Object presence segments */}
                  {(clip.tracks || []).map((track) => {
                    const startPct = (track.firstSeenSec / maxDuration) * 100;
                    const widthPct = Math.max(
                      2,
                      ((track.lastSeenSec - track.firstSeenSec) / maxDuration) * 100
                    );

                    let bgClass = 'bg-blue-600/60 border-blue-500';
                    if (track.targetClass === 'car') bgClass = 'bg-amber-600/60 border-amber-500';
                    if (track.targetClass === 'bag') bgClass = 'bg-emerald-600/60 border-emerald-500';

                    return (
                      <div
                        key={track.id}
                        onClick={() => {
                          setMasterTimeSec(track.firstSeenSec);
                          onOpenClipAtTime(clip.id, track.firstSeenSec);
                        }}
                        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                        className={`absolute h-6 rounded border ${bgClass} cursor-pointer px-1.5 flex items-center overflow-hidden hover:brightness-125 transition-all`}
                        title={`${track.id} (${track.targetClass}) | ${formatTimestamp(track.firstSeenSec)} - ${formatTimestamp(track.lastSeenSec)}`}
                      >
                        <span className="text-[10px] text-white font-medium truncate">
                          {track.id}
                        </span>
                      </div>
                    );
                  })}

                  {/* Render Event Dots */}
                  {(clip.events || []).map((evt) => {
                    const leftPct = (evt.timeSeconds / maxDuration) * 100;
                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          setMasterTimeSec(evt.timeSeconds);
                          onOpenClipAtTime(clip.id, evt.timeSeconds);
                        }}
                        style={{ left: `${leftPct}%` }}
                        className="absolute w-2.5 h-2.5 bg-rose-500 rounded-full border border-white -translate-x-1/2 cursor-pointer z-20 hover:scale-150 transition-transform"
                        title={`Event: ${evt.title} (${evt.timestamp})`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
