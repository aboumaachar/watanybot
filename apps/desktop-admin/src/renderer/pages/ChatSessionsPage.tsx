"use client";

import WatanyHybridDefaultChat from "../../../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function ChatSessionsPage(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/desktop-admin/src/renderer/pages/ChatSessionsPage.tsx" legacyProps={props} />;
}

export default ChatSessionsPage;
export { ChatSessionsPage };
