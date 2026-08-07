"use client";

import WatanyHybridDefaultChat from "../features/hybrid-chat/WatanyHybridDefaultChat";

type WatanyLegacyChatProps = Record<string, unknown>;

function FeedbackButtons(props: WatanyLegacyChatProps) {
  return <WatanyHybridDefaultChat surfaceId="apps/web-user/src/components/FeedbackButtons.tsx" legacyProps={props} />;
}

export default FeedbackButtons;
export { FeedbackButtons };
export const feedbackService = FeedbackButtons;
