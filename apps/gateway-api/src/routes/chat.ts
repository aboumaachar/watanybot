/**
 * Chat routes — POST /api/chat and POST /api/chat/stream (SSE).
 * Extracted from server.ts.
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ChatRequest, ChatResponse } from "@watany/types";
import { randomUUID, createHash } from "node:crypto";
import type { PluginDb } from "../types/domain";
import { filterContent, sanitizeInput } from "../filters/content-filter.js";
import { moderate } from "../filters/moderation.js";
import { broadcastToAdmins } from "../ws/admin-ws.js";
import { createWSEvent } from "../ws/events.js";
import { persistChatExchange } from "../lib/chat-persist.js";
import { finalizeWatanyAgentAnswer, prepareWatanyAgentInput } from "../services/watany-ai-agent-bridge.js";
import type { AiMessage, AiChatProvider, KbChunk } from "../ai/types";
import type { KbSearchResult } from "../kb/kb-nodes";
import { findActiveAnswerOverride } from "../lib/admin-answer-overrides.js";
import { assessChatGrounding } from "../lib/chat-grounding.js";

interface ChatRoutesOptions {
  pluginDb: PluginDb;
  fetchChatResponse: (body: ChatRequest) => Promise<ChatResponse>;
  fetchChatResponseLegacy: (body: ChatRequest) => Promise<ChatResponse>;
  resolveDeterministicChatResponse: (body: ChatRequest) => Promise<{ response: ChatResponse | null; timings: Record<string, unknown>; preserveOriginalQuestion?: string }>;
  // AI streaming
  useAi: boolean;
  getAiChat: () => AiChatProvider | null;
  getAiProvider: () => string;
  getAiModel: () => string;
  aiRagTopK: number;
  aiSystemPrompt: string;
  aiConversationHistory: Map<string, AiMessage[]>;
  retrieveChunks: (query: string, topK: number, scopeHints?: string[]) => KbChunk[];
  buildAiMessages: (query: string, chunks: KbChunk[], history: AiMessage[], systemPrompt?: string) => AiMessage[];
  extractIntents: (text: string) => { intents: unknown[]; clarifyingQuestion?: string | null };
  evaluateRelevance: (query: string, topK: number) => { confidence: string; topScore?: number };
  getRagChunkCount: () => number;
  isKbNodesReady: () => boolean;
  searchKbNodes: (query: string, intent?: string | null, limit?: number) => KbSearchResult;
  classifySmallTalk: (text: string) => { name: string; response: string } | null;
  logUnrecognizedInput: (e: { ts: string; message: string; userId: string; channel: string; reason: string }) => void;
  getRandomClarifyResponse: () => string;
  logChatInput?: (entry: { ts: string; message: string; normalized: string; userId: string; channel: string; module?: string; confidence?: number; unanswered?: boolean }) => void;
  logAbusiveChatEvent?: (entry: { ts: string; userId: string; channel: string; message: string; reason: string; severity: "low" | "medium" | "high" }) => void;
  aiFailureCount: { value: number };
  lastAiFailure: { value: { at: number; route: string; message: string } | null };
  getKbStore: () => { stats: () => Promise<unknown> } | null;
}

type ChatFeedbackBody = {
  answerId?: string;
  comment?: string;
  feedback?: string;
  id?: string;
  messageId?: string;
  rating?: string;
  value?: "useful" | "not_useful";
  note?: string;
  userId?: string;
};

type ParsedChatFeedback = {
  messageId: string;
  value: ChatFeedbackBody["value"];
  note: string;
  userId: string;
};

function getLegacyClarifyingQuestion(debug: ChatResponse["debug"]): unknown {
  if (!debug || typeof debug !== "object" || !("legacy" in debug)) {
    return null;
  }

  const legacy = debug.legacy;
  if (!legacy || typeof legacy !== "object" || !("clarifying_question" in legacy)) {
    return null;
  }

  return legacy.clarifying_question;
}

function shouldUsePrecomputedResponse(message: string): boolean {
  const trimmed = String(message || "").trim();
  if (!trimmed) return false;

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  return words <= 4;
}

const STREAM_CHUNK_SIZE = 24;

type SendEvent = (event: string, data: unknown) => void;
type PersistChatExchangeInput = Parameters<typeof persistChatExchange>[0];

interface StreamIdentity {
  userId: string;
  channel: string;
}

interface AiStreamSuccessContext {
  body: ChatRequest;
  userId: string;
  sendEvent: SendEvent;
  shouldPersistChats: boolean;
}

interface StreamGreetingState {
  greetingAr: string;
  preamble: string;
  preambleSent: boolean;
  suppressLeadingGreeting: boolean;
  bufferedLeadingText: string;
}

function getChatChannel(body: ChatRequest): string {
  return body.channel || "web";
}

function getChatUserId(body: ChatRequest, req: { user?: { id?: string } }): string {
  return body.userId || req.user?.id || "anonymous";
}

function isVoiceModeRequest(body: ChatRequest): body is ChatRequest & { voiceMode: unknown } {
  return Boolean((body as unknown as { voiceMode?: unknown }).voiceMode);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStreamGreetingState(agentInput: ReturnType<typeof prepareWatanyAgentInput>): StreamGreetingState {
  const greetingAr = agentInput.behavior.shouldStartWithGreeting ? agentInput.behavior.greetingAr : "";
  return {
    greetingAr,
    preamble: greetingAr ? `${greetingAr}\n\n` : "",
    preambleSent: false,
    suppressLeadingGreeting: false,
    bufferedLeadingText: "",
  };
}

function sendStreamGreetingPreamble(state: StreamGreetingState, sendEvent: SendEvent): void {
  if (!state.preamble || state.preambleSent) return;
  sendEvent("delta", { delta: state.preamble });
  state.preambleSent = true;
}

function stripLeadingGreeting(text: string, greetingAr: string): string {
  if (!greetingAr) return text;
  const trimmedStart = text.trimStart();
  if (!trimmedStart.startsWith(greetingAr)) return text;
  return trimmedStart.slice(greetingAr.length).replace(/^\s+/, "");
}

function resetStreamGreetingSuppression(state: StreamGreetingState): void {
  state.suppressLeadingGreeting = state.preambleSent && Boolean(state.greetingAr);
  state.bufferedLeadingText = "";
}

function normalizeStreamDelta(delta: string, state: StreamGreetingState): string {
  if (!state.suppressLeadingGreeting) return delta;

  state.bufferedLeadingText += delta;
  const trimmedLeading = state.bufferedLeadingText.replace(/^\s+/, "");
  if (!trimmedLeading) return "";

  if (state.greetingAr.startsWith(trimmedLeading)) {
    return "";
  }

  if (trimmedLeading.startsWith(state.greetingAr)) {
    state.suppressLeadingGreeting = false;
    state.bufferedLeadingText = "";
    return trimmedLeading.slice(state.greetingAr.length).replace(/^\s+/, "");
  }

  state.suppressLeadingGreeting = false;
  const flushed = state.bufferedLeadingText;
  state.bufferedLeadingText = "";
  return flushed;
}

function buildDisplayedStreamReply(finalReply: string, state: StreamGreetingState): string {
  if (!state.preambleSent) return finalReply;
  return stripLeadingGreeting(finalReply, state.greetingAr);
}

async function streamReplyChunks(replyText: string, sendEvent: SendEvent, isClosed: () => boolean): Promise<void> {
  for (let i = 0; i < replyText.length; i += STREAM_CHUNK_SIZE) {
    if (isClosed()) break;
    sendEvent("delta", { delta: replyText.slice(i, i + STREAM_CHUNK_SIZE) });
    await delay(10);
  }
}

function buildStreamMeta(response: ChatResponse, replyText: string, debugOverride?: Record<string, unknown>) {
  return {
    reply: replyText,
    intents: response.intents || [],
    ctas: response.ctas || [],
    routeDecision: response.routeDecision || null,
    context: response.context || null,
    mode: response.mode || null,
    module: response.module || null,
    clarifying_question: response.clarifying_question || getLegacyClarifyingQuestion(response.debug) || null,
    sources: response.sources || [],
    debug: response.debug || debugOverride || null,
  };
}

async function sendStreamedChatResponse(
  response: ChatResponse,
  sendEvent: SendEvent,
  isClosed: () => boolean,
  debugOverride?: Record<string, unknown>,
): Promise<string> {
  const replyText = typeof response.reply === "string" ? response.reply : "";
  await streamReplyChunks(replyText, sendEvent, isClosed);
  sendEvent("meta", buildStreamMeta(response, replyText, debugOverride));
  sendEvent("done", { ok: true });
  return replyText;
}

function persistStreamExchangeIfEnabled(
  shouldPersistChats: boolean,
  app: FastifyInstance,
  entry: PersistChatExchangeInput,
  errorMessage: string,
): void {
  if (!shouldPersistChats) return;

  persistChatExchange(entry).catch((err) => app.log.warn({ err }, errorMessage));
}

async function handlePrecomputedStream(
  app: FastifyInstance,
  opts: ChatRoutesOptions,
  body: ChatRequest,
  userId: string,
  sendEvent: SendEvent,
  isClosed: () => boolean,
  shouldPersistChats: boolean,
): Promise<boolean> {
  if (!shouldUsePrecomputedResponse(body.message)) return false;

  const normalized = await opts.fetchChatResponse(body);
  const replyText = await sendStreamedChatResponse(normalized, sendEvent, isClosed);
  persistStreamExchangeIfEnabled(
    shouldPersistChats,
    app,
    {
      userId,
      channel: getChatChannel(body),
      userMessage: body.message,
      botReply: replyText,
      intents: normalized.intents,
      metadata: normalized.debug,
    },
    "chat_precomputed_stream_persist_failed",
  );
  return true;
}

async function handleChitchatStream(
  app: FastifyInstance,
  opts: ChatRoutesOptions,
  body: ChatRequest,
  sendEvent: SendEvent,
  isClosed: () => boolean,
): Promise<boolean> {
  const chitchat = opts.classifySmallTalk(body.message);
  if (!chitchat) return false;

  app.log.info({ intent: chitchat.name }, "stream_chitchat_fast_path");
  const normalized = await opts.fetchChatResponse(body);
  await sendStreamedChatResponse(normalized, sendEvent, isClosed, { chitchat: chitchat.name });
  return true;
}

async function handleDeterministicStream(
  app: FastifyInstance,
  opts: ChatRoutesOptions,
  body: ChatRequest,
  userId: string,
  sendEvent: SendEvent,
  isClosed: () => boolean,
  shouldPersistChats: boolean,
): Promise<boolean> {
  const deterministic = await opts.resolveDeterministicChatResponse(body);
  if (!deterministic.response) return false;

  const replyText = await sendStreamedChatResponse(deterministic.response, sendEvent, isClosed);
  persistStreamExchangeIfEnabled(
    shouldPersistChats,
    app,
    {
      userId,
      channel: getChatChannel(body),
      userMessage: body.message,
      botReply: replyText,
      intents: deterministic.response.intents,
      metadata: deterministic.response.debug,
    },
    "chat_deterministic_stream_persist_failed",
  );
  return true;
}

async function sendKbPrefetchReady(
  app: FastifyInstance,
  opts: ChatRoutesOptions,
  body: ChatRequest,
  sendEvent: SendEvent,
): Promise<void> {
  const aiChat = opts.getAiChat();
  if (!(opts.useAi && aiChat)) return;

  try {
    const agentInput = prepareWatanyAgentInput(body.message);
    const kbChunks = opts.retrieveChunks(body.message, opts.aiRagTopK, agentInput.kbScopes);
    sendEvent("kb_ready", { chunks: kbChunks.length, hasAnswer: false, answerConfidence: 0 });
  } catch (kbPrefetchErr) {
    app.log.warn({ err: kbPrefetchErr }, "Stream: KB prefetch failed");
    sendEvent("kb_ready", { chunks: 0, hasAnswer: false, answerConfidence: 0 });
  }
}

function appendAgentSystemInstruction(messages: AiMessage[], systemInstruction: string): void {
  const trimmedInstruction = systemInstruction.trim();
  if (!trimmedInstruction) return;

  const systemMessage = messages.find((message) => message.role === "system");
  if (systemMessage) {
    systemMessage.content = `${systemMessage.content}\n\n${trimmedInstruction}`;
    return;
  }

  messages.unshift({ role: "system", content: trimmedInstruction });
}

function injectKbNodesIntoMessages(opts: ChatRoutesOptions, body: ChatRequest, messages: AiMessage[], sendEvent: SendEvent): void {
  if (!opts.isKbNodesReady()) return;

  const streamKbNodes = opts.searchKbNodes(body.message);
  if (streamKbNodes.nodes.length === 0) return;

  const kbNodesTopK = Math.max(1, Number(process.env.AI_KB_NODES_TOP_K || "2"));
  const kbNodeSummaryMaxChars = Math.max(120, Number(process.env.AI_KB_NODE_SUMMARY_MAX_CHARS || "180"));
  const topNodes = streamKbNodes.nodes.slice(0, kbNodesTopK);
  const nodesCtx = topNodes.map((node, index) => {
    const summary = node.summary_lb.length > kbNodeSummaryMaxChars
      ? `${node.summary_lb.slice(0, kbNodeSummaryMaxChars)}...`
      : node.summary_lb;
    return `${index + 1}. [${node.type}] ${node.title}\n   ${summary}`;
  }).join("\n");

  messages.splice(Math.max(messages.length - 1, 1), 0, {
    role: "system",
    content: `[نتائج قاعدة المعرفة المحلية — ${streamKbNodes.confidence} confidence, ${streamKbNodes.total} hits]:\n${nodesCtx}\n\nاستعمل هالمعلومات كمرجع أساسي بإجابتك.`,
  });
  sendEvent("kb_nodes", { hits: streamKbNodes.total, confidence: streamKbNodes.confidence, intent: streamKbNodes.intent });
}

function prepareAiStreamRequest(
  opts: ChatRoutesOptions,
  body: ChatRequest,
  userId: string,
  sendEvent: SendEvent,
) {
  const agentInput = prepareWatanyAgentInput(body.message);
  const streamGreeting = createStreamGreetingState(agentInput);
  const kbChunks = opts.retrieveChunks(body.message, opts.aiRagTopK, agentInput.kbScopes);
  const history = opts.aiConversationHistory.get(userId) || [];
  const messages = opts.buildAiMessages(body.message, kbChunks, history, opts.aiSystemPrompt || undefined);
  appendAgentSystemInstruction(messages, agentInput.agentSystemInstruction);
  injectKbNodesIntoMessages(opts, body, messages, sendEvent);
  return { kbChunks, history, messages, agentInput, streamGreeting };
}

async function tryAiStreamWithRetry(
  app: FastifyInstance,
  opts: ChatRoutesOptions,
  aiChat: AiChatProvider,
  messages: AiMessage[],
  sendEvent: SendEvent,
  isClosed: () => boolean,
  identity: StreamIdentity,
  streamGreeting: StreamGreetingState,
): Promise<{ fullReply: string | null; errorMessage: string | null }> {
  const maxStreamAttempts = Number(process.env.AI_STREAM_RETRY_COUNT || "2");
  sendStreamGreetingPreamble(streamGreeting, sendEvent);

  for (let attempt = 0; attempt <= maxStreamAttempts; attempt++) {
    try {
      resetStreamGreetingSuppression(streamGreeting);
      const fullReply = await aiChat.stream(messages, (ev) => {
        if (isClosed()) return;
        if (ev.type === "delta") {
          const normalizedDelta = normalizeStreamDelta(ev.delta, streamGreeting);
          if (normalizedDelta) {
            sendEvent("delta", { delta: normalizedDelta });
          }
        }
      });
      return { fullReply, errorMessage: null };
    } catch (err) {
      const streamErrMsg = err instanceof Error ? err.message : String(err);
      app.log.warn({
        err,
        streamErrMsg,
        userId: identity.userId,
        channel: identity.channel,
        attempt: attempt + 1,
        maxStreamAttempts,
        provider: opts.getAiProvider(),
        model: opts.getAiModel(),
      }, "ai_stream_attempt_failed");

      sendEvent("error", { message: "ai_stream_attempt_failed", attempt: attempt + 1, detail: streamErrMsg });
      if (attempt < maxStreamAttempts) {
        await delay(200 * (attempt + 1));
        continue;
      }

      opts.aiFailureCount.value++;
      opts.lastAiFailure.value = { at: Date.now(), route: "stream", message: streamErrMsg };
      app.log.warn({ err, provider: opts.getAiProvider(), model: opts.getAiModel() }, "AI stream failed, falling back to legacy simulated stream");
      sendEvent("error", { message: "provider_fallback", detail: streamErrMsg });
      return { fullReply: null, errorMessage: streamErrMsg };
    }
  }

  return { fullReply: null, errorMessage: "AI stream failed" };
}

async function handleAiStreamFailureFallback(
  opts: ChatRoutesOptions,
  body: ChatRequest,
  kbChunks: KbChunk[],
  agentInput: ReturnType<typeof prepareWatanyAgentInput>,
  streamGreeting: StreamGreetingState,
  sendEvent: SendEvent,
  isClosed: () => boolean,
  streamErrMsg: string,
): Promise<void> {
  if (kbChunks.length > 0) {
    const ragReply = kbChunks
      .map((chunk) => chunk.text.length > 600 ? `${chunk.text.slice(0, 600)}…` : chunk.text)
      .join("\n\n---\n\n");
    const finalReply = finalizeWatanyAgentAnswer(body.message, ragReply);
    await streamReplyChunks(buildDisplayedStreamReply(finalReply, streamGreeting), sendEvent, isClosed);
    sendEvent("meta", { reply: finalReply, intents: [], debug: { ragOnlyFallback: true, chunks: kbChunks.length, aiError: streamErrMsg, agent: { tagIds: agentInput.tags.map((tag) => tag.tagId), kbScopes: agentInput.kbScopes, greetingRequired: agentInput.behavior.shouldStartWithGreeting, tone: agentInput.behavior.tone } } });
    sendEvent("done", { ok: true });
    return;
  }

  const normalized = await opts.fetchChatResponseLegacy(body);
  const finalReply = finalizeWatanyAgentAnswer(body.message, normalized.reply || "");
  await streamReplyChunks(buildDisplayedStreamReply(finalReply, streamGreeting), sendEvent, isClosed);
  sendEvent("meta", buildStreamMeta({ ...normalized, reply: finalReply }, finalReply));
  sendEvent("done", { ok: true });
}

function updateAiConversationHistory(
  conversationHistory: Map<string, AiMessage[]>,
  userId: string,
  history: AiMessage[],
  bodyMessage: string,
  fullReply: string,
): void {
  history.push(
    { role: "user", content: bodyMessage },
    { role: "assistant", content: fullReply },
  );
  if (history.length > 12) history.splice(0, history.length - 12);
  conversationHistory.set(userId, history);
}

async function finalizeAiStreamSuccess(
  app: FastifyInstance,
  opts: ChatRoutesOptions,
  fullReply: string,
  kbChunks: KbChunk[],
  history: AiMessage[],
  agentInput: ReturnType<typeof prepareWatanyAgentInput>,
  context: AiStreamSuccessContext,
): Promise<void> {
  const finalReply = finalizeWatanyAgentAnswer(context.body.message, fullReply);
  const { intents, clarifyingQuestion } = opts.extractIntents(finalReply);
  updateAiConversationHistory(opts.aiConversationHistory, context.userId, history, context.body.message, finalReply);

  const debug: Record<string, unknown> = {
    ai: { provider: opts.getAiProvider(), model: opts.getAiModel(), ragChunks: kbChunks.length, ragTotal: opts.getRagChunkCount() },
    agent: {
      tagIds: agentInput.tags.map((tag) => tag.tagId),
      kbScopes: agentInput.kbScopes,
      greetingRequired: agentInput.behavior.shouldStartWithGreeting,
      tone: agentInput.behavior.tone,
    },
  };
  if (clarifyingQuestion) debug.legacy = { clarifying_question: clarifyingQuestion };
  const kbStore = opts.getKbStore();
  if (kbStore) debug.kb = await kbStore.stats();

  context.sendEvent("meta", { reply: finalReply, intents, clarifying_question: clarifyingQuestion || null, debug });
  context.sendEvent("done", { ok: true });

  persistStreamExchangeIfEnabled(
    context.shouldPersistChats,
    app,
    {
      userId: context.userId,
      channel: getChatChannel(context.body),
      userMessage: context.body.message,
      botReply: finalReply,
      intents,
      metadata: debug,
    },
    "chat_stream_persist_failed",
  );
}

async function handleAiStream(
  app: FastifyInstance,
  opts: ChatRoutesOptions,
  body: ChatRequest,
  userId: string,
  sendEvent: SendEvent,
  isClosed: () => boolean,
  shouldPersistChats: boolean,
): Promise<boolean> {
  const aiChat = opts.getAiChat();
  if (!(opts.useAi && aiChat)) return false;

  const { kbChunks, history, messages, agentInput, streamGreeting } = prepareAiStreamRequest(opts, body, userId, sendEvent);
  const { fullReply, errorMessage } = await tryAiStreamWithRetry(
    app,
    opts,
    aiChat,
    messages,
    sendEvent,
    isClosed,
    { userId, channel: getChatChannel(body) },
    streamGreeting,
  );

  if (fullReply == null) {
    await handleAiStreamFailureFallback(opts, body, kbChunks, agentInput, streamGreeting, sendEvent, isClosed, errorMessage || "AI stream failed");
    return true;
  }

  await finalizeAiStreamSuccess(app, opts, fullReply, kbChunks, history, agentInput, {
    body,
    userId,
    sendEvent,
    shouldPersistChats,
  });
  return true;
}

async function handleLegacyStream(
  app: FastifyInstance,
  opts: ChatRoutesOptions,
  body: ChatRequest,
  userId: string,
  sendEvent: SendEvent,
  isClosed: () => boolean,
  shouldPersistChats: boolean,
): Promise<void> {
  const normalized = await opts.fetchChatResponse(body);
  const replyText = await sendStreamedChatResponse(normalized, sendEvent, isClosed);
  persistStreamExchangeIfEnabled(
    shouldPersistChats,
    app,
    {
      userId,
      channel: getChatChannel(body),
      userMessage: body.message,
      botReply: replyText,
      intents: normalized.intents,
      metadata: normalized.debug,
    },
    "chat_legacy_stream_persist_failed",
  );
}

function isFeedbackReadinessProbe(messageId: string, value: unknown, note: string): boolean {
  return !messageId && value === undefined && !note;
}

function normalizeFeedbackValue(body: ChatFeedbackBody | undefined): ChatFeedbackBody["value"] {
  if (body?.value === "useful" || body?.value === "not_useful") return body.value;

  const rating = typeof body?.rating === "string" ? body.rating.trim().toLowerCase() : "";
  if (["positive", "useful", "up", "like"].includes(rating)) return "useful";
  if (["negative", "not_useful", "down", "dislike"].includes(rating)) return "not_useful";
  return undefined;
}

function firstTrimmedText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseChatFeedbackBody(body: ChatFeedbackBody | undefined): ParsedChatFeedback {
  const userId = typeof body?.userId === "string" && body.userId.trim().length > 0
    ? body.userId.trim()
    : "anonymous";

  return {
    messageId: firstTrimmedText(body?.messageId, body?.answerId, body?.id),
    value: normalizeFeedbackValue(body),
    note: firstTrimmedText(body?.note, body?.comment, body?.feedback),
    userId,
  };
}

function persistChatFeedbackEvent(app: FastifyInstance, pluginDb: PluginDb, feedback: ParsedChatFeedback): void {
  try {
    const textHash = createHash("sha256").update(`${feedback.messageId}:${feedback.value}`).digest("hex");
    const eventText = JSON.stringify({ messageId: feedback.messageId, value: feedback.value, note: feedback.note || null });
    pluginDb.prepare(
      `INSERT INTO analytics_events (id, user_id, event_type, intent, text_hash, event_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), feedback.userId, "chat_feedback", feedback.value, textHash, eventText, Date.now());
  } catch (err) {
    app.log.warn({ err }, "chat_feedback_analytics_failed");
  }
}

async function handleChatFeedback(
  app: FastifyInstance,
  pluginDb: PluginDb,
  req: FastifyRequest<{ Body: ChatFeedbackBody }>,
  reply: FastifyReply,
) {
  const feedback = parseChatFeedbackBody(req.body);

  if (isFeedbackReadinessProbe(feedback.messageId, feedback.value, feedback.note)) {
    reply.code(202);
    return { ok: true, accepted: true, endpoint: "/api/chat/feedback", status: "ready" } as const;
  }

  if (!feedback.messageId || (feedback.value !== "useful" && feedback.value !== "not_useful")) {
    reply.code(400);
    return { ok: false, error: "Invalid feedback payload" } as const;
  }

  persistChatFeedbackEvent(app, pluginDb, feedback);
  return { ok: true } as const;
}

export const chatRoutes: FastifyPluginAsync<ChatRoutesOptions> = async (app, opts) => {
  const shouldPersistChats = process.env.DISABLE_CHAT_PERSIST?.toLowerCase() !== "true";

  /* ── POST /api/chat/feedback ────────────────────────────────── */
  app.post<{ Body: ChatFeedbackBody }>(
    "/api/chat/feedback",
    (req, reply) => handleChatFeedback(app, opts.pluginDb, req, reply),
  );

  /* ── POST /api/chat ─────────────────────────────────────────── */
  app.post<{ Body: ChatRequest }>("/api/chat", async (req, reply) => {
    const body = req.body;
    if (!body?.message) {
      reply.code(400);
      return { error: "message required" } as const;
    }

    const userId = getChatUserId(body, req);
    const modResult = await moderate(body.message, userId);
    if (!modResult.ok) {
      app.log.warn({ userId, reason: modResult.reason }, "chat_moderation_blocked");
      broadcastToAdmins(createWSEvent("moderation", { userId, reason: modResult.reason, message: body.message.slice(0, 100) }));
      opts.logAbusiveChatEvent?.({
        ts: new Date().toISOString(),
        userId,
        channel: getChatChannel(body),
        message: body.message.slice(0, 200),
        reason: modResult.reason ?? "blocked",
        severity: modResult.reason === "rate_limited" ? "low" : "medium",
      });
      reply.code(429);
      return { error: modResult.reason === "rate_limited" ? "أنت ترسل رسائل بسرعة كبيرة — الرجاء الانتظار" : "تم حظر الرسالة لمخالفتها " };
    }

    body.message = sanitizeInput(body.message);

    if (isVoiceModeRequest(body)) {
      app.log.info({ userId, channel: body.channel, voiceMode: true }, "incoming_chat_voice_mode");
    }

    reply.header("content-type", "application/json; charset=utf-8");

    const response = await opts.fetchChatResponse(body);

    const override = findActiveAnswerOverride(body.message, []);
    if (override) {
      response.reply = override.answerAr;
      response.debug = {
        ...(response.debug && typeof response.debug === "object" ? response.debug : {}),
        adminAnswerOverride: { id: override.id, topic: override.topic },
      };
    }

    const grounding = assessChatGrounding(
      response.reply || "",
      Array.isArray(response.sources)
        ? response.sources.map((source, index) => ({
            id: String(index + 1),
            title: source.title || source.source || `source-${index + 1}`,
            excerpt: source.text,
          }))
        : [],
    );
    response.debug = {
      ...(response.debug && typeof response.debug === "object" ? response.debug : {}),
      grounding,
    };

    opts.logChatInput?.({
      ts: new Date().toISOString(),
      message: body.message,
      normalized: body.message.trim().toLowerCase(),
      userId,
      channel: getChatChannel(body),
      module: (() => { const m = (response.debug as Record<string, unknown>)?.module; return typeof m === "string" ? m : undefined; })(),
      unanswered: !response.reply || response.reply.trim().length < 10,
    });

    if (response.reply) {
      const filterResult = await filterContent(response.reply);
      if (!filterResult.passed) {
        app.log.warn({ violations: filterResult.violations.length }, "chat_output_filtered");
        broadcastToAdmins(createWSEvent("moderation", { userId, direction: "output", violations: filterResult.violations }));
      }
      response.reply = filterResult.sanitized;
    }

    broadcastToAdmins(createWSEvent("chat", { userId, channel: getChatChannel(body), preview: body.message.slice(0, 80) }));

    if (shouldPersistChats) {
      persistChatExchange({
        userId,
        channel: getChatChannel(body),
        userMessage: body.message,
        botReply: response.reply || "",
        intents: response.intents,
        metadata: response.debug,
      }).catch((err) => app.log.warn({ err }, "chat_persist_failed"));
    }

    try {
      const hash = createHash("sha256").update(body.message.trim().toLowerCase()).digest("hex");
      opts.pluginDb.prepare(
        `INSERT INTO analytics_events (id, user_id, event_type, intent, text_hash, event_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(randomUUID(), userId, "chat_question", response.intents?.[0] ?? null, hash, body.message, Date.now());
    } catch {
      /* ignore analytics errors */
    }

    return response;
  });

  /* ── POST /api/chat/stream (SSE) ────────────────────────────── */
  app.post<{ Body: ChatRequest }>("/api/chat/stream", async (req, reply) => {
    const body = req.body;
    if (!body?.message) {
      reply.code(400);
      return { error: "message required" } as const;
    }

    const userId = getChatUserId(body, req);
    const modResult = await moderate(body.message, userId);
    if (!modResult.ok) {
      app.log.warn({ userId, reason: modResult.reason }, "chat_stream_moderation_blocked");
      broadcastToAdmins(createWSEvent("moderation", { userId, reason: modResult.reason, message: body.message.slice(0, 100) }));
      reply.code(429);
      return { error: modResult.reason === "rate_limited" ? "أنت ترسل رسائل بسرعة كبيرة" : "تم حظر الرسالة" };
    }

    body.message = sanitizeInput(body.message);

    broadcastToAdmins(createWSEvent("chat", { userId, channel: getChatChannel(body), preview: body.message.slice(0, 80), stream: true }));

    if (isVoiceModeRequest(body)) {
      app.log.info({ userId, channel: body.channel, voiceMode: true }, "incoming_chat_stream_voice_mode");
    }

    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      ...(requestOrigin
        ? {
            vary: "Origin",
            "access-control-allow-origin": requestOrigin,
            "access-control-allow-credentials": "true",
          }
        : {}),
    });
    reply.raw.flushHeaders?.();
    reply.hijack();
    reply.raw.socket?.setNoDelay?.(true);

    let closed = false;
    reply.raw.on("close", () => { closed = true; });
    reply.raw.on("error", (err: Error) => {
      closed = true;
      app.log.warn({ err }, "SSE response error");
    });

    const sendEvent = (event: string, data: unknown) => {
      if (closed) return;
      try {
        // Ensure we write bytes as UTF-8 explicitly to avoid intermediate
        // layers reinterpreting the string encoding (prevents mojibake).
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        reply.raw.write(Buffer.from(chunk, "utf8"));
      } catch {
        closed = true;
      }
      if (typeof (reply.raw as unknown as { flush?: () => void }).flush === "function") (reply.raw as unknown as { flush: () => void }).flush();
      if (reply.raw.socket && !reply.raw.socket.destroyed) {
        reply.raw.socket.uncork?.();
      }
    };

    const keepAlive = setInterval(() => {
      if (!closed) {
        // write keep-alive as explicit UTF-8 bytes
        reply.raw.write(Buffer.from(": ping\n\n", "utf8"));
        if (typeof (reply.raw as unknown as { flush?: () => void }).flush === "function") (reply.raw as unknown as { flush: () => void }).flush();
      }
    }, 15000);

    try {
      if (await handlePrecomputedStream(app, opts, body, userId, sendEvent, () => closed, shouldPersistChats)) {
        return;
      }

      sendEvent("status", { state: "started" });

      if (await handleChitchatStream(app, opts, body, sendEvent, () => closed)) {
        return;
      }

      if (await handleDeterministicStream(app, opts, body, userId, sendEvent, () => closed, shouldPersistChats)) {
        return;
      }

      await sendKbPrefetchReady(app, opts, body, sendEvent);
      if (await handleAiStream(app, opts, body, userId, sendEvent, () => closed, shouldPersistChats)) {
        return;
      }

      await handleLegacyStream(app, opts, body, userId, sendEvent, () => closed, shouldPersistChats);
    } catch (err) {
      app.log.error({ err }, "chat_stream_failed");
      sendEvent("error", { message: "chat_stream_failed" });
    } finally {
      clearInterval(keepAlive);
      reply.raw.end();
    }
  });
};

/*
APEX AI Chatbot Phase 1 live route wiring note:
- Before returning variable-status answers, check findActiveAnswerOverride(topic, overrides).
- When KB/RAG sources are available, call assessChatGrounding(answerText, sources).
- Log override usage, source count, and grounding warnings.
- This conservative patch adds imports and guidance only; exact runtime wiring must be completed after mapping the route response object.
*/
