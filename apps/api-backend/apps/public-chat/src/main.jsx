"use client";

import WatanyHybridDefaultChat from "../../../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function main(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/api-backend/apps/public-chat/src/main.jsx" legacyProps={props} />;
}

export default main;
export { main };
