import React, { useState } from 'react';
import {
  Upload,
  FolderPlus,
  Video,
  FileVideo,
  Clock,
  Plus,
  HardDrive,
  Cpu,
  CheckCircle2,
  X,
  ChevronRight,
} from 'lucide-react';
import { CaseData, VideoClip, CameraMeta } from '@/types/verisight';
import { computeSHA256, formatTimestamp } from '@/lib/format';

interface CasesAndUploadProps {
  allCases: CaseData[];
  currentCase: CaseData;
  onSelectCase: (caseId: string) => void;
  onCreateCase: (newCase: CaseData) => void;
  onAddClipToCase: (caseId: string, clip: VideoClip & { _file?: File }) => void | Promise<void>;
}

export const CasesAndUpload: React.FC<CasesAndUploadProps> = ({
  allCases,
  currentCase,
  onSelectCase,
  onCreateCase,
  onAddClipToCase,
}) => {
  // Ingestion State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clipTitle, setClipTitle] = useState<string>('');
  const [selectedCamera, setSelectedCamera] = useState<string>(currentCase.cameras[0]?.name || 'Camera 01');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStage, setProcessingStage] = useState<string>('');

  // Create Case Form State
  const [isCreateCaseModalOpen, setIsCreateCaseModalOpen] = useState<boolean>(false);
  const [newCaseTitle, setNewCaseTitle] = useState<string>('');
  const [newCaseNumber, setNewCaseNumber] = useState<string>(`CASE-2026-${Math.floor(Math.random() * 900 + 100)}`);
  const [newCaseDescription, setNewCaseDescription] = useState<string>('');
  const [newCasePriority, setNewCasePriority] = useState<'low' | 'medium' | 'high' | 'critical'>('high');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setClipTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleStartIngest = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProcessingProgress(20);
    setProcessingStage('Uploading footage and queuing YOLOv8 processing…');

    const arrayBuffer = await selectedFile.slice(0, 1024 * 1024).arrayBuffer();
    const sha = await computeSHA256(arrayBuffer);

    const cam = currentCase.cameras.find((c) => c.name === selectedCamera);
    const newClip: VideoClip & { _file?: File } = {
      id: `clip-pending-${Date.now()}`,
      title: clipTitle || selectedFile.name,
      filename: selectedFile.name,
      fileSizeMb: parseFloat((selectedFile.size / (1024 * 1024)).toFixed(1)),
      durationSeconds: 0,
      camera: cam?.cameraCode || selectedCamera,
      recordedAt: new Date().toISOString(),
      sha256: sha,
      tracks: [],
      events: [],
      _file: selectedFile,
    };

    setProcessingProgress(60);
    await onAddClipToCase(currentCase.id, newClip);
    setProcessingProgress(100);
    setProcessingStage('Queued. Detection runs on the server — watch Video Review for progress.');
    setIsProcessing(false);
    setSelectedFile(null);
  };

  const handleCreateCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseTitle.trim()) return;

    const newCase: CaseData = {
      id: `case-${Date.now()}`,
      caseNumber: newCaseNumber,
      title: newCaseTitle.trim(),
      description: newCaseDescription || 'Investigation case initialized.',
      status: 'open',
      priority: newCasePriority,
      assignedInvestigator: 'Active Investigator',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      incidentTime: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      cameras: currentCase.cameras,
      clips: [],
      notes: [],
      auditLogs: [
        {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
          investigator: 'Active Investigator',
          actionType: 'upload',
          details: `Case ${newCaseNumber} created.`,
        },
      ],
      standingAlerts: [],
    };

    onCreateCase(newCase);
    setIsCreateCaseModalOpen(false);
    setNewCaseTitle('');
    setNewCaseDescription('');
  };

  return (
    <div id="cases-and-ingestion-view" className="p-5 max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            Footage Ingest & Case Directory
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingest surveillance video files (MP4, AVI, MOV, MKV) for automated object detection, track generation, and case evidence management.
          </p>
        </div>

        <button
          onClick={() => setIsCreateCaseModalOpen(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Case</span>
        </button>
      </div>

      {/* Grid: Upload & Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 Cols: Video Upload & Ingestion */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center space-x-2 text-slate-200 font-semibold text-xs border-b border-slate-800 pb-3">
              <Upload className="w-4 h-4 text-blue-400" />
              <span>Upload Video Footage</span>
            </div>

            {/* Drag & Drop File Zone */}
            <label className="border border-dashed border-slate-700 hover:border-blue-500 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-colors text-center space-y-2 group">
              <FileVideo className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-colors" />
              <div className="text-xs text-slate-200">
                {selectedFile ? (
                  <span className="text-blue-400 font-semibold">
                    {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                ) : (
                  <span>Drag and drop surveillance video or click to browse</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Supported formats: MP4, AVI, MOV, MKV
              </p>
              <input
                type="file"
                accept="video/mp4,video/avi,video/quicktime,video/x-matroska,.mp4,.avi,.mov,.mkv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Clip Label:</label>
                <input
                  type="text"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  placeholder="e.g. Loading Dock Camera"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Camera Feed:</label>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200"
                >
                  {currentCase.cameras.map((cam) => (
                    <option key={cam.id} value={cam.name}>
                      {cam.name}
                    </option>
                  ))}
                  <option value="Custom Camera Feed">Custom Camera Feed</option>
                </select>
              </div>
            </div>

            {/* Processing Progress Bar */}
            {isProcessing && (
              <div className="bg-slate-950 border border-blue-500/30 rounded-lg p-3.5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-blue-400 font-medium flex items-center space-x-1.5">
                    <Cpu className="w-3.5 h-3.5 animate-spin" />
                    <span>{processingStage}</span>
                  </span>
                  <span className="text-white font-mono">{processingProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleStartIngest}
              disabled={!selectedFile || isProcessing}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center justify-center space-x-2 transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessing ? 'Processing Video...' : 'Ingest and Process Footage'}</span>
            </button>
          </div>
        </div>

        {/* Right 6 Cols: Case Directory */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-slate-200 font-semibold text-xs">
                Active Cases ({allCases.length})
              </span>
            </div>

            <div className="space-y-3">
              {allCases.map((c) => {
                const isCurrent = c.id === currentCase.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className={`p-4 rounded-lg border transition-colors cursor-pointer space-y-2 ${
                      isCurrent
                        ? 'bg-slate-950 border-blue-500 shadow-sm'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-semibold text-blue-400">
                          {c.caseNumber}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            c.priority === 'critical'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {c.priority.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 capitalize">{c.status}</span>
                    </div>

                    <h4 className="text-xs font-semibold text-white">{c.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{c.description}</p>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-800/80">
                      <span>{c.clips.length} Video Feeds</span>
                      <span>Investigator: {c.assignedInvestigator}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Create Case Modal */}
      {isCreateCaseModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <FolderPlus className="w-4 h-4 text-blue-400" />
                <span>Initialize New Case</span>
              </h3>
              <button
                onClick={() => setIsCreateCaseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Case Number / Reference:</label>
                <input
                  type="text"
                  value={newCaseNumber}
                  onChange={(e) => setNewCaseNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded px-2.5 py-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Case Title:</label>
                <input
                  type="text"
                  placeholder="e.g. Loading Dock Unauthorized Ingress"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded px-2.5 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Priority Level:</label>
                <select
                  value={newCasePriority}
                  onChange={(e) => setNewCasePriority(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-2.5 py-2"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Description & Notes:</label>
                <textarea
                  rows={3}
                  placeholder="Enter initial investigation briefing..."
                  value={newCaseDescription}
                  onChange={(e) => setNewCaseDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded px-2.5 py-2 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateCaseModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                >
                  Create Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
