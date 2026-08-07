"use client";

import WatanyHybridDefaultChat from "../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function CitationPill(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/ChatMessageView.tsx" legacyProps={props} />;
}

export default CitationPill;
export { CitationPill };
export const ChatMessageView = CitationPill;
