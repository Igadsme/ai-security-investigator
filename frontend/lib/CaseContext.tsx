import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { authApi, forensicApi, videoApi } from "@/services/api";
import {
  CaseData,
  CaseNote,
  StandingAlert,
  UserRole,
  VideoClip,
} from "@/types/verisight";

const TAB_PATH: Record<string, string> = {
  investigation: "/",
  search: "/search",
  timeline: "/timeline",
  cases: "/cases",
  map: "/map",
  alerts: "/alerts",
  audit: "/audit",
};

const PATH_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_PATH).map(([tab, path]) => [path, tab])
);

type Me = { id: number; username: string; role: UserRole };

interface CaseContextValue {
  me: Me | null;
  allCases: CaseData[];
  currentCase: CaseData;
  currentCaseId: string;
  setCurrentCaseId: (id: string) => void;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  selectedClipId: string;
  setSelectedClipId: (id: string) => void;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  loading: boolean;
  refresh: () => Promise<CaseData[]>;
  isAiReportOpen: boolean;
  setIsAiReportOpen: (v: boolean) => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (v: boolean) => void;
  isRtspModalOpen: boolean;
  setIsRtspModalOpen: (v: boolean) => void;
  handleAddNote: (note: CaseNote) => Promise<void>;
  handleFlagFalsePositive: (trackId: string, reason: string) => Promise<void>;
  handleSaveAlert: (alert: StandingAlert) => Promise<void>;
  handleToggleAlert: (alertId?: string) => Promise<void>;
  handleDeleteAlert: (alertId: string) => void;
  handleCreateCase: (partial: { title: string; description?: string; priority?: string; caseNumber?: string }) => Promise<void>;
  handleAddClipToCase: (caseId: string, file: File, cameraCode?: string) => Promise<void>;
  handleVerifyIntegrity: () => Promise<boolean>;
  handleJumpToClipTime: (clipId: string, timeSec: number) => void;
  handleGenerateSnippet: (clipId: string, inSec: number, outSec: number) => Promise<void>;
  logout: () => void;
}

const CaseContext = createContext<CaseContextValue | null>(null);

function emptyCase(): CaseData {
  return {
    id: "0",
    dbId: 0,
    caseNumber: "—",
    title: "No case yet",
    description: "Create a case and upload footage to begin an investigation.",
    status: "open",
    priority: "medium",
    assignedInvestigator: "",
    createdAt: new Date().toISOString(),
    incidentTime: new Date().toISOString(),
    cameras: [],
    clips: [],
    notes: [],
    auditLogs: [],
    standingAlerts: [],
  };
}

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [allCases, setAllCases] = useState<CaseData[]>([]);
  const [currentCaseId, setCurrentCaseIdState] = useState<string>("");
  const [selectedClipId, setSelectedClipId] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAiReportOpen, setIsAiReportOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRtspModalOpen, setIsRtspModalOpen] = useState(false);

  const currentTab = PATH_TAB[router.pathname] || "investigation";

  const setCurrentTab = (tab: string) => {
    const path = TAB_PATH[tab] || "/";
    const q = currentCaseId ? `?case=${currentCaseId}` : "";
    router.push(path + q);
  };

  const setCurrentCaseId = (id: string) => {
    setCurrentCaseIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("verisight_case", id);
    const path = TAB_PATH[currentTab] || "/";
    router.replace(`${path}?case=${id}`, undefined, { shallow: true });
  };

  const currentCase = useMemo(
    () => allCases.find((c) => c.id === currentCaseId) || allCases[0] || emptyCase(),
    [allCases, currentCaseId]
  );

  const refresh = useCallback(async () => {
    const { data: list } = await forensicApi.listCases();
    const workspaces: CaseData[] = [];
    for (const c of list) {
      try {
        const { data } = await forensicApi.getWorkspace(c.id);
        workspaces.push({ ...data, dbId: data.dbId || c.id, id: String(data.dbId || c.id) });
      } catch {
        workspaces.push({
          ...emptyCase(),
          id: String(c.id),
          dbId: c.id,
          caseNumber: (c as { case_number?: string }).case_number || `VS-${c.id}`,
          title: c.title,
          description: c.description || "",
          status: (c.status as CaseData["status"]) || "open",
        });
      }
    }
    setAllCases(workspaces);
    return workspaces;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        if (router.pathname !== "/login") router.replace("/login");
        setLoading(false);
        return;
      }
      try {
        const { data } = await authApi.me();
        if (cancelled) return;
        setMe({ id: data.id, username: data.username, role: (String(data.role).toLowerCase() as UserRole) || "investigator" });
        const workspaces = await refresh();
        if (cancelled) return;
        const fromQuery = typeof router.query.case === "string" ? router.query.case : "";
        const stored = localStorage.getItem("verisight_case") || "";
        const pick = fromQuery || stored || workspaces[0]?.id || "";
        if (pick) {
          setCurrentCaseIdState(pick);
          const target = workspaces.find((c) => c.id === pick) || workspaces[0];
          if (target?.clips?.[0]) setSelectedClipId(target.clips[0].id);
        }
      } catch {
        localStorage.removeItem("token");
        if (router.pathname !== "/login") router.replace("/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (router.isReady) boot();
    return () => {
      cancelled = true;
    };
  }, [router.isReady]);

  useEffect(() => {
    const processing = currentCase.clips.some((c) => c.job && c.job.status !== "completed" && c.job.status !== "failed");
    if (!processing) return;
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [currentCase.clips, refresh]);

  const handleAddNote = async (note: CaseNote) => {
    const clip = currentCase.clips.find((c) => c.id === selectedClipId) || currentCase.clips[0];
    const videoId = clip?.videoId || Number(clip?.id);
    if (!videoId) return;
    await forensicApi.createAnnotation({
      video_id: videoId,
      body: note.text,
      timestamp_seconds: note.timestampSec,
      flag: note.tags?.[0],
    });
    await refresh();
  };

  const handleFlagFalsePositive = async (trackId: string, reason: string) => {
    const clip = currentCase.clips.find((c) => c.id === selectedClipId) || currentCase.clips[0];
    const videoId = clip?.videoId || Number(clip?.id);
    const track = clip?.tracks.find((t) => t.id === trackId);
    const numeric = track?.trackId ?? Number(String(trackId).replace(/\D/g, ""));
    if (!videoId || Number.isNaN(numeric)) return;
    await forensicApi.flagTrackFalsePositive(videoId, numeric, reason);
    await refresh();
  };

  const handleSaveAlert = async (alert: StandingAlert) => {
    await forensicApi.createSavedSearch({
      name: alert.name,
      query: `${alert.targetClass} ${alert.action}`,
      filters: {
        object_class: alert.targetClass === "any" ? undefined : alert.targetClass,
        camera_code: alert.camera === "all" ? undefined : alert.camera,
        activity_type: alert.action === "any" ? undefined : alert.action,
        min_confidence: alert.minConfidence,
      },
      is_alert: true,
    });
    await refresh();
  };

  const handleToggleAlert = async () => {
    await forensicApi.evaluateAlerts();
    await refresh();
  };

  const handleDeleteAlert = (_alertId: string) => {
    /* standing alerts are paused via evaluate; deletion not exposed on API */
  };

  const handleCreateCase = async (partial: { title: string; description?: string; priority?: string; caseNumber?: string }) => {
    const { data } = await forensicApi.createCase({
      title: partial.title,
      description: partial.description,
      case_number: partial.caseNumber,
      priority: partial.priority,
    });
    const workspaces = await refresh();
    const created = workspaces.find((c) => c.dbId === data.id) || workspaces[0];
    if (created) {
      setCurrentCaseId(created.id);
      setCurrentTab("investigation");
    }
  };

  const handleAddClipToCase = async (caseId: string, file: File, cameraCode?: string) => {
    await videoApi.upload(file, { case_id: Number(caseId), camera_code: cameraCode });
    await refresh();
    setCurrentTab("investigation");
  };

  const handleVerifyIntegrity = async () => {
    const id = currentCase.dbId || Number(currentCase.id);
    const { data } = await forensicApi.verifyIntegrity(id);
    await refresh();
    return Boolean(data.ok);
  };

  const handleJumpToClipTime = (clipId: string, timeSec: number) => {
    if (clipId) setSelectedClipId(clipId);
    setCurrentTime(timeSec);
    setCurrentTab("investigation");
  };

  const handleGenerateSnippet = async (clipId: string, inSec: number, outSec: number) => {
    const videoId = Number(clipId);
    const caseId = currentCase.dbId || Number(currentCase.id);
    await forensicApi.exportEvidence({
      video_id: videoId,
      start_seconds: inSec,
      end_seconds: outSec,
      case_id: caseId,
    });
    setIsExportModalOpen(true);
    await refresh();
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("verisight_case");
    router.push("/login");
  };

  const value: CaseContextValue = {
    me,
    allCases,
    currentCase,
    currentCaseId: currentCase.id,
    setCurrentCaseId,
    currentTab,
    setCurrentTab,
    selectedClipId,
    setSelectedClipId,
    currentTime,
    setCurrentTime,
    loading,
    refresh,
    isAiReportOpen,
    setIsAiReportOpen,
    isExportModalOpen,
    setIsExportModalOpen,
    isRtspModalOpen,
    setIsRtspModalOpen,
    handleAddNote,
    handleFlagFalsePositive,
    handleSaveAlert,
    handleToggleAlert,
    handleDeleteAlert,
    handleCreateCase,
    handleAddClipToCase,
    handleVerifyIntegrity,
    handleJumpToClipTime,
    handleGenerateSnippet,
    logout,
  };

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase() {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCase must be used within CaseProvider");
  return ctx;
}
