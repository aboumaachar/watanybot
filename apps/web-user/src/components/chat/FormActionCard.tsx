"use client";

import WatanyHybridDefaultChat from "../../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function normalizeUrl(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/chat/FormActionCard.tsx" legacyProps={props} />;
}

export default normalizeUrl;
export { normalizeUrl };
export const FormActionCard = normalizeUrl;
