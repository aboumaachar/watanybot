"use client";

import WatanyHybridDefaultChat from "../../../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function WhatsAppChatShell(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/chat/whatsapp/WhatsAppChatShell.tsx" legacyProps={props} />;
}

export default WhatsAppChatShell;
export { WhatsAppChatShell };
