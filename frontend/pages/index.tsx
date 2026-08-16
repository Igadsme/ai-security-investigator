import Layout from "@/components/Layout";
import { InvestigationStudio } from "@/components/verisight/InvestigationStudio";
import { useCase } from "@/lib/CaseContext";

export default function InvestigatePage() {
  const ctx = useCase();
  const clip = ctx.currentCase.clips.find((c) => c.id === ctx.selectedClipId) || ctx.currentCase.clips[0];
  return (
    <Layout>
      <InvestigationStudio
        currentCase={ctx.currentCase}
        activeClip={clip}
        currentTime={ctx.currentTime}
        setCurrentTime={ctx.setCurrentTime}
        selectedClipId={clip?.id || ""}
        setSelectedClipId={ctx.setSelectedClipId}
        userRole={ctx.me?.role || "investigator"}
        onAddNote={ctx.handleAddNote}
        onFlagFalsePositive={ctx.handleFlagFalsePositive}
        onGenerateSnippet={ctx.handleGenerateSnippet}
        onJumpToSearch={() => ctx.setCurrentTab("search")}
      />
    </Layout>
  );
}
