import type { WatanyFeatureTemplateProps } from "./watanyFeatureTemplateTypes";
import { getWatanyFeatureCategoryStyle } from "./watanyFeatureTemplateRegistry";
import { WatanyLandingBodyTemplate } from "./WatanyLandingBodyTemplate";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./watany-feature-template.css";

export function WatanyFeatureTemplate({ category = "general", children, footer, className }: WatanyFeatureTemplateProps) {
  const style = getWatanyFeatureCategoryStyle(category);
  const rootClassName = ["watany-feature-template", "watany-feature-template--" + style.tone, className].filter(Boolean).join(" ");

  return (
    <WatanyLandingBodyTemplate>
      <main className={rootClassName} data-watany-feature-template="true" data-watany-feature-category={category} dir="rtl">
        <section className="watany-feature-template__content">{children}</section>
        {footer ? <footer className="watany-feature-template__footer">{footer}</footer> : null}
      </main>
    </WatanyLandingBodyTemplate>
  );
}
