import Layout from "@/components/Layout";
import { SearchInvestigation } from "@/components/verisight/SearchInvestigation";
import { useCase } from "@/lib/CaseContext";

export default function SearchPage() {
  const ctx = useCase();
  return (
    <Layout>
      <SearchInvestigation
        currentCase={ctx.currentCase}
        onJumpToClipTime={ctx.handleJumpToClipTime}
        onSaveAlert={ctx.handleSaveAlert}
      />
    </Layout>
  );
}
