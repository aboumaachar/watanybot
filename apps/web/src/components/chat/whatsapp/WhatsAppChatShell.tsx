"use client";

import WatanyHybridDefaultChat from "../../../../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function WhatsAppChatShell(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web/src/components/chat/whatsapp/WhatsAppChatShell.tsx" legacyProps={props} />;
}

export default WhatsAppChatShell;
export { WhatsAppChatShell };
