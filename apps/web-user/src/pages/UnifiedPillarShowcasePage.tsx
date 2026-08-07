import React from "react";
import { unifiedPillars } from "../features/unified-pillars/pillar-config";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../features/unified-pillars/unified-pillars.css";

import { WatanyFeatureTemplate } from "../components/template";

function renderPillarIcon(icon: string | React.ComponentType<React.SVGProps<SVGSVGElement>>) {
  if (typeof icon === "string") return icon;
  return React.createElement(icon, { "aria-hidden": "true" });
}

function UnifiedPillarShowcasePageLegacy() {
  const pillars = Object.values(unifiedPillars);

  return (
    <main className="unified-pillar-shell tone-green" dir="rtl">
      <section className="unified-pillar-hero">
        <div className="unified-pillar-hero-icon" aria-hidden="true">✅</div>
        <div className="unified-pillar-hero-copy">
          <p className="unified-pillar-eyebrow">نظام موحّد</p>
          <h1>واجهات الميزات الرئيسية</h1>
          <p>هذه الصفحة تعرض كل الميزات التي يجب أن تحصل على تصميم موحّد: رأس ثابت، شبكة أيقونات، بحث، فلاتر، وبطاقات موبايل.</p>
        </div>
      </section>
      <section className="watany-approved-home-icons unified-pillar-grid" data-unified-pillar-icon-grid>
        {pillars.map((pillar) => (
          <a key={pillar.id} href={pillar.route} className="unified-pillar-card" data-feature-key={pillar.id}>
            <span className="unified-pillar-card-icon" aria-hidden="true">{renderPillarIcon(pillar.icon)}</span>
            <strong>{pillar.title}</strong>
            <small>{pillar.subtitle}</small>
          </a>
        ))}
      </section>
    </main>
  );
}
export default function UnifiedPillarShowcasePage() {
  return (
    <WatanyFeatureTemplate
      category="general"
      eyebrow="WatanyBot unified surface"
      title="Unified Pillar Showcase"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.2."
      meta={[{ label: "Route", value: "/unified-pillar-showcase" }]}
      className="watany-template-batch-v142"
    >
      <div data-watany-template-batch="v1.4.2" data-watany-template-route="/unified-pillar-showcase">
        <UnifiedPillarShowcasePageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}
