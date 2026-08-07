"use client";

import WatanyHybridDefaultChat from "../../../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function App(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/api-backend/apps/public-chat/src/App.jsx" legacyProps={props} />;
}

export default App;
export { App };
