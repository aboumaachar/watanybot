"use client";

import WatanyHybridDefaultChat from "../../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function ChatMonitorPage(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-admin/src/pages/ChatMonitorPage.tsx" legacyProps={props} />;
}

export default ChatMonitorPage;
export { ChatMonitorPage };
