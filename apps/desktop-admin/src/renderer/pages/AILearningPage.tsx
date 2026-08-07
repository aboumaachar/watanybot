"use client";

import WatanyHybridDefaultChat from "../../../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function AILearningPage(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/desktop-admin/src/renderer/pages/AILearningPage.tsx" legacyProps={props} />;
}

export default AILearningPage;
export { AILearningPage };
