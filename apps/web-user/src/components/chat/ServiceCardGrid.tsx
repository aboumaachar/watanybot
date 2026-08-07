"use client";

import WatanyHybridDefaultChat from "../../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function ServiceCardGrid(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/chat/ServiceCardGrid.tsx" legacyProps={props} />;
}

export default ServiceCardGrid;
export { ServiceCardGrid };
