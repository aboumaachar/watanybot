import UnifiedPillarPage from "../features/unified-pillars/UnifiedPillarPage";

import { WatanyFeatureTemplate } from "../components/template";
function UnifiedGeneratedPillarPageLegacy() {
  return <UnifiedPillarPage pillarId="world-cup" />;
}
export default function UnifiedGeneratedPillarPage() {
  return (
    <WatanyFeatureTemplate
      category="general"
      eyebrow="WatanyBot unified surface"
      title="World Cup"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.2."
      meta={[{ label: "Route", value: "/world-cup/today" }]}
      className="watany-template-batch-v142"
    >
      <div data-watany-template-batch="v1.4.2" data-watany-template-route="/world-cup/today">
        <UnifiedGeneratedPillarPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}