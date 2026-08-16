import Layout from "@/components/Layout";
import { MultiCameraTimeline } from "@/components/verisight/MultiCameraTimeline";
import { useCase } from "@/lib/CaseContext";

export default function TimelinePage() {
  const ctx = useCase();
  return (
    <Layout>
      <MultiCameraTimeline currentCase={ctx.currentCase} onOpenClipAtTime={ctx.handleJumpToClipTime} />
    </Layout>
  );
}
