import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  getSmartAttentionFeature,
  loadSmartAttentionItems,
  recordSmartAttentionEvent,
  recordEngagementOpen,
  type SmartAttentionFeatureKey,
  type SmartAttentionItem,
} from "./smartAttentionNativeData";
import { WatanyListingCard } from "../../components/listings/WatanyListingCard";
import { smartAttentionNativeTheme } from "./smartAttentionNativeTheme";
import { useApp } from "../../store/app";

type SmartAttentionWidgetProps = {
  featureKey: SmartAttentionFeatureKey;
  limit?: number;
};

function openSmartAttentionItem(item: SmartAttentionItem, navigate: (to: string) => void, apiBaseUrl: string): void {
  recordSmartAttentionEvent("open_item", item.id);
  recordEngagementOpen(item, apiBaseUrl);
  if (!item.href || item.href === "#") {
    return;
  }

  if (/^https?:\/\//i.test(item.href)) {
    if (typeof window !== "undefined") {
      window.location.assign(item.href);
    }
    return;
  }

  navigate(item.href);
}

export function SmartAttentionWidget({ featureKey, limit = 3 }: SmartAttentionWidgetProps): React.ReactElement {
  const navigate = useNavigate();
  const { apiBaseUrl } = useApp();
  const feature = getSmartAttentionFeature(featureKey);
  const [items, setItems] = React.useState<SmartAttentionItem[]>(feature.items);

  React.useEffect(() => {
    let isMounted = true;
    loadSmartAttentionItems(featureKey, apiBaseUrl).then((loadedItems) => {
      if (isMounted) {
        setItems(loadedItems);
      }
    });
    recordSmartAttentionEvent("view_widget", featureKey);
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, featureKey]);

  return (
    <section dir="rtl" aria-label={feature.title} className={smartAttentionNativeTheme.section}>
      <header className={smartAttentionNativeTheme.header}>
        <h2 className={smartAttentionNativeTheme.title}>{feature.title}</h2>
      </header>

      {items.length === 0 ? <p className="wt-muted">لم تتكوّن بيانات استخدام كافية بعد لعرض ترتيب موثوق.</p> : null}
      <div className={smartAttentionNativeTheme.grid}>
        {items.slice(0, limit).map((item) => (
          <WatanyListingCard
            key={item.id}
            title={item.title}
            summary={item.summary}
            badges={[
              { label: item.kind },
              ...(item.source ? [{ label: item.source, tone: "gold" as const }] : []),
            ]}
            primaryAction={{ label: "افتح", onClick: () => openSmartAttentionItem(item, navigate, apiBaseUrl) }}
          />
        ))}
      </div>
    </section>
  );
}