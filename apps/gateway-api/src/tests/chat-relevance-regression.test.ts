import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { normalizeArabic } from "@watany/shared/arabic";

import { classifySmallTalk, getSmallTalkIntents, setSmallTalkIntents, type SmallTalkIntent } from "../lib/intent-classifier";
import { loadRagChunks, resetRagChunks, retrieveChunks } from "../ai/rag";
import { buildClarificationOptions, buildKbFallbackReply, createChatService, getChunkTitle, shouldPreferDeterministicFamilyPensionReply } from "../lib/chat-service";
import { createRecruitmentAnnouncement } from "../recruitment/service";
import { STORE_PATH as recruitmentStorePath } from "../recruitment/store";
import { chatRoutes } from "../routes/chat";

const originalIntents = getSmallTalkIntents();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ragCandidates = [
  path.resolve(__dirname, "../../../../watany_kb_tables_v4/watany_rag_chunks_v4.jsonl"),
  path.resolve(__dirname, "../../../watany_kb_tables_v4/watany_rag_chunks_v4.jsonl"),
];
const ragPath = ragCandidates.find((candidate) => fs.existsSync(candidate)) || ragCandidates[0];
const recruitmentStoreBackup = fs.existsSync(recruitmentStorePath)
  ? fs.readFileSync(recruitmentStorePath, "utf-8")
  : null;
let appPromise: Promise<typeof import("../server").default> | null = null;

process.env.JWT_SECRET ||= "test-jwt-secret-for-chat-regression-0123456789";
process.env.DISABLE_PLUGIN_DB ||= "true";
process.env.DISABLE_KB_NODES ||= "true";
process.env.DISABLE_CHAT_PERSIST ||= "true";
process.env.AI_RAG_CHUNKS_PATH = ragPath;

async function getApp() {
  appPromise ||= import("../server").then((mod) => mod.default);
  return appPromise;
}

function restoreRecruitmentStore() {
  if (recruitmentStoreBackup === null) {
    if (fs.existsSync(recruitmentStorePath)) {
      fs.rmSync(recruitmentStorePath, { force: true });
    }
    return;
  }

  fs.mkdirSync(path.dirname(recruitmentStorePath), { recursive: true });
  fs.writeFileSync(recruitmentStorePath, recruitmentStoreBackup, "utf-8");
}

const familyPensionQueries = [
  { query: "معاش الابنة", stableTerms: ["ابنه"] },
  { query: "معاش الابنة الأرملة" },
  { query: "معاش الابنة المطلقة" },
  { query: "معاش الابن الذي يتابع الدراسة", stableTerms: ["ابن"] },
  { query: "معاش الابن القاصر", stableTerms: ["ابن"] },
  { query: "معاش الزوجة", stableTerms: ["زوجه"] },
  { query: "معاش الوالدة", stableTerms: ["والده"] },
] as const;

const beneficiarySpecificChunkExpectations = [
  {
    query: "معاش الابنة الأرملة",
    stableTerms: ["ابنه", "ارمله"],
  },
  {
    query: "معاش الابنة المطلقة",
    stableTerms: ["ابنه", "مطلقه"],
  },
  {
    query: "معاش الابن الذي يتابع الدراسة",
    stableTerms: ["ابن", "دراسه"],
  },
  {
    query: "معاش الزوجة",
    stableTerms: ["زوجه"],
  },
  {
    query: "معاش الوالدة",
    stableTerms: ["والده"],
  },
] as const;

afterEach(() => {
  setSmallTalkIntents(originalIntents);
  resetRagChunks();
  restoreRecruitmentStore();
});

afterAll(async () => {
  if (appPromise !== null) {
    const fastifyApp = await appPromise;
    await fastifyApp.close();
  }
  restoreRecruitmentStore();
}, 30000);

describe("chat relevance regressions", () => {
  it("does not classify family pension queries as small-talk rejection", () => {
    const intents: SmallTalkIntent[] = [
      { name: "no", patterns: ["لا", "لأ", "ما بدي"], responses: ["تمام، ما في مشكلة. شو بتحب تعمل؟"] },
      { name: "greeting", patterns: ["مرحبا"], responses: ["أهلين"] },
    ];
    setSmallTalkIntents(intents);

    for (const { query } of familyPensionQueries) {
      expect(classifySmallTalk(query), query).toBeNull();
      expect(classifySmallTalk(`طلب ${query}`), `طلب ${query}`).toBeNull();
      expect(classifySmallTalk(`شو شروط ${query}`), `شو شروط ${query}`).toBeNull();
    }

    expect(classifySmallTalk("لا")).toMatchObject({ name: "no" });
    expect(classifySmallTalk("مرحبا")).toMatchObject({ name: "greeting" });
  });

  it("returns a greeting from the gateway chat endpoint for مسا الخير without KB leakage", async () => {
    const intents: SmallTalkIntent[] = [
      {
        name: "greeting",
        patterns: ["مسا الخير", "مساء الخير"],
        responses: ["أهلين! أنا هون لخدمتك. احكيلي شو بدك وبساعدك."],
      },
      { name: "no", patterns: ["لا", "لأ", "ما بدي"], responses: ["تمام، ما في مشكلة. شو بتحب تعمل؟"] },
    ];
    setSmallTalkIntents(intents);

    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "مسا الخير", channel: "web", userId: "00000000-0000-4000-8000-000000000001" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toMatch(/(اهلين|أهلين|يا هلا|هلا والله|مرحبا|شو بقدر)/);
    expect(body.reply).not.toContain("قانون العمل");
    expect(body.reply).not.toMatch(/law_|rag_|doc_|kb_/i);
    expect(body.ctas).toEqual([
      expect.objectContaining({ label: "", type: "navigate", target: "assistant" }),
      expect.objectContaining({ label: "الخدمات", type: "navigate", target: "services" }),
      expect.objectContaining({ label: "المجتمع", type: "navigate", target: "community" }),
      expect.objectContaining({ label: "أو شي تاني", type: "reply" }),
    ]);
    expect(body.intents).toEqual([
      { type: "open_module", label: "", moduleId: "assistant" },
      { type: "open_module", label: "الخدمات", moduleId: "services" },
      { type: "open_module", label: "المجتمع", moduleId: "community" },
      { type: "suggest_query", label: "أو شي تاني", query: "أو شي تاني" },
    ]);
    expect(body.clarifying_question).toBeUndefined();
    expect(body.menu).toBeUndefined();
    expect(body.sources).toBeUndefined();
    expect(body.debug).toMatchObject({ chitchat: "greeting" });
  }, 60000);

  it("returns pension-related clarification options for معاملات التقاعد والمعاش", async () => {
    const intents: SmallTalkIntent[] = [
      { name: "no", patterns: ["لا", "لأ", "ما بدي"], responses: ["تمام، ما في مشكلة. شو بتحب تعمل؟"] },
      { name: "greeting", patterns: ["مرحبا"], responses: ["أهلين"] },
    ];
    setSmallTalkIntents(intents);

    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "معاملات التقاعد والمعاش", channel: "web", userId: "00000000-0000-4000-8000-000000000001" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("سؤالك قد يشير إلى أكثر من موضوع");
    expect(body.reply).not.toContain("تمام، ما في مشكلة");
    expect(body.menu).toEqual(expect.arrayContaining([
      "معاملات التقاعد",
      "معاش الزوجة",
      "معاش الابنة الأرملة",
    ]));
    expect(body.debug).toMatchObject({ reason: "short_no_kb_match", unrecognized: true });
  }, 30000);

  it("forces a clarifying question for ambiguous short pension keywords before AI can improvise", async () => {
    let aiWasCalled = false;
    const service = createChatService({
      repoRootPath: path.resolve(__dirname, "../../.."),
      usePython: false,
      getPythonBase: () => "http://127.0.0.1:8012",
      getKbStore: () => null,
      useAi: true,
      getAiChat: () => ({
        complete: async () => {
          aiWasCalled = true;
          return "هذا رد عام لا يجب الوصول إليه";
        },
      } as never),
      getAiProvider: () => "test",
      getAiModel: () => "test",
      aiRagTopK: 5,
      aiSystemPrompt: "",
      aiConversationHistory: new Map(),
      retrieveChunks: () => [],
      buildAiMessages: () => [],
      extractIntents: () => ({ intents: [] }),
      evaluateRelevance: () => ({ confidence: "medium", topScore: 0.42 }),
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
      message: "معاش",
      channel: "web",
      userId: "00000000-0000-4000-8000-000000000179",
    });

    expect(aiWasCalled).toBe(false);
    expect(response.reply).toContain("سؤالك قد يشير إلى أكثر من موضوع");
    expect(response.clarifying_question).toBe("أي موضوع تقصد تحديداً؟");
    expect(response.menu).toEqual(expect.arrayContaining([
      "معاش الزوجة",
      "معاش الوالدة",
      "معاش الابنة الأرملة",
    ]));
    expect(response.debug).toMatchObject({
      unrecognized: true,
      reason: "insufficient_context",
      forcedClarification: true,
      fallbackTopics: expect.arrayContaining(["معاش الزوجة", "معاش الوالدة"]),
    });
  });

  it("forces a clarifying question for ambiguous short school keywords before AI can improvise", async () => {
    let aiWasCalled = false;
    const service = createChatService({
      repoRootPath: path.resolve(__dirname, "../../.."),
      usePython: false,
      getPythonBase: () => "http://127.0.0.1:8012",
      getKbStore: () => null,
      useAi: true,
      getAiChat: () => ({
        complete: async () => {
          aiWasCalled = true;
          return "هذا رد عام لا يجب الوصول إليه";
        },
      } as never),
      getAiProvider: () => "test",
      getAiModel: () => "test",
      aiRagTopK: 5,
      aiSystemPrompt: "",
      aiConversationHistory: new Map(),
      retrieveChunks: () => [],
      buildAiMessages: () => [],
      extractIntents: () => ({ intents: [] }),
      evaluateRelevance: () => ({ confidence: "medium", topScore: 0.37 }),
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
      message: "مدارس",
      channel: "web",
      userId: "00000000-0000-4000-8000-000000000180",
    });

    expect(aiWasCalled).toBe(false);
    expect(response.reply).toContain("سؤالك قد يشير إلى أكثر من موضوع");
    expect(response.clarifying_question).toBe("أي موضوع تقصد تحديداً؟");
    expect(response.menu).toEqual(expect.arrayContaining([
      "المساعدات المدرسية",
      "نماذج طلبات المساعدات المدرسية في الجيش",
      "طلب نسبة قيمة المساعدات المدرسية",
    ]));
    expect(response.debug).toMatchObject({
      unrecognized: true,
      reason: "insufficient_context",
      forcedClarification: true,
      fallbackTopics: expect.arrayContaining(["المساعدات المدرسية", "نماذج طلبات المساعدات المدرسية في الجيش"]),
    });
  });

  it("forces a clarifying question for additional broad one-word domains before lookup or AI answer", async () => {
    let aiWasCalled = false;
    const service = createChatService({
      repoRootPath: path.resolve(__dirname, "../../.."),
      usePython: false,
      getPythonBase: () => "http://127.0.0.1:8012",
      getKbStore: () => null,
      useAi: true,
      getAiChat: () => ({
        complete: async () => {
          aiWasCalled = true;
          return "هذا رد عام لا يجب الوصول إليه";
        },
      } as never),
      getAiProvider: () => "test",
      getAiModel: () => "test",
      aiRagTopK: 5,
      aiSystemPrompt: "",
      aiConversationHistory: new Map(),
      retrieveChunks: () => [],
      buildAiMessages: () => [],
      extractIntents: () => ({ intents: [] }),
      evaluateRelevance: () => ({ confidence: "medium", topScore: 0.31 }),
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

    const expectations = [
      {
        query: "جامعة",
        expectedOptions: ["المساعدات المدرسية", "نماذج طلبات المساعدات المدرسية في الجيش"],
      },
      {
        query: "منح",
        expectedOptions: ["المساعدات المدرسية", "طلب نسبة قيمة المساعدات المدرسية"],
      },
      {
        query: "أوراق",
        expectedOptions: ["معاملات التقاعد", "معاملات على العاتق"],
      },
    ] as const;

    for (const testCase of expectations) {
      const response = await service.fetchChatResponse({
        message: testCase.query,
        channel: "web",
        userId: `00000000-0000-4000-8000-${testCase.query.length.toString().padStart(12, "0")}`,
      });

      expect(response.reply, testCase.query).toContain("سؤالك قد يشير إلى أكثر من موضوع");
      expect(response.clarifying_question, testCase.query).toBe("أي موضوع تقصد تحديداً؟");
      expect(response.menu, testCase.query).toEqual(expect.arrayContaining(testCase.expectedOptions));
      expect(response.debug, testCase.query).toMatchObject({
        unrecognized: true,
        reason: "insufficient_context",
        forcedClarification: true,
        earlyTopicClarification: true,
      });
    }

    expect(aiWasCalled).toBe(false);
  });

  it("asks which payment type the user means for broad payment timing queries", async () => {
    let aiWasCalled = false;
    const service = createChatService({
      repoRootPath: path.resolve(__dirname, "../../.."),
      usePython: false,
      getPythonBase: () => "http://127.0.0.1:8012",
      getKbStore: () => null,
      useAi: true,
      getAiChat: () => ({
        complete: async () => {
          aiWasCalled = true;
          return "هذا رد عام لا يجب الوصول إليه";
        },
      } as never),
      getAiProvider: () => "test",
      getAiModel: () => "test",
      aiRagTopK: 5,
      aiSystemPrompt: "",
      aiConversationHistory: new Map(),
      retrieveChunks: () => [],
      buildAiMessages: () => [],
      extractIntents: () => ({ intents: [] }),
      evaluateRelevance: () => ({ confidence: "medium", topScore: 0.28 }),
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
      message: "متى الدفع",
      channel: "web",
      userId: "00000000-0000-4000-8000-000000000181",
    });

    expect(aiWasCalled).toBe(false);
    expect(response.reply).toContain("حتى أحدد المقصود بالدفع بدقة");
    expect(response.clarifying_question).toBe("أي دفعة أو استحقاق تقصد تحديداً؟");
    expect(response.menu).toEqual(expect.arrayContaining([
      "موعد دفع الراتب الشهري",
      "موعد دفع المعاش التقاعدي",
      "موعد دفع المساعدات المدرسية",
      "موعد دفع التعويضات والمساعدات",
    ]));
    expect(response.debug).toMatchObject({
      payment_timing_clarification: true,
      payment_timing_options: expect.arrayContaining([
        "موعد دفع الراتب الشهري",
        "موعد دفع المعاش التقاعدي",
      ]),
    });
  });

  it("supports numbered clarification selections across requests and resolves the chosen option", async () => {
    const app = await getApp();
    const userId = "00000000-0000-4000-8000-000000000182";
    const sessionId = "numbered-clarification-selection-session";

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "معاش", channel: "web", userId, sessionId },
    });

    expect(firstResponse.statusCode).toBe(200);

    const firstBody = firstResponse.json();
    expect(firstBody.reply).toContain("1. معاش الزوجة");
    expect(firstBody.reply).toContain("2. معاش الوالدة");
    expect(firstBody.menu.at(-1)).toBe("شيء آخر غير مذكور");
    expect(firstBody.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "suggest_query", label: "شيء آخر غير مذكور", query: "شيء آخر غير مذكور" }),
    ]));

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "2", channel: "web", userId, sessionId },
    });

    expect(secondResponse.statusCode).toBe(200);

    const secondBody = secondResponse.json();
    expect(secondBody.reply).toContain("هذا هو الإجراء الكامل");
    expect(secondBody.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "procedure" }),
    ]));
    expect(secondBody.debug).toMatchObject({
      procedure_confirmation_resolved: true,
    });
  }, 30000);

  it("offers an explicit other option and asks whether the user means the same topic or a new one when selected by number", async () => {
    const app = await getApp();
    const userId = "00000000-0000-4000-8000-000000000183";
    const sessionId = "numbered-clarification-other-session";

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "مدارس", channel: "web", userId, sessionId },
    });

    expect(firstResponse.statusCode).toBe(200);

    const firstBody = firstResponse.json();
    expect(firstBody.menu.at(-1)).toBe("شيء آخر غير مذكور");

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: String(firstBody.menu.length), channel: "web", userId, sessionId },
    });

    expect(secondResponse.statusCode).toBe(200);

    const secondBody = secondResponse.json();
    expect(secondBody.reply).toBe("هل تقصد نفس الموضوع أو موضوع جديد؟");
    expect(secondBody.clarifying_question).toBe("هل تقصد نفس الموضوع أو موضوع جديد؟");
    expect(secondBody.debug).toMatchObject({ clarification_other_selected: true, awaiting_topic_decision: true });
  }, 30000);

  it("retrieves KB chunks for similar family pension queries", () => {
    const loadedCount = loadRagChunks(ragPath);
    expect(loadedCount).toBeGreaterThan(0);

    for (const { query, stableTerms } of familyPensionQueries) {
      const hits = retrieveChunks(query, 5);
      expect(hits.length, query).toBeGreaterThan(0);

      if (stableTerms) {
        const normalizedTexts = hits.map((hit) => normalizeArabic(hit.text));
        const hasRelevantHit = normalizedTexts.some(
          (text) => text.includes("معاش") && stableTerms.some((term) => text.includes(term)),
        );

        expect(hasRelevantHit, query).toBe(true);
      }
    }
  });

  it("keeps beneficiary-specific pension chunks in the top results", () => {
    const loadedCount = loadRagChunks(ragPath);
    expect(loadedCount).toBeGreaterThan(0);

    for (const { query, stableTerms } of beneficiarySpecificChunkExpectations) {
      const hits = retrieveChunks(query, 5);
      const hitLabels = hits.map((hit) => {
        const title = typeof hit.metadata?.title_ar === "string" ? hit.metadata.title_ar : "";
        return `${hit.id}:${title}`;
      });
      const normalizedHitText = hits.map((hit) => {
        const title = typeof hit.metadata?.title_ar === "string" ? hit.metadata.title_ar : "";
        return normalizeArabic(`${title}\n${hit.text}`);
      });

      expect(
        normalizedHitText.some((text) => stableTerms.some((term) => text.includes(term))),
        `${query} => ${hitLabels.join(", ")}`,
      ).toBe(true);
    }
  });

  it("does not force clarification for a specific daughter-widow pension query", () => {
    const loadedCount = loadRagChunks(ragPath);
    expect(loadedCount).toBeGreaterThan(0);

    const hits = retrieveChunks("معاش الابنة الأرملة", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(getChunkTitle(hits[0])).not.toMatch(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/);
    expect(shouldPreferDeterministicFamilyPensionReply("معاش الابنة الأرملة", hits)).toBe(true);
    expect(buildClarificationOptions("معاش الابنة الأرملة", hits)).toEqual([]);
  });

  it("prefers general pension-finance chunks over beneficiary-specific family cases for broad pension calculation queries", () => {
    const loadedCount = loadRagChunks(ragPath);
    expect(loadedCount).toBeGreaterThan(0);

    const hits = retrieveChunks("بدي افهم بشكل مختصر كيف بتم احتساب المعاش التقاعدي وشو أهم المراجعات", 5);
    expect(hits.length).toBeGreaterThan(0);

    const topHit = hits[0];
    const topAudienceScope = typeof topHit.metadata?.audience_scope === "string" ? topHit.metadata.audience_scope : "";
    const topTitle = normalizeArabic(getChunkTitle(topHit));
    const topTwoTitles = hits.slice(0, 2).map((hit) => normalizeArabic(getChunkTitle(hit)));

    expect(topAudienceScope).toBe("RET_ALL_FORCES_FINANCE");
    expect(topTitle.includes("حساب المعاش") || topTitle.includes("تخصيص معاش تقاعدي")).toBe(true);
    expect(topTwoTitles.some((title) => title.includes("حساب المعاش") || title.includes("تخصيص معاش تقاعدي"))).toBe(true);
  });

  it("still clarifies broad daughter-pension topics when multiple titles remain", () => {
    const options = buildClarificationOptions("معاش الابنة", [
      { id: "1", text: "شرح عن معاش الابنة الأرملة", chunk_type: "overview", metadata: { title_ar: "معاش الابنة الأرملة" }, score: 18 },
      { id: "2", text: "شرح عن معاش الابنة المطلقة", chunk_type: "overview", metadata: { title_ar: "معاش الابنة المطلقة" }, score: 17 },
      { id: "3", text: "شرح عن معاش الابن الذي يتابع الدراسة", chunk_type: "overview", metadata: { title_ar: "معاش الابن الذي يتابع الدراسة" }, score: 16 },
    ]);

    expect(options).toEqual([
      "معاش الابنة الأرملة",
      "معاش الابنة المطلقة",
      "معاش الابن الذي يتابع الدراسة",
    ]);
    expect(shouldPreferDeterministicFamilyPensionReply("معاش الابنة", [
      { id: "1", text: "شرح عن معاش الابنة الأرملة", chunk_type: "overview", metadata: { title_ar: "معاش الابنة الأرملة" }, score: 18 },
      { id: "2", text: "شرح عن معاش الابنة المطلقة", chunk_type: "overview", metadata: { title_ar: "معاش الابنة المطلقة" }, score: 17 },
      { id: "3", text: "شرح عن معاش الابن الذي يتابع الدراسة", chunk_type: "overview", metadata: { title_ar: "معاش الابن الذي يتابع الدراسة" }, score: 16 },
    ])).toBe(true);
  });

  it("prefers deterministic fallback for family pension queries when the top title is dominant", () => {
    expect(shouldPreferDeterministicFamilyPensionReply("معاش الابنة", [
      { id: "1", text: "شرح عن حق البنت من تقاضي معاش أبيها المتقاعد المتوفى", chunk_type: "overview", metadata: { title_ar: "حق البنت من تقاضي معاش أبيها المتقاعد المتوفى" }, score: 30 },
      { id: "2", text: "خطوات حق البنت من تقاضي معاش أبيها المتقاعد المتوفى", chunk_type: "steps", metadata: { title_ar: "حق البنت من تقاضي معاش أبيها المتقاعد المتوفى" }, score: 24 },
      { id: "3", text: "شرح عن معاش الابنة الأرملة", chunk_type: "overview", metadata: { title_ar: "معاش الابنة الأرملة" }, score: 14 },
    ])).toBe(true);
  });

  it("prefers deterministic fallback for request-style family pension queries with a strong top hit", () => {
    expect(shouldPreferDeterministicFamilyPensionReply("طلب معاش الابن القاصر", [
      { id: "1", text: "شرح عن معاش الابن القاصر", chunk_type: "overview", metadata: { title_ar: "معاش الابن القاصر" }, score: 22 },
      { id: "2", text: "شرح عن معاش الزوجة", chunk_type: "overview", metadata: { title_ar: "معاش الزوجة" }, score: 9 },
    ])).toBe(true);
  });

  it("prefers deterministic fallback for colloquial son-study pension queries", () => {
    expect(shouldPreferDeterministicFamilyPensionReply("ابني يدرس هل بيطلعله معاش", [
      { id: "1", text: "شرح عن معاش الابن الذي يتابع الدراسة", chunk_type: "overview", metadata: { title_ar: "معاش الابن الذي يتابع الدراسة" }, score: 26 },
      { id: "2", text: "خطوات معاش الابن الذي يتابع الدراسة", chunk_type: "steps", metadata: { title_ar: "معاش الابن الذي يتابع الدراسة" }, score: 20 },
    ])).toBe(true);
  });

  it("prefers documents and steps over noisy overview text in deterministic fallback", () => {
    const reply = buildKbFallbackReply([
      {
        id: "overview",
        chunk_type: "overview",
        text: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية\nنص طويل أقل جودة\nالفئة: الخدمات المالية",
        metadata: { title_ar: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية" },
        score: 20,
      },
      {
        id: "documents",
        chunk_type: "documents",
        text: "- مستتندات اعاددة التخصيص الأساسية، المستندات الإضافية للابنة الأرملة",
        metadata: { title_ar: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية" },
        score: 19,
      },
      {
        id: "steps",
        chunk_type: "steps",
        text: "1. جهّز المستندات الأساسية.\n2.. أرفق الطلب بالمستندات المؤيدة.\n3. قدّم المعاملة لدى وزارة المالية.\nالخطوا   ات الإضافية",
        metadata: { title_ar: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية" },
        score: 18,
      },
    ]);

    expect(reply).toContain("المستندات الإضافية للابنة الأرملة");
    expect(reply).toContain("الخطوات الأساسية:");
    expect(reply).toContain("مستندات اعادة التخصيص الأساسية");
    expect(reply).not.toContain("مستتندات");
    expect(reply).not.toContain("اعاددة");
    expect(reply).not.toContain("2..");
    expect(reply).not.toContain("الفئة: الخدمات المالية");
  });

  it("repairs targeted OCR-like artifacts in deterministic pension replies", () => {
    const reply = buildKbFallbackReply([
      {
        id: "overview",
        chunk_type: "overview",
        text: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية\nنص أقل جودة لا نريد تقديمه في الرد النهائي",
        metadata: { title_ar: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية" },
        score: 21,
      },
      {
        id: "documents",
        chunk_type: "documents",
        text: "- أرفق الطللب بالمستندات المؤيدة\n- تُراجع المسستندات قبل االمراجعة النهائية",
        metadata: { title_ar: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية" },
        score: 20,
      },
      {
        id: "steps",
        chunk_type: "steps",
        text: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية\n1. جهّز الممستندات الأأساسية الممذكورة لهذه االمعاملة\n2. قدّم المععامللة لدى ووزارة الماليةة\n3. تابع نتيجة االطلب\n4. إذا نقص شيء إذذا يطلب منك استكماله",
        metadata: { title_ar: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية" },
        score: 19,
      },
    ]);

    expect(reply).toContain("طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية");
    expect(reply).toContain("أرفق الطلب بالمستندات المؤيدة");
    expect(reply).toContain("تُراجع المستندات قبل المراجعة النهائية");
    expect(reply).toContain("جهّز المستندات الأساسية المذكورة لهذه المعاملة");
    expect(reply).toContain("قدّم المعاملة لدى وزارة المالية");
    expect(reply).toContain("تابع نتيجة الطلب");
    expect(reply).not.toContain("الطلبب");
    expect(reply).not.toContain("الطللب");
    expect(reply).not.toContain("الممستندات");
    expect(reply).not.toContain("المسستندات");
    expect(reply).not.toContain("االطلب");
    expect(reply).not.toContain("االمعاملة");
    expect(reply).not.toContain("االمراجعة");
    expect(reply).not.toContain("االأساسية");
    expect(reply).not.toContain("الأأساسية");
    expect(reply).not.toContain("اللأساسية");
    expect(reply).not.toContain("االمذكورة");
    expect(reply).not.toContain("الممذكورة");
    expect(reply).not.toContain("المذكوورة");
    expect(reply).not.toContain("المعامللة");
    expect(reply).not.toContain("المععاملة");
    expect(reply).not.toContain("الممعاملة");
    expect(reply).not.toContain("الماالية");
    expect(reply).not.toContain("الماللية");
    expect(reply).not.toContain("اللمالية");
    expect(reply).not.toContain("الماليةة");
    expect(reply).not.toContain("وززارة");
    expect(reply).not.toContain("وزاررة");
    expect(reply).not.toContain("ووزارة");
    expect(reply).not.toContain("لدى لدى");
    expect(reply).not.toContain("إذذا");
    expect(reply).not.toContain("  ");
  });

  it("does not introduce new artifacts into already clean pension steps", () => {
    const reply = buildKbFallbackReply([
      {
        id: "steps",
        chunk_type: "steps",
        text: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية\n1. جهّز المستندات الأساسية المذكورة لهذه المعاملة قبل المراجعة.\n2. أرفق الطلب بالمستندات المؤيدة وبالنسخ المطلوبة بحسب حالتك.\n3. قدّم المعاملة لدى وزارة المالية.\n4. تابع نتيجة الطلب واستلم المستند أو الإفادة أو القرار الصادر عن المرجع المختص.",
        metadata: { title_ar: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية" },
        score: 19,
      },
    ]);

    expect(reply).toContain("جهّز المستندات الأساسية المذكورة لهذه المعاملة قبل المراجعة");
    expect(reply).toContain("قدّم المعاملة لدى وزارة المالية");
    expect(reply).not.toContain("الممعاملة");
    expect(reply).not.toContain("ووزارة");
    expect(reply).not.toContain("  ");
  });

  it("cleans step-only wife-pension chunks without introducing duplicate letters", () => {
    const reply = buildKbFallbackReply([
      {
        id: "steps",
        chunk_type: "steps",
        text: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية\n1. جهّز المستندات الأأساسية المذكورة لهذه المعاملة قبل المراجعة.\n2. أرفق الطلب بالمستندات المؤيدة وبالنسخ المطلوبة بحسب حالتك.\n3. قدّم المعاملة لدى وزاررة الماليةة.\n4. تابع نتيجة الطلب واستلم المستند أو الإفادة أو القرار الصادر عن المرجع المختص.",
        metadata: { title_ar: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية" },
        score: 19,
      },
    ]);

    expect(reply).toContain("جهّز المستندات الأساسية المذكورة لهذه المعاملة قبل المراجعة");
    expect(reply).toContain("قدّم المعاملة لدى وزارة المالية");
    expect(reply).not.toContain("الممعاملة");
    expect(reply).not.toContain("ووزارة");
    expect(reply).not.toContain("الماليةة");
    expect(reply).not.toContain("  ");
  });

  it("returns a cleaned deterministic wife-pension reply from the chat endpoint", async () => {
    const app = Fastify();
    await app.register(chatRoutes, {
      pluginDb: {} as never,
      fetchChatResponse: async () => ({
        reply: "طلب إعادة تخصيص معاش تقاعدي - مستندات اعادة التخصيص الأساسية\n\nالخطوات الأساسية:\n1. جهّز المستندات الأساسية المذكورة لهذه المعاملة قبل المراجعة.\n2. أرفق الطلب بالمستندات المؤيدة وبالنسخ المطلوبة بحسب حالتك.\n3. قدّم المعاملة لدى وزارة المالية.",
        intents: [],
        debug: { ai: { deterministicFamilyPension: true } },
      }),
      fetchChatResponseLegacy: async () => ({ reply: "", intents: [] }),
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
      classifySmallTalk: () => null,
      logUnrecognizedInput: () => undefined,
      getRandomClarifyResponse: () => "",
      aiFailureCount: { value: 0 },
      lastAiFailure: { value: null },
      getKbStore: () => null,
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "شو مستندات معاش الزوجة", channel: "web", userId: "00000000-0000-4000-8000-000000000175" },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.debug).toMatchObject({
        ai: { deterministicFamilyPension: true },
      });
      expect(body.reply).toContain("جهّز المستندات الأساسية المذكورة لهذه المعاملة قبل المراجعة");
      expect(body.reply).toContain("قدّم المعاملة لدى وزارة المالية");
      expect(body.reply).not.toContain("الأأساسية");
      expect(body.reply).not.toContain("وزاررة");
      expect(body.reply).not.toContain("الماللية");
      expect(body.reply).not.toContain("الممعاملة");
    } finally {
      await app.close();
    }
  }, 30000);

  it("narrows broad shorthand procedure queries to exact procedure options", async () => {
    const app = await getApp();
    const userId = "00000000-0000-4000-8000-000000000176";
    const cases = [
      {
        query: "الابنة على العاتق",
        expectedMenu: [
          "اضافة الابنة المطلقة على العاتق",
          "اضافة الابنة الأرملة الى العاتق",
        ],
        expectedIntents: [
          { label: "إضافة الابنة المطلقة على العاتق", query: "اضافة الابنة المطلقة على العاتق" },
          { label: "إضافة الابنة الأرملة الى العاتق", query: "اضافة الابنة الأرملة الى العاتق" },
        ],
      },
      {
        query: "الوالدين على العاتق",
        expectedMenu: [
          "اجراءات لضمان الوالدين على عاتق العسكري المتقاعد",
          "اجراءات ضمان الوالدين على عاتق العسكري في الخدمة الفعلية",
        ],
        expectedIntents: [
          { label: "إجراءات لضمان الوالدين على عاتق العسكري المتقاعد", query: "اجراءات لضمان الوالدين على عاتق العسكري المتقاعد" },
          { label: "إجراءات ضمان الوالدين على عاتق العسكري في الخدمة الفعلية", query: "اجراءات ضمان الوالدين على عاتق العسكري في الخدمة الفعلية" },
        ],
      },
      {
        query: "الزوجة على العاتق",
        expectedMenu: [
          "اعادة الزوجة الى العاتق بعد ترك العمل",
          "نقل ضمان الزوجة للطبابة فقط الى عاتق الجيش",
        ],
        expectedIntents: [
          { label: "إعادة الزوجة الى العاتق بعد ترك العمل", query: "اعادة الزوجة الى العاتق بعد ترك العمل" },
          { label: "نقل ضمان الزوجة للطبابة فقط الى عاتق الجيش", query: "نقل ضمان الزوجة للطبابة فقط الى عاتق الجيش" },
        ],
      },
      {
        query: "مساعدة مدرسية",
        expectedMenu: [
          "إجراءات لرفع طلب المساعدات المدرسية لمتقاعدي الجيش",
          "نماذج طلبات المساعدات المدرسية في الجيش",
          "طلب نسبة قيمة المساعدات المدرسية",
          "طلب تنازل عن قيمة المساعدات المدرسية",
          "طلب إلغاء التنازل عن المساعدات المدرسية",
        ],
        expectedIntents: [
          { label: "إجراءات لرفع طلب المساعدات المدرسية لمتقاعدي الجيش", query: "إجراءات لرفع طلب المساعدات المدرسية لمتقاعدي الجيش" },
          { label: "نماذج طلبات المساعدات المدرسية في الجيش", query: "نماذج طلبات المساعدات المدرسية في الجيش" },
          { label: "طلب نسبة قيمة المساعدات المدرسية", query: "طلب نسبة قيمة المساعدات المدرسية" },
          { label: "طلب تنازل عن قيمة المساعدات المدرسية", query: "طلب تنازل عن قيمة المساعدات المدرسية" },
          { label: "طلب إلغاء التنازل عن المساعدات المدرسية", query: "طلب إلغاء التنازل عن المساعدات المدرسية" },
        ],
      },
      {
        query: "معاش الابنة",
        expectedMenu: [
          "معاش الابنة العزباء",
          "معاش الابنة العزباء القاصر",
          "معاش الابنة الأرملة",
          "معاش الابنة المطلقة",
        ],
        expectedIntents: [
          { label: "معاش الابنة العزباء", query: "معاش الابنة العزباء" },
          { label: "معاش الابنة العزباء القاصر", query: "معاش الابنة العزباء القاصر" },
          { label: "معاش الابنة الأرملة", query: "معاش الابنة الأرملة" },
          { label: "معاش الابنة المطلقة", query: "معاش الابنة المطلقة" },
        ],
      },
      {
        query: "معاش الابن",
        expectedMenu: [
          "معاش الابن الذي يتابع الدراسة",
          "معاش الابن القاصر",
          "معاش الابن المعوق جسدياً",
          "معاش الابن المعوق نفسياً أو عقلياً",
        ],
        expectedIntents: [
          { label: "معاش الابن الذي يتابع الدراسة", query: "معاش الابن الذي يتابع الدراسة" },
          { label: "معاش الابن القاصر", query: "معاش الابن القاصر" },
          { label: "معاش الابن المعوق جسدياً", query: "معاش الابن المعوق جسدياً" },
          { label: "معاش الابن المعوق نفسياً أو عقلياً", query: "معاش الابن المعوق نفسياً أو عقلياً" },
        ],
      },
      {
        query: "معاش الوالدين",
        expectedMenu: [
          "معاش الوالدة",
          "معاش الوالد",
        ],
        expectedIntents: [
          { label: "معاش الوالدة", query: "معاش الوالدة" },
          { label: "معاش الوالد", query: "معاش الوالد" },
        ],
      },
    ] as const;

    for (const [index, testCase] of cases.entries()) {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: testCase.query, channel: "web", userId, sessionId: `procedure-disambiguation-session-${index}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.reply).toContain("حتى أحدد الإجراء الصحيح بدقة");
      expect(body.menu).toEqual(expect.arrayContaining(testCase.expectedMenu));
      expect(body.intents).toEqual(expect.arrayContaining(
        testCase.expectedIntents.map((intent) => expect.objectContaining({ type: "suggest_query", ...intent })),
      ));
      expect(body.debug).toMatchObject({ procedure_confirmation_clarification: true });
    }
  }, 30000);

  it("prompts confirmation for specific shorthand procedure names and resolves or displays exact matches safely", async () => {
    const app = await getApp();
    const userId = "00000000-0000-4000-8000-000000000177";
    const cases = [
      { query: "الابنة الأرملة على العاتق", procedureId: "PROC-0048", shouldResolve: true },
      { query: "ابن معوق", procedureId: "PROC-0041", shouldResolve: false },
      { query: "الوالدين على العاتق للمتقاعد", procedureId: "PROC-0029", shouldResolve: false },
      { query: "مساعدة مدرسية للمتقاعدين", procedureId: "PROC-0035", shouldResolve: false },
    ] as const;

    for (const [index, testCase] of cases.entries()) {
      const sessionId = `procedure-confirmation-session-${index}`;
      const firstResponse = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: testCase.query, channel: "web", userId, sessionId },
      });

      expect(firstResponse.statusCode).toBe(200);

      const firstBody = firstResponse.json();
      expect(firstBody.reply).toContain("غالباً تقصد إجراء");
      expect(firstBody.intents).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "suggest_query", label: "نعم، هذا المطلوب", query: "نعم" }),
        expect.objectContaining({ type: "suggest_query", label: "لا، شيء آخر", query: "لا" }),
      ]));
      expect(firstBody.debug).toMatchObject({
        procedure_confirmation: true,
      });

      if (!testCase.shouldResolve) continue;

      const secondResponse = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "نعم", channel: "web", userId, sessionId },
      });

      expect(secondResponse.statusCode).toBe(200);

      const secondBody = secondResponse.json();
      expect(secondBody.reply).toContain("هذا هو الإجراء الكامل");
      expect(secondBody.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: expect.stringMatching(/الابنة الأرملة/) }),
      ]));
      expect(secondBody.debug).toMatchObject({
        procedure_confirmation_resolved: true,
      });
    }

    const exactTitleResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "اضافة الابنة المطلقة على العاتق", channel: "web", userId, sessionId: "procedure-exact-title-session" },
    });

    expect(exactTitleResponse.statusCode).toBe(200);

    const exactTitleBody = exactTitleResponse.json();
    expect(exactTitleBody.reply).toContain("هذا هو الإجراء الكامل");
    expect(exactTitleBody.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: expect.stringMatching(/الابنة المطلقة/) }),
    ]));
    expect(exactTitleBody.debug).toMatchObject({ procedure_confirmation_resolved: true });
  }, 30000);

  it("resolves selected pension shortcut options as exact procedure lookups", async () => {
    const app = await getApp();
    const userId = "00000000-0000-4000-8000-000000000178";
    const cases = [
      "معاش الابنة الأرملة",
      "معاش الابن الذي يتابع الدراسة",
      "معاش الوالدة",
    ] as const;

    for (const [index, query] of cases.entries()) {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: query, channel: "web", userId, sessionId: `pension-shortcut-display-session-${index}` },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.debug).toMatchObject({
        procedure_confirmation_resolved: true,
        procedure_auto_expand: true,
      });
      expect(body.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ source: "procedure" }),
      ]));
      expect(body.reply).toContain("نعم، هذا هو الإجراء الكامل الخاص");
    }
  }, 30000);

  it("returns the salary calculator module intent before AI answers salary queries", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "بدي احسب معاشي", channel: "web", userId: "00000000-0000-4000-8000-000000000184" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("حاسبة المعاش");
    expect(body.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "open_module", moduleId: "salary" }),
    ]));
    expect(body.debug).toMatchObject({ salary_module: true });
  }, 30000);

  it("routes broad pension-computation questions to a curated finance answer with a salary calculator CTA", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "مرحبا بدي افهم بشكل مختصر كيف بتم احتساب المعاش التقاعدي وشو أهم المراجعات",
        channel: "web",
        userId: "00000000-0000-4000-8000-000000000184-finance",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("أهلا وسهلا فيك، كيف فيني ساعدك؟");
    expect(body.reply).toContain("احتساب المعاش التقاعدي");
    expect(body.reply).toContain("لجنة التقاعد");
    expect(body.reply).toContain("وزارة المالية");
    expect(body.reply).toContain("حاسبة المعاش");
    expect(body.reply).not.toContain("توقف تقاضي المعاش التقاعدي للابن");
    expect(body.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "open_module", moduleId: "salary" }),
    ]));
    expect(body.debug).toMatchObject({ salary_module: true, broad_pension_finance: true });
  }, 30000);

  it("routes Arabizi salary queries to the salary calculator before AI improvises", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "bde a7seb ma3ashe", channel: "web", userId: "00000000-0000-4000-8000-000000000188" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("حاسبة المعاش");
    expect(body.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "open_module", moduleId: "salary" }),
    ]));
    expect(body.debug).toMatchObject({ salary_module: true });
  }, 30000);

  it("routes exact Arabizi retirement phrases to the salary calculator", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "ma3ash ta2aod", channel: "web", userId: "00000000-0000-4000-8000-000000000190" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("حاسبة المعاش");
    expect(body.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "open_module", moduleId: "salary" }),
    ]));
    expect(body.debug).toMatchObject({ salary_module: true });
  }, 30000);

  it("routes official salary attestation phrasing to the Ministry of Finance source before KB fallback", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "أحتاج إفادة راتب رسمية", channel: "web", userId: "00000000-0000-4000-8000-000000000191" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("إفادة الراتب الرسمية أصبحت متاحة فقط عبر خدمة وزارة المالية الرسمية");
    expect(body.reply).toContain("رقم التقاعد");
    expect(body.reply).not.toContain("الطبابة");
    expect(body.reply).not.toContain("نقابة الأطباء");
    expect(body.ctas).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "salary-attestation-official",
        label: "📄 إفادة الراتب الرسمية",
        type: "share",
        payload: expect.objectContaining({ url: "https://eservices.finance.gov.lb/RetiredInfo.aspx" }),
      }),
    ]));
    expect(body.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "open_url", label: "📄 إفادة الراتب الرسمية", url: "https://eservices.finance.gov.lb/RetiredInfo.aspx" }),
      expect.objectContaining({ type: "open_module", moduleId: "salary" }),
    ]));
    expect(body.debug).toMatchObject({ salary_module: true, salary_attestation: true, external_only: true });
  }, 30000);

  it("routes exact Arabizi school grant phrases to school-specific clarification options", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "man7a madrasiyye", channel: "web", userId: "00000000-0000-4000-8000-000000000191" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("حتى أحدد الإجراء الصحيح بدقة");
    expect(body.menu).toEqual(expect.arrayContaining([
      "إجراءات لرفع طلب المساعدات المدرسية لمتقاعدي الجيش",
      "نماذج طلبات المساعدات المدرسية في الجيش",
      "طلب نسبة قيمة المساعدات المدرسية",
    ]));
    expect(body.menu).not.toContain("معاملات على العاتق");
  }, 30000);

  it("keeps context for recruitment follow-ups so short detail questions stay anchored to the active announcement", async () => {
    createRecruitmentAnnouncement({
      title: "مباراة تطويع رتباء متطوعين",
      apparatusName: "الجيش اللبناني",
      status: "published",
      announcementNumber: "2026/12",
      startDate: "2026-06-10T08:00:00.000Z",
      endDate: "2026-12-10T14:00:00.000Z",
      conditions: ["لبناني", "عمره بين 18 و25 سنة"],
      requiredDocuments: ["إخراج قيد فردي", "صورة عن الهوية"],
      eligibleCategories: ["مدنيون", "عسكريون سابقون"],
      applicationLocation: "وزارة الدفاع الوطني",
      applicationMethod: "حضورياً",
      sourceName: "قيادة الجيش",
      sourceUrl: "https://example.test/recruitment",
      notes: "يُعتمد الإعلان الرسمي فقط.",
    }, "test-admin");

    const app = await getApp();
    const userId = "00000000-0000-4000-8000-000000000185";
    const sessionId = "recruitment-followup-session";

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "هل يوجد تطويع بالجيش؟", channel: "web", userId, sessionId },
    });

    expect(firstResponse.statusCode).toBe(200);

    const firstBody = firstResponse.json();
    expect(firstBody.reply).toContain("هذه التعاميم الرسمية المنشورة حالياً");
    expect(firstBody.reply).toContain("الجيش اللبناني");
    expect(firstBody.debug).toMatchObject({ recruitment: true, recruitment_kind: "announcement" });

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "وما هي ؟", channel: "web", userId, sessionId },
    });

    expect(secondResponse.statusCode).toBe(200);

    const secondBody = secondResponse.json();
    expect(secondBody.reply).toContain("هذه التفاصيل المتوفرة عن إعلان التطويع الحالي");
    expect(secondBody.reply).toContain(": لبناني، عمره بين 18 و25 سنة");
    expect(secondBody.reply).toContain("المستندات المطلوبة: إخراج قيد فردي، صورة عن الهوية");
    expect(secondBody.debug).toMatchObject({ recruitment: true, recruitment_kind: "recruitment" });
  }, 30000);

  it("keeps context for Arabizi follow-ups so short location questions stay anchored to the active announcement", async () => {
    createRecruitmentAnnouncement({
      title: "مباراة تطويع ضباط اختصاص",
      apparatusName: "الجيش اللبناني",
      status: "published",
      announcementNumber: "2026/13",
      startDate: "2026-06-11T08:00:00.000Z",
      endDate: "2026-12-12T14:00:00.000Z",
      conditions: ["لبناني", "يحمل شهادة جامعية"],
      requiredDocuments: ["صورة عن الهوية", "إفادة جامعية"],
      eligibleCategories: ["مدنيون"],
      applicationLocation: "وزارة الدفاع الوطني",
      applicationMethod: "حضورياً",
      sourceName: "قيادة الجيش",
      sourceUrl: "https://example.test/recruitment-officers",
      notes: "يُعتمد الإعلان الرسمي فقط.",
    }, "test-admin");

    const app = await getApp();
    const userId = "00000000-0000-4000-8000-000000000189";
    const sessionId = "recruitment-followup-arabizi-session";

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "هل يوجد تطويع بالجيش؟", channel: "web", userId, sessionId },
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json().debug).toMatchObject({ recruitment: true, recruitment_kind: "announcement" });

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "wen taqdim", channel: "web", userId, sessionId },
    });

    expect(secondResponse.statusCode).toBe(200);

    const secondBody = secondResponse.json();
    expect(secondBody.reply).toContain("هذه التفاصيل المتوفرة عن إعلان التطويع الحالي");
    expect(secondBody.reply).toContain("مكان التقديم: وزارة الدفاع الوطني");
    expect(secondBody.debug).toMatchObject({ recruitment: true, recruitment_kind: "recruitment" });
  }, 30000);

  it("routes exact Arabizi recruitment phrases to the active army announcement", async () => {
    createRecruitmentAnnouncement({
      title: "مباراة تطويع رتباء متطوعين",
      apparatusName: "الجيش اللبناني",
      status: "published",
      announcementNumber: "2026/14",
      startDate: "2026-06-12T08:00:00.000Z",
      endDate: "2026-12-15T14:00:00.000Z",
      conditions: ["لبناني"],
      requiredDocuments: ["إخراج قيد فردي"],
      eligibleCategories: ["مدنيون"],
      applicationLocation: "وزارة الدفاع الوطني",
      applicationMethod: "حضورياً",
      sourceName: "قيادة الجيش",
      sourceUrl: "https://example.test/recruitment-sergeants",
      notes: "يُعتمد الإعلان الرسمي فقط.",
    }, "test-admin");

    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "tatwi3 bel jesh", channel: "web", userId: "00000000-0000-4000-8000-000000000192" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("هذه التعاميم الرسمية المنشورة حالياً");
    expect(body.reply).toContain("الجيش اللبناني");
    expect(body.debug).toMatchObject({ recruitment: true, recruitment_kind: "announcement" });
  }, 30000);

  it("routes phone-style Arabizi hospital queries to the existing directory contacts", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "ra2em mostashfa", channel: "web", userId: "00000000-0000-4000-8000-000000000193" },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.reply).toContain("هذه أرقام الاتصال الأقرب لطلبك");
    expect(body.reply).toContain("المستشفى العسكري");
    expect(body.reply).toContain("01-820000");
    expect(body.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "call_phone", phone: "01-820000" }),
    ]));
    expect(body.debug).toMatchObject({ directory_lookup: true });
  }, 30000);

  it("asks whether the user means the same topic or a new one after selecting the explicit other option", async () => {
    const app = await getApp();
    const userId = "00000000-0000-4000-8000-000000000186";
    const sessionId = "topic-scope-clarification-session";

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "مدارس", channel: "web", userId, sessionId },
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json().menu.at(-1)).toBe("شيء آخر غير مذكور");

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "شيء آخر غير مذكور", channel: "web", userId, sessionId },
    });

    expect(secondResponse.statusCode).toBe(200);

    const secondBody = secondResponse.json();
    expect(secondBody.reply).toBe("هل تقصد نفس الموضوع أو موضوع جديد؟");
    expect(secondBody.clarifying_question).toBe("هل تقصد نفس الموضوع أو موضوع جديد؟");
    expect(secondBody.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "suggest_query", query: "نفس الموضوع" }),
      expect.objectContaining({ type: "suggest_query", query: "موضوع جديد" }),
    ]));
    expect(secondBody.debug).toMatchObject({ awaiting_topic_decision: true });
  }, 30000);

  it("includes sources in stream meta for precomputed short-query responses", async () => {
    const app = Fastify();
    await app.register(chatRoutes, {
      pluginDb: {} as never,
      fetchChatResponse: async () => ({
        reply: "نعم، هذا هو الإجراء الكامل الخاص بك.",
        intents: [],
        sources: [{ id: "PROC-TEST", title: "إجراء تجريبي", text: "ملخص", source: "procedure" }],
        debug: { procedure_confirmation_resolved: true },
      }),
      fetchChatResponseLegacy: async () => ({ reply: "", intents: [] }),
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
      classifySmallTalk: () => null,
      logUnrecognizedInput: () => undefined,
      getRandomClarifyResponse: () => "",
      aiFailureCount: { value: 0 },
      lastAiFailure: { value: null },
      getKbStore: () => null,
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat/stream",
        payload: { message: "نعم", channel: "web", userId: "00000000-0000-4000-8000-000000000177", sessionId: "stream-procedure-session" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('"sources":[{"id":"PROC-TEST"');
    } finally {
      await app.close();
    }
  }, 30000);

  it("reuses the deterministic resolver for salary module responses on the stream endpoint", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { message: "احسب معاشي", channel: "web", userId: "00000000-0000-4000-8000-000000000187" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("فتح حاسبة المعاش");
    expect(response.body).toContain('"type":"open_module"');
    expect(response.body).toContain('"moduleId":"salary"');
  }, 30000);

  it("reuses the deterministic salary attestation resolver on the stream endpoint", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { message: "أحتاج إفادة راتب رسمية", channel: "web", userId: "00000000-0000-4000-8000-000000000192" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("إفادة الراتب الرسمية أصبحت متاحة فقط عبر خدمة وزارة المالية الرسمية");
    expect(response.body).toContain('"salary_attestation":true');
    expect(response.body).toContain('"url":"https://eservices.finance.gov.lb/RetiredInfo.aspx"');
    expect(response.body).not.toContain("نقابة الأطباء");
  }, 30000);
});

