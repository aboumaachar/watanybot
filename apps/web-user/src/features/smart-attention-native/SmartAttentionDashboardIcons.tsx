import * as React from "react";
import { useNavigate } from "react-router-dom";
import { smartAttentionFeatures, recordSmartAttentionEvent } from "./smartAttentionNativeData";
import "./SmartAttentionDashboardIcons.css";
import { WatanyV4Icon } from "../../theme/watany-v4/WatanyV4Icon";

function openSmartAttentionFeature(id: string): void {
  recordSmartAttentionEvent("open_home_icon", id);
}

export function SmartAttentionDashboardIcons(): React.ReactElement {
  const navigate = useNavigate();

  const handleOpenFeature = React.useCallback((key: string, href: string) => {
    openSmartAttentionFeature(key);
    navigate(href);
  }, [navigate]);

  return (
    <section dir="rtl" aria-label="مختصر مهم" className="sa-home-icons">
      <div className="sa-home-icons__grid">
        {smartAttentionFeatures.map((feature) => (
          <button
            key={feature.key}
            type="button"
            className="watany-app-icon watany-app-icon--red"
            data-sa-feature={feature.key}
            onClick={() => handleOpenFeature(feature.key, feature.href)}
            aria-label={feature.title}
          >
            <span className="watany-app-icon__tile" aria-hidden="true">
              <span className="watany-app-icon__glyph">
                <WatanyV4Icon name={feature.key} alt="" />
              </span>
            </span>
            <span className="watany-app-icon__label">{feature.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
