import path from "node:path";
import { describe, expect, it } from "vitest";

import { HybridRouteDecisionEngine } from "../hybrid/hybrid-route-engine";
import { createChatService } from "../lib/chat-service";

describe("hybrid route decision engine", () => {
  it("routes salary asks to a service flow with a mandatory other CTA", () => {
    const engine = new HybridRouteDecisionEngine();
    const decision = engine.decide({
      rawText: "احسب معاشي",
      normalizedText: "احسب معاشي",
    });

    expect(decision.mode).toBe("service");
    expect(decision.destination).toBe("salary");
    expect(decision.shouldOpenFlow).toBe(true);
    expect(decision.suggestedActions).toHaveLength(4);
    expect(decision.suggestedActions[0]).toMatchObject({ type: "open_service_flow", target: "salary" });
    expect(decision.suggestedActions.at(-1)).toMatchObject({ label: "أو شي تاني" });
  });

  it("keeps recruitment follow-ups on the same lookup topic", () => {
    const engine = new HybridRouteDecisionEngine();
    const decision = engine.decide({
      rawText: "وين التقديم؟",
      normalizedText: "وين التقديم",
      conversationContext: {
        conversationId: "session:test",
        originalQuestion: "في تطويع بالجيش؟",
        originalIntent: "recruitment",
        originalModule: "recruitment",
        activeDestination: "recruitment",
        activeIntent: "ask_recruitment",
        updatedAt: new Date().toISOString(),
      },
    });

    expect(decision.destination).toBe("recruitment");
    expect(decision.mode).toBe("lookup");
    expect(decision.reason).toContain("followup");
  });
});

describe("chat service hybrid contract", () => {
  it("attaches routeDecision, context, and ctas to deterministic salary replies", async () => {
    const service = createChatService({
      repoRootPath: path.resolve(__dirname, "../../.."),
      usePython: false,
      getPythonBase: () => "http://127.0.0.1:8012",
      getKbStore: () => null,
      useAi: false,
      getAiChat: () => null,
      getAiProvider: () => "test",
      getAiModel: () => "test",
      aiRagTopK: 5,
      aiSystemPrompt: "",
      aiConversationHistory: new Map(),
      retrieveChunks: () => [],
      buildAiMessages: () => [],
      extractIntents: () => ({ intents: [] }),
      evaluateRelevance: () => ({ confidence: "none", topScore: 0 }),
      getRagChunkCount: () => 0,
      isKbNodesReady: () => false,
      searchKbNodes: () => ({ nodes: [], confidence: "none", total: 0, elapsed_ms: 0, intent: null }),
      computeEmotionalScore: () => 0,
      empathySystemInjection: "",
      classifySmallTalk: () => null,
      logUnrecognizedInput: () => undefined,
      getRandomClarifyResponse: () => "",
      aiFailureCount: { value: 0 },
      lastAiFailure: { value: null },
      pendingProcedureConfirmations: new Map(),
      pendingClarificationSelections: new Map(),
      conversationContexts: new Map(),
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    const response = await service.fetchChatResponse({
      message: "احسب معاشي",
      sessionId: "session-hybrid-salary",
      channel: "web",
      userId: "00000000-0000-4000-8000-00000000hyb1",
    });

    expect(response.module).toBe("salary");
    expect(response.mode).toBe("service");
    expect(response.routeDecision).toMatchObject({
      destination: "salary",
      mode: "service",
      shouldOpenFlow: true,
    });
    expect(response.context).toMatchObject({
      conversationId: "session:session-hybrid-salary",
      activeDestination: "salary",
    });
    expect(response.ctas).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "ابدأ الحاسبة", type: "open_service_flow", target: "salary" }),
      expect.objectContaining({ label: "أو شي تاني", type: "reply" }),
    ]));
    expect(response.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "open_module", moduleId: "salary" }),
      expect.objectContaining({ type: "suggest_query", query: "أو شي تاني" }),
    ]));
  });
});