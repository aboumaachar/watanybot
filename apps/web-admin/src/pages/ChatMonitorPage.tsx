"use client";

import { AppProvider } from "../../../web-user/src/store/app-provider";
import { FeatureFlagsProvider } from "../../../web-user/src/store/features-provider";
import WatanyHybridDefaultChat from "../../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function ChatMonitorPage(props: WatanyLegacyChatProps) {
  return (
    <FeatureFlagsProvider>
      <AppProvider>
        <WatanyHybridDefaultChat surfaceId="apps/web-admin/src/pages/ChatMonitorPage.tsx" legacyProps={props} />
      </AppProvider>
    </FeatureFlagsProvider>
  );
}

export default ChatMonitorPage;
export { ChatMonitorPage };
