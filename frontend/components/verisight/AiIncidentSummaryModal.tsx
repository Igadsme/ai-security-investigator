import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  Download,
  Clock,
  User,
  AlertTriangle,
  FileCheck2,
  FileText,
} from 'lucide-react';
import { CaseData } from '@/types/verisight';
import { generateCaseIncidentSummary, AiSummaryResponse } from '@/services/api';
import { downloadJsonFile } from '@/lib/format';

interface AiIncidentSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: CaseData;
}

export const AiIncidentSummaryModal: React.FC<AiIncidentSummaryModalProps> = ({
  isOpen,
  onClose,
  currentCase,
}) => {
  const [report, setReport] = useState<AiSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && !report) {
      fetchReport();
    }
  }, [isOpen]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const data = await generateCaseIncidentSummary(currentCase);
      setReport(data);
    } catch (e) {
      console.error('Failed to generate summary', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopyText = () => {
    if (!report) return;
    const text = `
INCIDENT REPORT: ${currentCase.caseNumber} - ${currentCase.title}

EXECUTIVE SUMMARY:
${report.executiveSummary}

CHRONOLOGICAL TIMELINE:
${(report.chronologicalBreakdown || []).map((e) => `[${e.time}] (${e.camera}) ${e.subject}: ${e.action} [Significance: ${e.significance}]`).join('\n')}

SUBJECT INVENTORY:
${(report.subjectInventory || []).map((s) => `${s.id} (${s.classification}): ${s.dominantTraits} [First: ${s.firstSeen}, Last: ${s.lastSeen}]`).join('\n')}

SECURITY ANOMALIES & PROTOCOL VIOLATIONS:
${(report.anomaliesAndViolations || []).map((a) => `- ${a}`).join('\n')}

RECOMMENDED NEXT ACTIONS:
${(report.investigatorRecommendations || []).map((r) => `- ${r}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!report) return;
    const exportPayload = {
      caseNumber: currentCase.caseNumber,
      caseTitle: currentCase.title,
      generatedAt: new Date().toISOString(),
      report,
    };
    downloadJsonFile(exportPayload, `Incident_Report_${currentCase.caseNumber}.json`);
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 rounded-t-lg">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded bg-blue-600/20 text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Incident Summary Report
              </h3>
              <p className="text-xs text-slate-400">
                Case {currentCase.caseNumber} - {currentCase.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block p-3 rounded-full bg-blue-600/20 text-blue-400 animate-pulse">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-white">
                Generating Comprehensive Incident Summary...
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Analyzing timestamps, multi-camera correlation, and detected activity patterns.
              </p>
            </div>
          ) : report ? (
            <div className="space-y-4">
              {/* Executive Summary */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-slate-200">
                  Executive Briefing
                </h4>
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-slate-300 leading-relaxed text-xs">
                  {report.executiveSummary}
                </div>
              </div>

              {/* Chronological Timeline */}
              {report.chronologicalBreakdown && report.chronologicalBreakdown.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Chronological Incident Sequence</span>
                  </h4>
                  <div className="space-y-1.5">
                    {report.chronologicalBreakdown.map((evt, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-950 border border-slate-800 rounded-md flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-blue-400 font-medium">{evt.time}</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-white font-medium">{evt.subject}</span>
                          <span className="text-slate-400">({evt.camera})</span>
                          <span className="text-slate-300">- {evt.action}</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {evt.significance}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject Inventory */}
              {report.subjectInventory && report.subjectInventory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>Tracked Subjects & Entity Attributes</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {report.subjectInventory.map((sub, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-md space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white">{sub.id}</span>
                          <span className="text-[10px] capitalize px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {sub.classification}
                          </span>
                        </div>
                        <div className="text-slate-400">{sub.dominantTraits}</div>
                        <div className="text-[11px] text-slate-500">
                          Active: {sub.firstSeen} to {sub.lastSeen}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anomalies & Violations */}
              {report.anomaliesAndViolations && report.anomaliesAndViolations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-rose-400 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Protocol Anomalies & Violations</span>
                  </h4>
                  <div className="bg-rose-950/20 border border-rose-500/30 p-3 rounded-lg space-y-1.5">
                    {report.anomaliesAndViolations.map((viol, idx) => (
                      <div key={idx} className="text-rose-200 text-xs flex items-start space-x-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{viol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Next Actions */}
              {report.investigatorRecommendations && report.investigatorRecommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-emerald-400 flex items-center space-x-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Recommended Next Actions</span>
                  </h4>
                  <ul className="space-y-1.5 text-slate-300 text-xs bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                    {report.investigatorRecommendations.map((rec, idx) => (
                      <li key={idx} className="leading-relaxed flex items-start space-x-2">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/80 rounded-b-lg">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <div className="flex space-x-2">
            <button
              onClick={handleCopyText}
              disabled={!report}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs border border-slate-700 flex items-center space-x-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button
              onClick={handleDownloadReport}
              disabled={!report}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
