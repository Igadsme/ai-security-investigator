import { ReactNode } from "react";
import { Header } from "@/components/verisight/Header";
import { EvidenceExportModal } from "@/components/verisight/EvidenceExportModal";
import { AiIncidentSummaryModal } from "@/components/verisight/AiIncidentSummaryModal";
import { RtspSnapshotModal } from "@/components/verisight/RtspSnapshotModal";
import { useCase } from "@/lib/CaseContext";

export default function Layout({ children, hideChrome }: { children: ReactNode; hideChrome?: boolean }) {
  const ctx = useCase();

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      <Header
        currentTab={ctx.currentTab}
        onSelectTab={ctx.setCurrentTab}
        currentCase={ctx.currentCase}
        allCases={ctx.allCases.length ? ctx.allCases : [ctx.currentCase]}
        onSelectCase={(id) => {
          ctx.setCurrentCaseId(id);
          const target = ctx.allCases.find((c) => c.id === id);
          if (target?.clips?.[0]) {
            ctx.setSelectedClipId(target.clips[0].id);
            ctx.setCurrentTime(0);
          }
        }}
        userRole={ctx.me?.role || "investigator"}
        investigatorName={ctx.me?.username}
        onLogout={ctx.logout}
        onOpenAiReport={() => ctx.setIsAiReportOpen(true)}
        onOpenExportModal={() => ctx.setIsExportModalOpen(true)}
        onOpenRtspModal={() => ctx.setIsRtspModalOpen(true)}
      />
      <main className="flex-1 pb-12">{children}</main>
      <EvidenceExportModal
        isOpen={ctx.isExportModalOpen}
        onClose={() => ctx.setIsExportModalOpen(false)}
        currentCase={ctx.currentCase}
        investigatorName={ctx.me?.username || "Investigator"}
      />
      <AiIncidentSummaryModal
        isOpen={ctx.isAiReportOpen}
        onClose={() => ctx.setIsAiReportOpen(false)}
        currentCase={ctx.currentCase}
      />
      <RtspSnapshotModal
        isOpen={ctx.isRtspModalOpen}
        onClose={() => ctx.setIsRtspModalOpen(false)}
        cameras={ctx.currentCase.cameras}
      />
    </div>
  );
}
