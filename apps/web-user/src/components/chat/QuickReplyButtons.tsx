"use client";

import WatanyHybridDefaultChat from "../../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function QuickReplyButtons(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/chat/QuickReplyButtons.tsx" legacyProps={props} />;
}

export default QuickReplyButtons;
export { QuickReplyButtons };
