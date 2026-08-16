import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Shield,
  Search,
  Video,
  Clock,
  MapPin,
  Bell,
  FileCheck,
  FolderOpen,
  Download,
  FileText,
  Radio,
  User,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { CaseData, UserRole } from '@/types/verisight';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentCase: CaseData;
  allCases: CaseData[];
  onSelectCase: (caseId: string) => void;
  userRole: UserRole;
  onChangeUserRole?: (role: UserRole) => void;
  onLogout?: () => void;
  investigatorName?: string;
  onOpenAiReport: () => void;
  onOpenExportModal: () => void;
  onOpenRtspModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  currentCase,
  allCases,
  onSelectCase,
  userRole,
  onLogout,
  investigatorName,
  onOpenAiReport,
  onOpenExportModal,
  onOpenRtspModal,
}) => {
  const router = useRouter();
  const [systemTime, setSystemTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(
        now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
          ' ' +
          now.toLocaleTimeString('en-US', { hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'investigation', label: 'Video Review', icon: Video },
    { id: 'search', label: 'Search & Filters', icon: Search },
    { id: 'timeline', label: 'Multi-Camera Sync', icon: Clock },
    { id: 'cases', label: 'Cases & Footage', icon: FolderOpen },
    { id: 'map', label: 'Facility Floor Plan', icon: MapPin },
    { id: 'alerts', label: 'Event Rules', icon: Bell },
    { id: 'audit', label: 'Audit Log', icon: FileCheck },
  ];

  return (
    <header id="app-header" className="bg-[#0f172a] border-b border-slate-800 text-slate-200 sticky top-0 z-40">
      {/* Top Primary Bar */}
      <div className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        {/* Left: Product Brand & Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm tracking-tight text-white">
                  VeriSight
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  Video Analytics
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Security Investigation Platform
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-800 hidden md:block" />

          {/* Active Case Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Case:</span>
            <div className="relative">
              <select
                id="case-switcher-dropdown"
                value={currentCase.id}
                onChange={(e) => onSelectCase(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium px-2.5 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer pr-7"
              >
                {allCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} - {c.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>

            <span
              className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                currentCase.priority === 'critical'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {currentCase.priority.charAt(0).toUpperCase() + currentCase.priority.slice(1)} Priority
            </span>
          </div>
        </div>

        {/* Right: Actions & User Clearance */}
        <div className="flex items-center space-x-2.5">
          <div className="hidden xl:flex items-center text-xs text-slate-400 mr-2 space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[11px]">{systemTime}</span>
          </div>

          {/* RTSP Stream Tool */}
          <button
            id="header-rtsp-btn"
            onClick={onOpenRtspModal}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center space-x-1.5 text-xs font-medium"
            title="Inspect Live RTSP Stream & Feeds"
          >
            <Radio className="w-3.5 h-3.5 text-slate-300" />
            <span>Live Feeds</span>
          </button>

          {/* AI Incident Report */}
          <button
            id="header-ai-summary-btn"
            onClick={onOpenAiReport}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-sm"
            title="Generate AI Incident Summary Report"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary Report</span>
          </button>

          {/* Evidence Export */}
          <button
            id="header-export-btn"
            onClick={onOpenExportModal}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition-colors"
            title="Export Evidence Package"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Export Evidence</span>
          </button>

          <div className="h-5 w-px bg-slate-800" />

          {/* User Role Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-200">{investigatorName || "Investigator"}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 capitalize">{userRole}</span>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs"
            >
              Sign out
            </button>
          )}
          <button
            onClick={() => router.push("/settings")}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Secondary Navigation Tab Bar */}
      <div className="px-5 flex items-center justify-between overflow-x-auto">
        <nav className="flex space-x-1 py-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = currentTab === t.id;
            return (
              <button
                key={t.id}
                id={`nav-tab-${t.id}`}
                onClick={() => onSelectTab(t.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-medium transition-all rounded-md ${
                  isActive
                    ? 'bg-slate-800 text-blue-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center space-x-3 text-xs text-slate-400 pr-2">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-300">{currentCase.clips.length} Feeds Online</span>
          </span>
          <span>•</span>
          <span>{currentCase.standingAlerts.length} Event Rules Active</span>
        </div>
      </div>
    </header>
  );
};
