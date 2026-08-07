import * as React from "react";
import { SmartAttentionWidget } from "./SmartAttentionWidget";
import { getSmartAttentionFeature, type SmartAttentionFeatureKey } from "./smartAttentionNativeData";

type SmartAttentionFeaturePageProps = {
  featureKey: SmartAttentionFeatureKey;
};

export function SmartAttentionFeaturePage({ featureKey }: SmartAttentionFeaturePageProps): React.ReactElement {
  const feature = getSmartAttentionFeature(featureKey);

  return (
    <main dir="rtl">
      <SmartAttentionWidget featureKey={feature.key} limit={8} />
    </main>
  );
}