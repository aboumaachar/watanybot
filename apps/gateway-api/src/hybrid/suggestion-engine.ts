import type { CTAAction, ConversationContext, HybridRouteDecision, WatanyModule } from "@watany/types";
import { ensureOtherOption, generateDestinationCtas } from "./cta-generator";

type SuggestionInput = {
  currentModule?: WatanyModule;
  lastAnswer?: string;
  userRole?: string;
  activeAnnouncement?: string | null;
  sourceContent?: string;
  conversationContext?: ConversationContext;
  routeDecision?: Omit<HybridRouteDecision, "suggestedActions">;
};

export function generateHybridSuggestions(input: SuggestionInput): CTAAction[] {
  if (input.conversationContext?.awaitingTopicDecision) {
    return ensureOtherOption([
      { id: "same_topic", label: "نفس الموضوع", type: "reply", payload: { query: "نفس الموضوع" } },
      { id: "new_topic", label: "موضوع جديد", type: "reply", payload: { query: "موضوع جديد" } },
      { id: "support_topic", label: " الفني", type: "navigate", target: "support" },
    ]);
  }

  if (input.routeDecision) {
    return generateDestinationCtas(input.routeDecision.destination, input.conversationContext);
  }

  return generateDestinationCtas(input.currentModule || "assistant", input.conversationContext);
}