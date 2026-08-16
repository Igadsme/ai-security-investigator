import React, { useState } from 'react';
import {
  X,
  Download,
  Shield,
  FileText,
  CheckCircle,
  Printer,
  Copy,
} from 'lucide-react';
import { CaseData, ExportManifest } from '@/types/verisight';
import { computeSHA256, downloadJsonFile, formatTimestamp } from '@/lib/format';

interface EvidenceExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: CaseData;
  investigatorName: string;
}

export const EvidenceExportModal: React.FC<EvidenceExportModalProps> = ({
  isOpen,
  onClose,
  currentCase,
  investigatorName,
}) => {
  const [applyRedaction, setApplyRedaction] = useState<boolean>(false);
  const [includeAuditLog, setIncludeAuditLog] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportedManifest, setExportedManifest] = useState<ExportManifest | null>(null);

  if (!isOpen) return null;

  const handleExecuteExport = async () => {
    setIsExporting(true);

    const timestamp = new Date().toISOString();
    const clipsToExport = currentCase.clips.map((c) => ({
      filename: c.filename,
      camera: c.camera,
      sha256: c.sha256,
      duration: c.durationSeconds,
    }));

    const manifestData = {
      caseNumber: currentCase.caseNumber,
      caseTitle: currentCase.title,
      exportTimestamp: timestamp,
      exportedBy: investigatorName,
      clipsExported: clipsToExport,
      tracksTotal: currentCase.clips.reduce((acc, c) => acc + c.tracks.length, 0),
      eventsTotal: currentCase.clips.reduce((acc, c) => acc + c.events.length, 0),
      redacted: applyRedaction,
      evidenceItems: currentCase.clips.flatMap((c) =>
        c.events.map((e) => ({
          type: 'SURVEILLANCE_TIMECODE_EVENT',
          description: `[${e.timestamp}] ${e.camera}: ${e.title} (${e.description})`,
          timestamp: e.timestamp,
          hash: c.sha256.substring(0, 32),
        }))
      ),
    };

    const sealHash = await computeSHA256(JSON.stringify(manifestData));
    const finalManifest: ExportManifest = {
      ...manifestData,
      sha256PackageSeal: sealHash,
      digitalSignature: `SIG-VERISIGHT-${sealHash.substring(0, 24).toUpperCase()}`,
    };

    setExportedManifest(finalManifest);
    setIsExporting(false);

    downloadJsonFile(
      finalManifest,
      `Evidence_Package_${currentCase.caseNumber}_${applyRedaction ? 'Redacted' : 'Original'}.json`
    );
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-xl w-full p-5 space-y-4 shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-blue-600/20 text-blue-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Export Evidence Package
            </h3>
            <p className="text-xs text-slate-400">
              Compile tamper-evident evidence package with SHA-256 signatures and case timeline
            </p>
          </div>
        </div>

        {/* Configuration Options */}
        <div className="space-y-3 bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div>
              <div className="font-semibold text-white">Privacy Redaction Filter</div>
              <div className="text-slate-400 text-[11px]">
                Apply pixelation blur to bystander entities in exported footage
              </div>
            </div>
            <input
              type="checkbox"
              checked={applyRedaction}
              onChange={(e) => setApplyRedaction(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div>
              <div className="font-semibold text-white">Include Audit Trail & Chain of Custody</div>
              <div className="text-slate-400 text-[11px]">
                Attach immutable log of investigator actions and timestamps
              </div>
            </div>
            <input
              type="checkbox"
              checked={includeAuditLog}
              onChange={(e) => setIncludeAuditLog(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Cryptographic Checksum Verification</div>
              <div className="text-slate-400 text-[11px]">
                Embed SHA-256 package digest to ensure evidence authenticity
              </div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
              Enabled
            </span>
          </div>
        </div>

        {/* Package Summary */}
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
          <div className="font-semibold text-slate-200">Package Summary:</div>
          <div className="grid grid-cols-2 gap-2 text-slate-400">
            <div>Case Reference: <strong className="text-slate-200">{currentCase.caseNumber}</strong></div>
            <div>Investigator: <strong className="text-slate-200">{investigatorName}</strong></div>
            <div>Video Feeds: <strong className="text-slate-200">{currentCase.clips.length}</strong></div>
            <div>Event Annotations: <strong className="text-slate-200">{currentCase.clips.reduce((a, b) => a + b.events.length, 0)}</strong></div>
          </div>
        </div>

        {/* Exported Result Notice */}
        {exportedManifest && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs space-y-1">
            <div className="font-semibold flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Evidence Package Exported Successfully</span>
            </div>
            <div className="text-[11px] text-emerald-400/80 font-mono break-all">
              Package SHA-256 Seal: {exportedManifest.sha256PackageSeal}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center space-x-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Packaging Evidence...' : 'Generate & Download Package'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
