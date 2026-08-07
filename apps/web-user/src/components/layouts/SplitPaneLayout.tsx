"use client";

import WatanyHybridDefaultChat from "../../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function SplitPaneLayout(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/layouts/SplitPaneLayout.tsx" legacyProps={props} />;
}

export default SplitPaneLayout;
export { SplitPaneLayout };
