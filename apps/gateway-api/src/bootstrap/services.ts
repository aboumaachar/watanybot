/**
 * bootstrap/services.ts
 * Wires up application-level services:
 *   - versioning
 *   - intent classifier + unrecognized-input log
 *   - voice E2E (scheduler + routes)
 *   - chat service
 *
 * Returns handles that routes need at registration time.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { createVersioningService } from "../lib/versioning";
import {
  classifySmallTalk,
  getDefaultSmallTalkIntentsCandidates,
  getSmallTalkIntents,
  loadSmallTalkIntents,
  resolveSmallTalkIntentsPath,
  setSmallTalkIntents,
} from "../lib/intent-classifier";
import { getRandomClarifyResponse, initUnrecognizedLog, logUnrecognizedInput } from "../lib/unrecognized";
import { initChatLogger } from "../lib/chat-logger";
import { createVoiceE2EService, voiceE2ERoutes } from "../lib/voice-e2e";
import { createChatService } from "../lib/chat-service";
import { startWorldCupNewsIngestionJob } from "../worldcup/world-cup-news-ingestion";
import {
  getAiChat, getAiProvider, getAiModel,
  aiConversationHistory,
  pendingProcedureConfirmations,
  pendingClarificationSelections,
  conversationContexts,
  aiFailureCount,
  lastAiFailure,
} from "./ai-state";
import {
  retrieveChunks, buildAiMessages, extractIntents,
  evaluateRelevance, getRagChunkCount,
} from "../ai/index";
import { isKbNodesReady, searchKbNodes } from "../kb/kb-nodes";
import { computeEmotionalScore, EMPATHY_SYSTEM_INJECTION } from "../lib/emotional";
import { dataDir, host, port, aiRagTopK, aiSystemPrompt, repoRoot } from "../lib/config";
import type { KbBootstrapResult } from "./kb-bootstrap";
import type { CircuitBreakers } from "./circuit-breakers";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export type ServicesResult = {
  versionService: ReturnType<typeof createVersioningService>;
  voiceE2E: ReturnType<typeof createVoiceE2EService>;
  chatService: ReturnType<typeof createChatService>;
  versionRootPath: string;
  getSmallTalkIntents: typeof getSmallTalkIntents;
  setSmallTalkIntents: typeof setSmallTalkIntents;
};

export async function bootstrapServices(
  app: FastifyInstance,
  kb: KbBootstrapResult,
  cbs?: CircuitBreakers,
): Promise<ServicesResult> {
  const versionRootPath = path.resolve(__dirname, "../../");

  // ── Versioning ─────────────────────────────────────────────────
  const versionsDir    = path.join(dataDir, "kb_versions");
  const versionService = createVersioningService(versionsDir);

  // ── Intent classifier + unrecognized log ───────────────────────
  const intentsCandidates = getDefaultSmallTalkIntentsCandidates(versionRootPath);
  const intentsPath = resolveSmallTalkIntentsPath(intentsCandidates);
  if (intentsPath) {
    loadSmallTalkIntents(intentsPath);
  } else {
    app.log.warn({ intentsCandidates }, "Small-talk intents file not found; continuing without preload.");
  }
  initUnrecognizedLog(dataDir);
  initChatLogger(dataDir);

  // ── Voice E2E ──────────────────────────────────────────────────
  const voiceE2E = createVoiceE2EService(app, { dataDir, host, port });
  await voiceE2E.init();
  voiceE2E.startScheduler();
  app.register(voiceE2ERoutes, { voiceE2E });

  // World Cup crawl sources feed the shared news table for the public routes.
  startWorldCupNewsIngestionJob(app);

  // ── Chat service ───────────────────────────────────────────────
  const chatService = createChatService({
    repoRootPath: repoRoot,
    usePython:   (await import("../lib/config")).usePython,
    getPythonBase: (await import("../lib/config")).getPythonBase,
    getKbStore:  () => kb.kbStore,
    useAi:       (await import("../lib/config")).useAi,
    getAiChat,
    getAiProvider,
    getAiModel,
    aiRagTopK,
    aiSystemPrompt,
    aiConversationHistory,
    retrieveChunks,
    buildAiMessages,
    extractIntents,
    evaluateRelevance,
    getRagChunkCount,
    isKbNodesReady,
    searchKbNodes,
    computeEmotionalScore,
    empathySystemInjection: EMPATHY_SYSTEM_INJECTION,
    classifySmallTalk,
    logUnrecognizedInput,
    getRandomClarifyResponse,
    aiFailureCount,
    lastAiFailure,
    pendingProcedureConfirmations,
    pendingClarificationSelections,
    conversationContexts,
    aiProviderCircuitBreaker: cbs?.aiProviderCircuitBreaker,
    log: {
      info:  app.log.info.bind(app.log),
      warn:  app.log.warn.bind(app.log),
      error: app.log.error.bind(app.log),
    },
  });

  return {
    versionService,
    voiceE2E,
    chatService,
    versionRootPath,
    getSmallTalkIntents,
    setSmallTalkIntents,
  };
}
