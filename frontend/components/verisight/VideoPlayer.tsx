import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Camera,
  Scissors,
  Layers,
  Shield,
  Sparkles,
  ZoomIn,
  Sun,
  Eye,
  Sliders,
  Maximize2,
  Check,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { VideoClip, TrackedSubject, DetectionPoint, BoundingBox } from '@/types/verisight';
import { formatTimestamp, formatTimestampWithMs } from '@/lib/format';

export type LensFilterMode = 'optical' | 'lowlux' | 'nvg' | 'thermal' | 'edge';

interface VideoPlayerProps {
  clip: VideoClip;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSelectTrack?: (track: TrackedSubject) => void;
  selectedTrackId?: string | null;
  onFlagFalsePositive?: (track: TrackedSubject) => void;
  onAddNoteAtCurrentTime?: (timeSec: number) => void;
  onGenerateClipSnippet?: (inSec: number, outSec: number) => void;
  isRedacted?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  clip,
  currentTime,
  onTimeUpdate,
  onSelectTrack,
  selectedTrackId,
  onFlagFalsePositive,
  onAddNoteAtCurrentTime,
  onGenerateClipSnippet,
  isRedacted = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(false);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [redactionActive, setRedactionActive] = useState<boolean>(isRedacted);
  const [lensFilter, setLensFilter] = useState<LensFilterMode>('optical');
  const [loupeActive, setLoupeActive] = useState<boolean>(false);
  const [loupeZoom, setLoupeZoom] = useState<number>(2.5);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);

  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [hoveredTrack, setHoveredTrack] = useState<TrackedSubject | null>(null);
  const [snapshotFlash, setSnapshotFlash] = useState<boolean>(false);

  // Sync external isRedacted prop
  useEffect(() => {
    setRedactionActive(isRedacted);
  }, [isRedacted]);

  // Main playback animation loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (now: number) => {
      if (isPlaying) {
        const deltaSec = ((now - lastTimestamp) / 1000) * playbackSpeed;
        const nextTime = currentTime + deltaSec;
        if (nextTime >= clip.durationSeconds) {
          onTimeUpdate(clip.durationSeconds);
          setIsPlaying(false);
        } else {
          onTimeUpdate(nextTime);
        }
      }
      lastTimestamp = now;
      renderCanvas();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    isPlaying,
    playbackSpeed,
    currentTime,
    clip,
    showBoxes,
    showTrails,
    showZones,
    redactionActive,
    selectedTrackId,
    hoveredTrack,
    lensFilter,
    loupeActive,
    loupeZoom,
    mouseCanvasPos,
  ]);

  // Handle custom video element sync if present
  useEffect(() => {
    if (videoRef.current && clip.videoUrl) {
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
        videoRef.current.currentTime = currentTime;
      }
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [currentTime, isPlaying, clip.videoUrl]);

  // Interpolate active detections at current timestamp
  const getActiveDetections = useCallback(() => {
    const active: { track: TrackedSubject; point: DetectionPoint; trail: BoundingBox[] }[] = [];
    (clip.tracks || []).forEach((track) => {
      if (currentTime >= track.firstSeenSec && currentTime <= track.lastSeenSec) {
        let closestPoint = track.points[0];
        let minDiff = Infinity;
        const recentTrail: BoundingBox[] = [];

        track.points.forEach((pt) => {
          const diff = Math.abs(pt.timeSeconds - currentTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestPoint = pt;
          }
          if (pt.timeSeconds <= currentTime && pt.timeSeconds >= currentTime - 4) {
            recentTrail.push(pt.box);
          }
        });

        if (closestPoint) {
          active.push({ track, point: closestPoint, trail: recentTrail });
        }
      }
    });
    return active;
  }, [clip.tracks, currentTime]);

  // Canvas drawing routine
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Base Scene rendering
    if (clip.videoUrl && videoRef.current && videoRef.current.readyState >= 2) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    } else {
      drawSurveillanceScene(ctx, width, height, clip.camera, currentTime, lensFilter);
    }

    // 2. Draw Zone / Tripwire Overlays
    if (showZones) {
      drawSecurityZones(ctx, width, height);
    }

    // 3. Draw Trajectory trails
    if (showTrails) {
      const activeDetections = getActiveDetections();
      activeDetections.forEach(({ track, trail }) => {
        if (trail.length > 1) {
          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.strokeStyle = track.targetClass === 'car' ? '#f59e0b' : '#3b82f6';
          ctx.setLineDash([4, 4]);

          trail.forEach((box, idx) => {
            const centerX = (box.x + box.w / 2) * (width / 100);
            const centerY = (box.y + box.h) * (height / 100);
            if (idx === 0) ctx.moveTo(centerX, centerY);
            else ctx.lineTo(centerX, centerY);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    // 4. Draw Bounding Boxes & Redactions
    const activeDetections = getActiveDetections();
    if (showBoxes) {
      activeDetections.forEach(({ track, point }) => {
        const isSelected = selectedTrackId === track.id;
        const isHovered = hoveredTrack?.id === track.id;
        const boxX = point.box.x * (width / 100);
        const boxY = point.box.y * (height / 100);
        const boxW = point.box.w * (width / 100);
        const boxH = point.box.h * (height / 100);

        // Privacy Redaction Mask
        if (redactionActive) {
          ctx.save();
          const pixelSize = 8;
          const cols = Math.floor(boxW / pixelSize);
          const rows = Math.floor(boxH / pixelSize);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              ctx.fillStyle = (r + c) % 2 === 0 ? '#1e293b' : '#334155';
              ctx.fillRect(boxX + c * pixelSize, boxY + r * pixelSize, pixelSize, pixelSize);
            }
          }
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1;
          ctx.strokeRect(boxX, boxY, boxW, boxH);
          ctx.fillStyle = '#f8fafc';
          ctx.font = '10px sans-serif';
          ctx.fillText('Privacy Mask', boxX + 4, boxY + 12);
          ctx.restore();
          return;
        }

        // Color coding by class
        let strokeColor = '#3b82f6'; // Blue for person
        if (track.targetClass === 'car' || track.targetClass === 'truck') strokeColor = '#f59e0b';
        if (track.targetClass === 'bag') strokeColor = '#10b981';
        if (track.targetClass === 'bike') strokeColor = '#a855f7';
        if (track.isFalsePositive) strokeColor = '#94a3b8';

        if (isSelected) strokeColor = '#ef4444';

        // Draw Clean Standard Bounding Box
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSelected || isHovered ? 2 : 1.5;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        if (isSelected || isHovered) {
          ctx.fillStyle = `${strokeColor}22`;
          ctx.fillRect(boxX, boxY, boxW, boxH);
        }

        // Clean label badge
        const confPct = Math.round(point.confidence * 100);
        const className = track.targetClass.charAt(0).toUpperCase() + track.targetClass.slice(1);
        const labelText = `${className} (${confPct}%)`;

        ctx.font = '500 11px sans-serif';
        const textWidth = ctx.measureText(labelText).width;

        // Label pill background
        ctx.fillStyle = isSelected ? '#ef4444' : strokeColor;
        ctx.fillRect(boxX, Math.max(0, boxY - 18), textWidth + 8, 18);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, boxX + 4, Math.max(13, boxY - 5));
      });
    }

    // 5. Digital Loupe Magnifier
    if (loupeActive && mouseCanvasPos) {
      drawInspectionLoupe(ctx, width, height, mouseCanvasPos.x, mouseCanvasPos.y, loupeZoom);
    }

    // 6. Clean Camera Overlay Header
    drawCleanCameraOverlay(ctx, width, height, clip.camera, currentTime);
  };

  // Realistic CCTV / Camera Scene Generator
  const drawSurveillanceScene = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cameraName: string,
    timeSec: number,
    mode: LensFilterMode
  ) => {
    // Mode background
    if (mode === 'nvg') {
      ctx.fillStyle = '#062810';
      ctx.fillRect(0, 0, w, h);
    } else if (mode === 'thermal') {
      const thermGrad = ctx.createLinearGradient(0, 0, 0, h);
      thermGrad.addColorStop(0, '#100028');
      thermGrad.addColorStop(0.5, '#350257');
      thermGrad.addColorStop(1, '#1a0033');
      ctx.fillStyle = thermGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (mode === 'edge') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
    } else if (mode === 'lowlux') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      // Standard optical
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(0.7, '#1f2937');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Perspective floor lines
    const horizon = h * 0.45;
    ctx.strokeStyle =
      mode === 'nvg'
        ? 'rgba(74, 222, 128, 0.2)'
        : mode === 'thermal'
        ? 'rgba(251, 146, 60, 0.2)'
        : 'rgba(100, 116, 139, 0.15)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w, horizon);
    ctx.stroke();

    const vpX = w * 0.5;
    const vpY = horizon;
    for (let i = -w * 0.3; i <= w * 1.3; i += w * 0.18) {
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(i, h);
      ctx.stroke();
    }

    // Warehouse background structures
    ctx.fillStyle = mode === 'nvg' ? 'rgba(20, 83, 45, 0.4)' : 'rgba(30, 41, 59, 0.6)';
    ctx.fillRect(w * 0.35, h * 0.18, w * 0.3, h * 0.32);

    ctx.strokeStyle = mode === 'nvg' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(71, 85, 105, 0.4)';
    ctx.strokeRect(w * 0.35, h * 0.18, w * 0.3, h * 0.32);

    // Realistic Scene Actors
    (clip.tracks || []).forEach((track) => {
      if (currentTime >= track.firstSeenSec && currentTime <= track.lastSeenSec) {
        let closestPt = track.points[0];
        let minD = Infinity;
        track.points.forEach((p) => {
          const d = Math.abs(p.timeSeconds - currentTime);
          if (d < minD) {
            minD = d;
            closestPt = p;
          }
        });

        if (closestPt) {
          const bx = closestPt.box.x * (w / 100);
          const by = closestPt.box.y * (h / 100);
          const bw = closestPt.box.w * (w / 100);
          const bh = closestPt.box.h * (h / 100);

          if (mode === 'thermal') {
            const heatGrad = ctx.createRadialGradient(
              bx + bw / 2,
              by + bh / 2,
              5,
              bx + bw / 2,
              by + bh / 2,
              Math.max(bw, bh) * 0.5
            );
            heatGrad.addColorStop(0, '#ffffff');
            heatGrad.addColorStop(0.3, '#fef08a');
            heatGrad.addColorStop(0.7, '#f97316');
            heatGrad.addColorStop(1, 'rgba(120, 0, 150, 0)');
            ctx.fillStyle = heatGrad;
            ctx.beginPath();
            ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.6, bh * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
          }

          if (mode === 'edge') {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx, by, bw, bh);
            return;
          }

          // Actor Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          ctx.ellipse(bx + bw / 2, by + bh, bw * 0.45, bh * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();

          if (track.targetClass === 'car' || track.targetClass === 'truck') {
            ctx.fillStyle = mode === 'nvg' ? '#166534' : track.color === 'white' ? '#e2e8f0' : '#334155';
            ctx.beginPath();
            ctx.roundRect(bx, by + bh * 0.3, bw, bh * 0.6, 4);
            ctx.fill();

            ctx.fillStyle = mode === 'nvg' ? '#14532d' : track.color === 'white' ? '#cbd5e1' : '#1e293b';
            ctx.beginPath();
            ctx.roundRect(bx + bw * 0.2, by, bw * 0.6, bh * 0.45, 3);
            ctx.fill();

            // Headlights
            ctx.fillStyle = mode === 'nvg' ? '#86efac' : 'rgba(254, 240, 138, 0.8)';
            ctx.fillRect(bx + bw * 0.05, by + bh * 0.5, 3, 3);
            ctx.fillRect(bx + bw * 0.9, by + bh * 0.5, 3, 3);
          } else if (track.targetClass === 'person') {
            // Head
            ctx.fillStyle = mode === 'nvg' ? '#4ade80' : track.color === 'yellow' ? '#eab308' : '#3b82f6';
            ctx.beginPath();
            ctx.arc(bx + bw / 2, by + bh * 0.2, bw * 0.22, 0, Math.PI * 2);
            ctx.fill();

            // Body
            ctx.fillRect(bx + bw * 0.2, by + bh * 0.35, bw * 0.6, bh * 0.35);

            // Legs
            ctx.fillStyle = mode === 'nvg' ? '#14532d' : '#0f172a';
            ctx.fillRect(bx + bw * 0.25, by + bh * 0.7, bw * 0.2, bh * 0.28);
            ctx.fillRect(bx + bw * 0.55, by + bh * 0.7, bw * 0.2, bh * 0.28);
          } else if (track.targetClass === 'bag') {
            ctx.fillStyle = mode === 'nvg' ? '#15803d' : '#0f172a';
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 3);
            ctx.fill();
            ctx.strokeStyle = mode === 'nvg' ? '#22c55e' : '#64748b';
            ctx.strokeRect(bx, by, bw, bh);
          }
        }
      }
    });
  };

  const drawSecurityZones = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    const zx = w * 0.3;
    const zy = h * 0.35;
    const zw = w * 0.45;
    const zh = h * 0.55;

    ctx.strokeRect(zx, zy, zw, zh);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
    ctx.fillRect(zx, zy, zw, zh);

    ctx.font = '500 11px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Zone A: Restricted Area', zx + 8, zy + 16);
    ctx.setLineDash([]);
    ctx.restore();
  };

  // Clean Inspection Loupe Magnifier
  const drawInspectionLoupe = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    mx: number,
    my: number,
    zoom: number
  ) => {
    const size = 150;
    const radius = size / 2;
    const px = (mx / 100) * w;
    const py = (my / 100) * h;

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.clip();

    // Zoomed view
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(zoom, zoom);
    ctx.translate(-px, -py);
    drawSurveillanceScene(ctx, w, h, clip.camera, currentTime, lensFilter);
    ctx.restore();

    ctx.restore();

    // Clean Border Ring
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Small label tag
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 25, py + radius + 4, 50, 16);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(px - 25, py + radius + 4, 50, 16);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${zoom}x Zoom`, px - 18, py + radius + 15);
  };

  // Clean On-Screen Camera Overlay
  const drawCleanCameraOverlay = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cameraName: string,
    timeSec: number
  ) => {
    ctx.save();

    // Top Header Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, w, 32);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 12px sans-serif';
    ctx.fillText(`Camera: ${cameraName}`, 12, 20);

    // Timestamp & Playback indicator
    const timecode = formatTimestampWithMs(timeSec);
    ctx.font = '500 12px monospace';
    ctx.fillStyle = '#94a3b8';
    const timeStr = `Time: ${timecode}`;
    const textW = ctx.measureText(timeStr).width;
    ctx.fillText(timeStr, w - textW - 12, 20);

    ctx.restore();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const activeDetections = getActiveDetections();
    const clicked = activeDetections.find(({ point }) => {
      const b = point.box;
      return clickX >= b.x && clickX <= b.x + b.w && clickY >= b.y && clickY <= b.y + b.h;
    });

    if (clicked && onSelectTrack) {
      onSelectTrack(clicked.track);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    setMouseCanvasPos({ x: mouseX, y: mouseY });

    const activeDetections = getActiveDetections();
    const hovered = activeDetections.find(({ point }) => {
      const b = point.box;
      return mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h;
    });

    setHoveredTrack(hovered ? hovered.track : null);
  };

  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSnapshotFlash(true);
    setTimeout(() => setSnapshotFlash(false), 150);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Snapshot_${clip.camera.replace(/[^a-zA-Z0-9]/g, '_')}_${formatTimestamp(currentTime).replace(/:/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const stepFrame = (forward: boolean) => {
    const step = 1; // 1 second step
    const target = forward
      ? Math.min(clip.durationSeconds, currentTime + step)
      : Math.max(0, currentTime - step);
    onTimeUpdate(target);
    setIsPlaying(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onTimeUpdate(val);
  };

  const handleSetInPoint = () => setInPoint(currentTime);
  const handleSetOutPoint = () => setOutPoint(currentTime);
  const handleExtractSnippet = () => {
    if (inPoint !== null && outPoint !== null && outPoint > inPoint) {
      if (onGenerateClipSnippet) onGenerateClipSnippet(inPoint, outPoint);
    }
  };

  return (
    <div
      id="video-player-container"
      ref={containerRef}
      className="flex flex-col bg-[#0f172a] border border-slate-800 rounded-lg overflow-hidden"
    >
      {/* Video Viewport */}
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center select-none group">
        {clip.videoUrl && (
          <video
            ref={videoRef}
            src={clip.videoUrl}
            className="hidden"
            playsInline
            muted
            crossOrigin="anonymous"
          />
        )}

        <canvas
          id="video-viewport-canvas"
          ref={canvasRef}
          width={1280}
          height={720}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => {
            setHoveredTrack(null);
            setMouseCanvasPos(null);
          }}
          className={`w-full h-full object-contain cursor-default transition-opacity duration-150 ${
            snapshotFlash ? 'opacity-25' : 'opacity-100'
          }`}
        />

        {/* Hover Target Info Card */}
        {hoveredTrack && (
          <div className="absolute bottom-6 left-4 bg-slate-900/95 border border-slate-700 p-2.5 rounded text-xs text-slate-200 shadow-lg pointer-events-none z-20 space-y-0.5">
            <div className="font-semibold text-white">
              {hoveredTrack.id} ({hoveredTrack.targetClass})
            </div>
            <div className="text-slate-400 text-[11px]">
              {hoveredTrack.notes || 'Tracked entity. Click to view history.'}
            </div>
          </div>
        )}

        {/* View Enhancements Floating Selector (Top-Right) */}
        <div className="absolute top-11 right-3 flex items-center space-x-1.5 bg-slate-900/90 border border-slate-700/80 p-1 rounded-md text-xs z-20">
          <button
            onClick={() => setLoupeActive(!loupeActive)}
            className={`px-2 py-1 rounded transition-colors flex items-center space-x-1 ${
              loupeActive
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Inspect Magnifier Tool"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Magnifier</span>
          </button>

          <button
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-2 py-1 rounded transition-colors flex items-center space-x-1 ${
              showBoxes
                ? 'bg-slate-700 text-blue-400 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Object Bounding Boxes"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Detections</span>
          </button>

          <button
            onClick={() => setRedactionActive(!redactionActive)}
            className={`px-2 py-1 rounded transition-colors flex items-center space-x-1 ${
              redactionActive
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Privacy Blur Mask"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy Blur</span>
          </button>

          <button
            onClick={takeSnapshot}
            className="px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center space-x-1"
            title="Save Frame Snapshot"
          >
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span>Snapshot</span>
          </button>
        </div>
      </div>

      {/* Scrubber Timeline Bar */}
      <div className="px-4 pt-3 pb-1 bg-slate-900 border-t border-slate-800 space-y-1.5">
        <div className="relative flex items-center">
          <input
            id="video-scrubber-slider"
            type="range"
            min={0}
            max={clip.durationSeconds}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />

          {/* Event markers on timeline */}
          {(clip.events || []).map((evt) => {
            const leftPct = (evt.timeSeconds / clip.durationSeconds) * 100;
            return (
              <div
                key={evt.id}
                onClick={() => onTimeUpdate(evt.timeSeconds)}
                className="absolute top-0 -mt-1 w-1.5 h-4 bg-rose-500 rounded-full cursor-pointer hover:scale-150 transition-transform"
                style={{ left: `${leftPct}%` }}
                title={`Event: ${evt.title} (${evt.timestamp})`}
              />
            );
          })}

          {/* Clip In / Out range highlight */}
          {inPoint !== null && outPoint !== null && (
            <div
              className="absolute top-0 h-2 bg-blue-500/40 rounded pointer-events-none"
              style={{
                left: `${(inPoint / clip.durationSeconds) * 100}%`,
                width: `${((outPoint - inPoint) / clip.durationSeconds) * 100}%`,
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="px-4 py-2.5 bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/80">
        {/* Left: Playback controls & Time readout */}
        <div className="flex items-center space-x-3">
          <button
            id="video-play-pause-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center justify-center shadow-sm"
            title={isPlaying ? 'Pause Video' : 'Play Video'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => stepFrame(false)}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Step Back 1s"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => stepFrame(true)}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Step Forward 1s"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => onTimeUpdate(0)}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Restart from Beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="text-slate-300 font-mono text-xs font-medium pl-1">
            <span>{formatTimestamp(currentTime)}</span>
            <span className="text-slate-500"> / </span>
            <span className="text-slate-400">{formatTimestamp(clip.durationSeconds)}</span>
          </div>
        </div>

        {/* Center: Filter & Speed Selectors */}
        <div className="flex items-center space-x-2.5">
          {/* View Filter Mode */}
          <div className="flex items-center space-x-1.5 bg-slate-800 px-2 py-1 rounded">
            <span className="text-slate-400 text-[11px]">Filter:</span>
            <select
              value={lensFilter}
              onChange={(e) => setLensFilter(e.target.value as LensFilterMode)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="optical" className="bg-slate-900">Standard</option>
              <option value="lowlux" className="bg-slate-900">Low Light</option>
              <option value="nvg" className="bg-slate-900">Night Vision</option>
              <option value="thermal" className="bg-slate-900">Thermal (IR)</option>
              <option value="edge" className="bg-slate-900">High Contrast</option>
            </select>
          </div>

          {/* Playback Speed */}
          <div className="flex items-center space-x-1.5 bg-slate-800 px-2 py-1 rounded">
            <span className="text-slate-400 text-[11px]">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="0.5" className="bg-slate-900">0.5x</option>
              <option value="1" className="bg-slate-900">1.0x</option>
              <option value="2" className="bg-slate-900">2.0x</option>
              <option value="4" className="bg-slate-900">4.0x</option>
            </select>
          </div>
        </div>

        {/* Right: Snippet Clip Extraction */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleSetInPoint}
            className={`px-2 py-1 rounded text-xs font-medium border ${
              inPoint !== null
                ? 'bg-blue-900/30 text-blue-300 border-blue-700'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Mark Clip Start Time"
          >
            Mark In {inPoint !== null ? `(${formatTimestamp(inPoint)})` : ''}
          </button>

          <button
            onClick={handleSetOutPoint}
            className={`px-2 py-1 rounded text-xs font-medium border ${
              outPoint !== null
                ? 'bg-blue-900/30 text-blue-300 border-blue-700'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Mark Clip End Time"
          >
            Mark Out {outPoint !== null ? `(${formatTimestamp(outPoint)})` : ''}
          </button>

          {inPoint !== null && outPoint !== null && outPoint > inPoint && (
            <button
              onClick={handleExtractSnippet}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Save Clip ({Math.round(outPoint - inPoint)}s)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
