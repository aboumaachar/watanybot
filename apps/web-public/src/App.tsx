"use client";

import WatanyHybridDefaultChat from "../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function App(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-public/src/App.tsx" legacyProps={props} />;
}

export default App;
export { App };
