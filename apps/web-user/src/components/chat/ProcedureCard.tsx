"use client";

import WatanyHybridDefaultChat from "../../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function ProcedureCard(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/chat/ProcedureCard.tsx" legacyProps={props} />;
}

export default ProcedureCard;
export { ProcedureCard };
