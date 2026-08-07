import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { buildAiMessages } from "../ai/rag";
import { createChatService } from "../lib/chat-service";
import { chatRoutes } from "../routes/chat";
import { prepareWatanyAgentInput } from "../services/watany-ai-agent-bridge";

function parseSseEvents(body: string): Array<{ event: string; data: string }> {
  return body
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) || "message";
      const data = lines
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
      return { event, data };
    });
}

describe("chatbot behavior integration", () => {
  it("maps pension queries to behavior tags and scopes", () => {
    const prepared = prepareWatanyAgentInput("مرحبا بدي اعرف عن المعاش");

    expect(prepared.behavior.shouldStartWithGreeting).toBe(true);
    expect(prepared.tags).toEqual(expect.arrayContaining([
      expect.objectContaining({ tagId: "pension" }),
    ]));
    expect(prepared.kbScopes).toEqual(expect.arrayContaining(["pension", "salary", "retirement"]));
  });

  it("threads prepared system instruction and scope hints into non-stream AI chat", async () => {
    const captured: { scopeHints?: string[]; systemMessage?: string } = {};

    const service = createChatService({
      repoRootPath: process.cwd(),
      usePython: false,
      getPythonBase: () => "http://127.0.0.1:8012",
      getKbStore: () => null,
      useAi: true,
      getAiChat: () => ({
        name: "test",
        complete: async (messages) => {
          captured.systemMessage = messages.find((message) => message.role === "system")?.content || "";
          return "أكيد، فيك تراجع معاملات المعاش عبر الدائرة المالية.";
        },
        stream: async () => "",
        healthCheck: async () => ({ ok: true, model: "test", latencyMs: 1 }),
      }),
      getAiProvider: () => "test",
      getAiModel: () => "test",
      aiRagTopK: 5,
      aiSystemPrompt: "",
      aiConversationHistory: new Map(),
      retrieveChunks: (_query, _topK, scopeHints) => {
        captured.scopeHints = scopeHints;
        return [];
      },
      buildAiMessages,
      extractIntents: () => ({ intents: [] }),
      evaluateRelevance: () => ({ confidence: "medium", topScore: 5 }),
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
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    });

    const response = await service.fetchChatResponse({
      message: "مرحبا بدي اعرف عن المعاش",
      channel: "web",
      userId: "00000000-0000-4000-8000-000000000701",
    });

    expect(captured.scopeHints).toEqual(expect.arrayContaining(["pension", "salary", "retirement"]));
    expect(captured.systemMessage).toContain("استعمل لهجة لبنانية بسيطة وقريبة من الناس في المحادثة العادية.");
    expect(captured.systemMessage).toContain("إذا بدأ المستخدم بتحية");
    expect(response.reply).toMatch(/^أهلا وسهلا فيك، كيف فيني ساعدك\؟/);
    expect(response.debug).toMatchObject({
      agent: {
        greetingRequired: true,
        tone: "LEBANESE_SLANG",
        tagIds: expect.arrayContaining(["pension"]),
        kbScopes: expect.arrayContaining(["pension", "salary"]),
      },
    });
  });

  it("threads prepared scopes and tone instructions into streamed AI chat", async () => {
    const captured: { scopeHints?: string[]; systemMessage?: string } = {};
    const expectedGreeting = "أهلا وسهلا فيك، كيف فيني ساعدك؟";

    const app = Fastify();
    await app.register(chatRoutes, {
      pluginDb: {} as never,
      fetchChatResponse: async () => ({ reply: "", intents: [] }),
      fetchChatResponseLegacy: async () => ({ reply: "fallback", intents: [] }),
      resolveDeterministicChatResponse: async () => ({ response: null, timings: {} }),
      useAi: true,
      getAiChat: () => ({
        name: "test",
        complete: async () => "",
        stream: async (messages, onEvent) => {
          captured.systemMessage = messages.find((message) => message.role === "system")?.content || "";
          onEvent({ type: "delta", delta: `${expectedGreeting}\n\nتفاصيل المعاش من الدائرة المالية.` });
          return `${expectedGreeting}\n\nتفاصيل المعاش من الدائرة المالية.`;
        },
        healthCheck: async () => ({ ok: true, model: "test", latencyMs: 1 }),
      }),
      getAiProvider: () => "test",
      getAiModel: () => "test",
      aiRagTopK: 5,
      aiSystemPrompt: "",
      aiConversationHistory: new Map(),
      retrieveChunks: (_query, _topK, scopeHints) => {
        captured.scopeHints = scopeHints;
        return [];
      },
      buildAiMessages,
      extractIntents: () => ({ intents: [] }),
      evaluateRelevance: () => ({ confidence: "medium", topScore: 5 }),
      getRagChunkCount: () => 0,
      isKbNodesReady: () => false,
      searchKbNodes: () => ({ nodes: [], confidence: "none", total: 0, elapsed_ms: 0, intent: null }),
      classifySmallTalk: () => null,
      logUnrecognizedInput: () => undefined,
      getRandomClarifyResponse: () => "",
      aiFailureCount: { value: 0 },
      lastAiFailure: { value: null },
      getKbStore: () => null,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: {
        message: "مرحبا بدي اعرف عن المعاش",
        channel: "web",
        userId: "00000000-0000-4000-8000-000000000702",
      },
    });

    await app.close();

    const events = parseSseEvents(response.body);
    const deltaPayloads = events
      .filter((event) => event.event === "delta")
      .map((event) => JSON.parse(event.data) as { delta: string });
    const metaPayload = JSON.parse(events.find((event) => event.event === "meta")?.data || "{}") as { reply?: string };

    expect(response.statusCode).toBe(200);
    expect(captured.scopeHints).toEqual(expect.arrayContaining(["pension", "salary", "retirement"]));
    expect(captured.systemMessage).toContain("استعمل لهجة لبنانية بسيطة وقريبة من الناس في المحادثة العادية.");
    expect(deltaPayloads[0]?.delta).toBe(`${expectedGreeting}\n\n`);
    expect(deltaPayloads[1]?.delta).toBe("تفاصيل المعاش من الدائرة المالية.");
    expect(metaPayload.reply).toBe(`${expectedGreeting}\n\nتفاصيل المعاش من الدائرة المالية.`);
  });
});