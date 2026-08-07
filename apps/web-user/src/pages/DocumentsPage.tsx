import UnifiedPillarPage from "../features/unified-pillars/UnifiedPillarPage";

import { WatanyFeatureTemplate } from "../components/template";
function UnifiedGeneratedPillarPageLegacy() {
  return <UnifiedPillarPage pillarId="documents" />;
}
export default function UnifiedGeneratedPillarPage() {
  return (
    <WatanyFeatureTemplate
      category="document"
      eyebrow="WatanyBot unified surface"
      title="Documents"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.1."
      meta={[{ label: "Route", value: "/documents" }]}
      className="watany-template-batch-v141"
    >
      <div data-watany-template-batch="v1.4.1" data-watany-template-route="/documents">
        <UnifiedGeneratedPillarPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}