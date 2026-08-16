import React, { useEffect, useState } from 'react';
import {
  VideoClip,
  TrackedSubject,
  ActivityEvent,
  CaseData,
  InvestigatorNote,
  ObjectClass,
  UserRole,
} from '@/types/verisight';
import { VideoPlayer } from './VideoPlayer';
import {
  Clock,
  User,
  Car,
  Package,
  Bike,
  Plus,
  Flag,
  AlertTriangle,
  Layers,
  MessageSquare,
  FileText,
  Search,
  CheckCircle,
  X,
  Play,
  Tag,
} from 'lucide-react';
import { formatTimestamp } from '@/lib/format';
import { forensicApi, OverlayPoint } from '@/services/api';

interface InvestigationStudioProps {
  currentCase: CaseData;
  activeClip?: VideoClip;
  currentTime?: number;
  setCurrentTime?: (time: number) => void;
  selectedClipId?: string;
  setSelectedClipId?: (clipId: string) => void;
  userRole?: UserRole;
  onAddNote: (note: InvestigatorNote) => void;
  onFlagFalsePositive: (trackId: string, reason: string) => void;
  onGenerateSnippet: (clipId: string, inSec: number, outSec: number) => void;
  onJumpToSearch?: () => void;
}

export const InvestigationStudio: React.FC<InvestigationStudioProps> = ({
  currentCase,
  activeClip: activeClipProp,
  currentTime: currentTimeProp,
  setCurrentTime: setCurrentTimeProp,
  selectedClipId: selectedClipIdProp,
  setSelectedClipId: setSelectedClipIdProp,
  userRole = 'investigator',
  onAddNote,
  onFlagFalsePositive,
  onGenerateSnippet,
  onJumpToSearch,
}) => {
  const [internalClipId, setInternalClipId] = useState<string>(
    selectedClipIdProp || currentCase?.clips?.[0]?.id || ''
  );
  const [internalCurrentTime, setInternalCurrentTime] = useState<number>(currentTimeProp || 0);

  const selectedClipId = selectedClipIdProp !== undefined ? selectedClipIdProp : internalClipId;
  const setSelectedClipId = (id: string) => {
    setInternalClipId(id);
    setSelectedClipIdProp?.(id);
  };

  const currentTime = currentTimeProp !== undefined ? currentTimeProp : internalCurrentTime;
  const setCurrentTime = (time: number) => {
    setInternalCurrentTime(time);
    setCurrentTimeProp?.(time);
  };

  const activeClip: VideoClip | undefined =
    activeClipProp ||
    currentCase?.clips?.find((c) => c.id === selectedClipId) ||
    currentCase?.clips?.[0];

  const [selectedTrack, setSelectedTrack] = useState<TrackedSubject | null>(null);
  const [activeTabRight, setActiveTabRight] = useState<'events' | 'tracks' | 'notes'>('events');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [isFlaggingModalOpen, setIsFlaggingModalOpen] = useState<boolean>(false);
  const [flagReasonInput, setFlagReasonInput] = useState<string>('Misclassified shadow/reflection');

  // New Note Form State
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [newNoteTag, setNewNoteTag] = useState<string>('Suspect Lead');
  const [overlayPoints, setOverlayPoints] = useState<OverlayPoint[]>([]);

  useEffect(() => {
    const vid = activeClip?.videoId || Number(activeClip?.id);
    if (!vid || Number.isNaN(vid)) {
      setOverlayPoints([]);
      return;
    }
    forensicApi
      .overlay(vid, { stride: 2, limit: 1200 })
      .then(({ data }) => setOverlayPoints(data.points || []))
      .catch(() => setOverlayPoints([]));
  }, [activeClip?.id, activeClip?.videoId, activeClip?.job?.status]);

  const hydratedClip: VideoClip | undefined = activeClip
    ? {
        ...activeClip,
        videoUrl: activeClip.videoUrl || `/api/videos/${activeClip.videoId || activeClip.id}/stream`,
        tracks: (activeClip.tracks || []).map((t) => ({
          ...t,
          points: overlayPoints
            .filter((p) => p.track_id === t.trackId)
            .map((p) => ({
              timeSeconds: p.t,
              box: { x: p.x, y: p.y, w: p.w, h: p.h },
              confidence: p.conf,
              action: 'passing' as const,
              color: p.color,
            })),
        })),
      }
    : undefined;

  const handleJumpToTime = (timeSec: number) => {
    setCurrentTime(timeSec);
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !activeClip) return;

    const note: InvestigatorNote = {
      id: `note-${Date.now()}`,
      author: userRole === 'admin' ? 'Forensics Administrator' : 'Lead Investigator',
      timestampSec: currentTime,
      text: newNoteText.trim(),
      camera: activeClip.camera,
      tags: [newNoteTag],
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    };

    onAddNote(note);
    setNewNoteText('');
  };

  const handleOpenFlagModal = (track: TrackedSubject) => {
    setSelectedTrack(track);
    setIsFlaggingModalOpen(true);
  };

  const handleConfirmFlag = () => {
    if (selectedTrack) {
      onFlagFalsePositive(selectedTrack.id, flagReasonInput);
      setIsFlaggingModalOpen(false);
    }
  };

  const getTrackIcon = (targetClass: ObjectClass) => {
    switch (targetClass) {
      case 'person':
        return <User className="w-4 h-4 text-blue-400" />;
      case 'car':
      case 'truck':
        return <Car className="w-4 h-4 text-amber-400" />;
      case 'bag':
        return <Package className="w-4 h-4 text-emerald-400" />;
      case 'bike':
        return <Bike className="w-4 h-4 text-purple-400" />;
      default:
        return <User className="w-4 h-4 text-slate-400" />;
    }
  };

  if (!activeClip || !currentCase?.clips?.length) {
    return (
      <div id="investigation-studio-view" className="p-8 max-w-7xl mx-auto text-center space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="text-base font-semibold text-white">No Footage Available</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            This case does not have any surveillance footage loaded yet. Go to the Cases & Footage tab to upload video clips.
          </p>
        </div>
      </div>
    );
  }

  const clipEvents = activeClip.events || [];
  const clipTracks = activeClip.tracks || [];

  const filteredEvents = clipEvents.filter((evt) => {
    if (eventFilter === 'all') return true;
    return evt.action.toLowerCase() === eventFilter.toLowerCase();
  });

  return (
    <div id="investigation-studio-view" className="p-5 max-w-[1600px] mx-auto space-y-4">
      {/* Top Camera Feeds Selector & Clip Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
        {/* Camera Selector Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <span className="text-xs text-slate-400 font-medium px-2 flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Camera Feeds:</span>
          </span>
          {currentCase.clips.map((clip) => (
            <button
              key={clip.id}
              onClick={() => {
                setSelectedClipId(clip.id);
                setCurrentTime(0);
                setSelectedTrack(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center space-x-2 border ${
                selectedClipId === clip.id
                  ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{clip.camera}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-mono text-slate-300">
                {formatTimestamp(clip.durationSeconds)}
              </span>
            </button>
          ))}
        </div>

        {/* Clip Metrics Summary */}
        <div className="flex items-center space-x-3 text-xs text-slate-400 pr-2">
          <span>
            Objects: <strong className="text-slate-200">{clipTracks.length}</strong>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            Events: <strong className="text-slate-200">{clipEvents.length}</strong>
          </span>
          <span className="text-slate-700">|</span>
          <span className="font-mono text-[11px]">
            SHA-256: <strong className="text-slate-300">{activeClip.sha256 ? `${activeClip.sha256.substring(0, 10)}...` : 'N/A'}</strong>
          </span>
        </div>
      </div>

      {/* Main Grid: Player on Left, Side Panel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Cols: Video Player & Event Jump Points */}
        <div className="lg:col-span-8 space-y-3">
          <VideoPlayer
            clip={hydratedClip || activeClip}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            selectedTrackId={selectedTrack?.id}
            onSelectTrack={(t) => {
              setSelectedTrack(t);
              setActiveTabRight('tracks');
            }}
            onFlagFalsePositive={handleOpenFlagModal}
            onAddNoteAtCurrentTime={() => setActiveTabRight('notes')}
            onGenerateClipSnippet={(inSec, outSec) => onGenerateSnippet(activeClip.id, inSec, outSec)}
          />

          {/* Activity Event Jumps */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Key Incident Event Markers</span>
              </span>
              <span className="text-[11px] text-slate-400">Click to seek timestamp</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {clipEvents.slice(0, 4).map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => handleJumpToTime(evt.timeSeconds)}
                  className={`p-2 rounded text-left border transition-colors ${
                    Math.abs(currentTime - evt.timeSeconds) < 2
                      ? 'bg-blue-950/40 border-blue-500 text-blue-200'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-0.5">
                    <span>{evt.timestamp}</span>
                    <span className="capitalize text-[10px] text-slate-300">
                      {evt.action.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs font-medium truncate text-white">{evt.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Investigation Details Tabs */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-[650px] overflow-hidden">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/60">
            <button
              onClick={() => setActiveTabRight('events')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 border-b-2 ${
                activeTabRight === 'events'
                  ? 'border-blue-500 text-blue-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Events ({clipEvents.length})</span>
            </button>
            <button
              onClick={() => setActiveTabRight('tracks')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 border-b-2 ${
                activeTabRight === 'tracks'
                  ? 'border-blue-500 text-blue-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Objects ({clipTracks.length})</span>
            </button>
            <button
              onClick={() => setActiveTabRight('notes')}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 border-b-2 ${
                activeTabRight === 'notes'
                  ? 'border-blue-500 text-blue-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Notes ({currentCase.notes.length})</span>
            </button>
          </div>

          {/* Tab 1: Activity Events Feed */}
          {activeTabRight === 'events' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Event Filter Pills */}
              <div className="p-2 border-b border-slate-800 flex items-center space-x-1 overflow-x-auto text-xs bg-slate-900">
                {['all', 'entry', 'loitering', 'running', 'left_object', 'exit'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setEventFilter(f)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors capitalize ${
                      eventFilter === f
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Events List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => handleJumpToTime(evt.timeSeconds)}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      Math.abs(currentTime - evt.timeSeconds) < 2
                        ? 'bg-slate-800 border-blue-500 shadow-sm'
                        : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1.5">
                        {getTrackIcon(evt.targetClass)}
                        <span className="text-xs font-semibold text-slate-200">{evt.trackId}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            evt.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300'
                              : evt.severity === 'high'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {evt.action.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">{evt.timestamp}</span>
                    </div>
                    <div className="text-xs font-medium text-white mb-0.5">{evt.title}</div>
                    <p className="text-xs text-slate-400 leading-relaxed">{evt.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Tracked Subjects List */}
          {activeTabRight === 'tracks' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {clipTracks.map((track) => {
                const isSelected = selectedTrack?.id === track.id;
                const isPresentNow = currentTime >= track.firstSeenSec && currentTime <= track.lastSeenSec;

                return (
                  <div
                    key={track.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-slate-800 border-blue-500'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        {getTrackIcon(track.targetClass)}
                        <span className="text-xs font-semibold text-white">{track.id}</span>
                        {isPresentNow && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                            Active in frame
                          </span>
                        )}
                        {track.isFalsePositive && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            False Positive
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {Math.round(track.confidence * 100)}% Confidence
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-0.5 mb-2">
                      <div>
                        Duration: {formatTimestamp(track.firstSeenSec)} - {formatTimestamp(track.lastSeenSec)} (
                        {Math.round(track.lastSeenSec - track.firstSeenSec)}s)
                      </div>
                      <div>
                        Appearance: <span className="capitalize text-slate-300">{track.color}</span>
                      </div>
                      {track.notes && <div className="text-slate-300 italic">"{track.notes}"</div>}
                    </div>

                    <div className="flex items-center space-x-2 pt-1 border-t border-slate-800">
                      <button
                        onClick={() => handleJumpToTime(track.firstSeenSec)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded font-medium flex-1 transition-colors"
                      >
                        Seek First Seen
                      </button>
                      <button
                        onClick={() => handleOpenFlagModal(track)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 text-xs rounded flex items-center space-x-1 transition-colors"
                        title="Flag detection error"
                      >
                        <Flag className="w-3 h-3" />
                        <span>Flag</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 3: Investigator Notes */}
          {activeTabRight === 'notes' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <form onSubmit={handleCreateNote} className="p-3 border-b border-slate-800 bg-slate-950/40 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Timestamp: <strong className="text-slate-200 font-mono">{formatTimestamp(currentTime)}</strong>
                  </span>
                  <select
                    value={newNoteTag}
                    onChange={(e) => setNewNoteTag(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-0.5"
                  >
                    <option value="Suspect Lead">Suspect Lead</option>
                    <option value="Entry Method">Entry Method</option>
                    <option value="Left Object">Left Object</option>
                    <option value="Vehicle License">Vehicle License</option>
                    <option value="Evidence Marker">Evidence Marker</option>
                  </select>
                </div>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Enter observation note..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {currentCase.notes.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    No notes recorded yet. Add notes anchored to video timestamps above.
                  </div>
                ) : (
                  currentCase.notes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => handleJumpToTime(note.timestampSec)}
                      className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{note.author}</span>
                        <span className="font-mono text-blue-400 font-medium">
                          {formatTimestamp(note.timestampSec)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{note.text}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>{note.camera}</span>
                        <div className="flex items-center space-x-1">
                          {note.tags.map((t) => (
                            <span key={t} className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flag False Positive Modal */}
      {isFlaggingModalOpen && selectedTrack && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Flag className="w-4 h-4 text-amber-400" />
                <span>Flag Detection as False Positive</span>
              </h3>
              <button
                onClick={() => setIsFlaggingModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                You are marking entity <strong>{selectedTrack.id}</strong> ({selectedTrack.targetClass}) as a false positive. This will update model analytics and log to the audit trail.
              </p>

              <div>
                <label className="block text-slate-400 mb-1">Reason for Flagging:</label>
                <select
                  value={flagReasonInput}
                  onChange={(e) => setFlagReasonInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-2 text-xs"
                >
                  <option value="Misclassified shadow/reflection">Misclassified shadow/reflection</option>
                  <option value="Incorrect object classification">Incorrect object classification</option>
                  <option value="Motion artifact / lighting change">Motion artifact / lighting change</option>
                  <option value="Duplicate track assignment">Duplicate track assignment</option>
                  <option value="Benign background movement">Benign background movement</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsFlaggingModalOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFlag}
                className="px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
              >
                Confirm Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
