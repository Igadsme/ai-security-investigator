import Layout from "@/components/Layout";
import { FacilityMap } from "@/components/verisight/FacilityMap";
import { useCase } from "@/lib/CaseContext";

export default function MapPage() {
  const ctx = useCase();
  return (
    <Layout>
      <FacilityMap
        currentCase={ctx.currentCase}
        onSelectCameraClip={(camName) => {
          const matched = ctx.currentCase.clips.find(
            (c) =>
              c.camera.toLowerCase().includes(camName.toLowerCase()) ||
              camName.toLowerCase().includes(c.camera.toLowerCase())
          );
          if (matched) {
            ctx.setSelectedClipId(matched.id);
            ctx.setCurrentTime(0);
          }
          ctx.setCurrentTab("investigation");
        }}
      />
    </Layout>
  );
}
