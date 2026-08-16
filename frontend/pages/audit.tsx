import Layout from "@/components/Layout";
import { ChainOfCustody } from "@/components/verisight/ChainOfCustody";
import { useCase } from "@/lib/CaseContext";

export default function AuditPage() {
  const ctx = useCase();
  return (
    <Layout>
      <ChainOfCustody currentCase={ctx.currentCase} onVerifyIntegrity={ctx.handleVerifyIntegrity} />
    </Layout>
  );
}
