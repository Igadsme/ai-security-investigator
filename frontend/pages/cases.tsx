import Layout from "@/components/Layout";
import { CasesAndUpload } from "@/components/verisight/CasesAndUpload";
import { useCase } from "@/lib/CaseContext";
import { CaseData, VideoClip } from "@/types/verisight";

export default function CasesPage() {
  const ctx = useCase();
  return (
    <Layout>
      <CasesAndUpload
        allCases={ctx.allCases}
        currentCase={ctx.currentCase}
        onSelectCase={(id) => {
          ctx.setCurrentCaseId(id);
          const target = ctx.allCases.find((c) => c.id === id);
          if (target?.clips?.[0]) {
            ctx.setSelectedClipId(target.clips[0].id);
            ctx.setCurrentTime(0);
          }
        }}
        onCreateCase={(newCase: CaseData) => {
          ctx.handleCreateCase({
            title: newCase.title,
            description: newCase.description,
            priority: newCase.priority,
            caseNumber: newCase.caseNumber,
          });
        }}
        onAddClipToCase={async (caseId: string, clip: VideoClip) => {
          const file = (clip as VideoClip & { _file?: File })._file;
          if (file) await ctx.handleAddClipToCase(caseId, file, clip.camera);
        }}
      />
    </Layout>
  );
}
