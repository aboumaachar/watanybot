"use client";

import WatanyHybridDefaultChat from "../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

function App(props) {
  return <WatanyHybridDefaultChat surfaceId="apps/web/src/App.jsx" legacyProps={props} />;
}

export default App;
export { App };
