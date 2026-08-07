import { buildWatanyBehaviorDecision, applyGreetingToAnswer } from "../chatbot-behavior/watany-chatbot-policy";
import { matchKbTags, getKbScopesForRequest } from "../data/watany-kb-tags";
import { prependHolidayGreeting, type HolidayAudience } from "./watany-holiday-greetings";
import { resolveHolidayGreetingOptions, type WatanyAudienceContext } from "./watany-audience-context";

export type WatanyAgentInspection = {
  ok: boolean;
  checkedAt: string;
  detectedAgentHints: string[];
  requiredBehavior: {
    greetingFirst: boolean;
    lebaneseSlang: boolean;
    kbTags: boolean;
    groundedAnswering: boolean;
  };
  recommendations: string[];
};

export function prepareWatanyAgentInput(userMessage: string) {
  const behavior = buildWatanyBehaviorDecision(userMessage);
  const tags = matchKbTags(userMessage);
  const kbScopes = getKbScopesForRequest(userMessage);
  return {
    userMessage,
    behavior,
    tags,
    kbScopes,
    agentSystemInstruction: behavior.systemInstruction,
    metadata: {
      locale: "ar-LB",
      tone: behavior.tone,
      greetingRequired: behavior.shouldStartWithGreeting
    }
  };
}

export function finalizeWatanyAgentAnswer(
  userMessage: string,
  rawAnswer: string,
  audienceOrContext?: HolidayAudience | WatanyAudienceContext
): string {
  const withGreeting = applyGreetingToAnswer(userMessage, rawAnswer);
  return prependHolidayGreeting(withGreeting, resolveHolidayGreetingOptions(audienceOrContext));
}

export function inspectWatanyAiAgent(): WatanyAgentInspection {
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    detectedAgentHints: [
      "This inspection wrapper is installed.",
      "Connect prepareWatanyAgentInput before the existing integrated AI agent call.",
      "Connect finalizeWatanyAgentAnswer after the AI agent response."
    ],
    requiredBehavior: { greetingFirst: true, lebaneseSlang: true, kbTags: true, groundedAnswering: true },
    recommendations: [
      "Verify the real chat endpoint passes agentSystemInstruction into the integrated AI agent.",
      "Verify KB search receives kbScopes from the tag router.",
      "Log tag ids and latency only; do not log sensitive user content unless already allowed by app policy.",
      "Create regression tests for greeting input and non-greeting input."
    ]
  };
}