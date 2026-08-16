import Layout from "@/components/Layout";
import { StandingAlerts } from "@/components/verisight/StandingAlerts";
import { useCase } from "@/lib/CaseContext";

export default function AlertsPage() {
  const ctx = useCase();
  return (
    <Layout>
      <StandingAlerts
        currentCase={ctx.currentCase}
        onSaveAlert={ctx.handleSaveAlert}
        onToggleAlert={() => ctx.handleToggleAlert()}
        onDeleteAlert={ctx.handleDeleteAlert}
        onJumpToEvent={(timeSec) => ctx.handleJumpToClipTime(ctx.selectedClipId, timeSec)}
      />
    </Layout>
  );
}
