"use client";

import WatanyHybridDefaultChat from "../../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function CommandPaletteLayout(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/layouts/CommandPaletteLayout.tsx" legacyProps={props} />;
}

export default CommandPaletteLayout;
export { CommandPaletteLayout };
