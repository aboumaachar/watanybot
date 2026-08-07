/**
 * bootstrap/ai-state.ts
 * Mutable AI runtime state shared across route handlers.
 *
 * Exported as plain objects/refs so routes can call getters/setters
 * without closing over server.ts locals.
 *
 * Import this module wherever AI state needs to be read or mutated
 * (admin-ai-runtime routes, chat routes, etc.).
 */
import type { AiChatProvider, AiMessage } from "../ai/types";
import { createAiProvider } from "../ai/index";
import {
  useAi, aiBaseUrl, aiMaxTokens, aiTemperature, aiTimeoutMs, aiSystemPrompt,
} from "../lib/config";
import { debugConsole } from "../debug/console";

// ── Mutable singletons ──────────────────────────────────────────────────────

let _aiProvider = process.env.AI_PROVIDER || "openai";
let _aiApiKey   = process.env.AI_API_KEY   || "";
let _aiModel    = process.env.AI_MODEL     || "gpt-4o-mini";
let _aiChat: AiChatProvider | null = null;

// Conversation history keyed by userId
export const aiConversationHistory = new Map<string, AiMessage[]>();

// Pending state maps (populated by chat service, read by chat routes)
export const pendingProcedureConfirmations = new Map<string, {
  procedureId: string;
  procedureTitle: string;
  procedureSummary: string;
  expiresAt: number;
}>();

export const pendingClarificationSelections = new Map<string, {
  clarifyingQuestion: string;
  options: Array<{ label: string; query: string | undefined; kind: "query" | "other" }>;
  expiresAt: number;
}>();

export const conversationContexts = new Map<string, {
  conversationId: string;
  originalQuestion?: string;
  originalIntent?: string;
  originalModule?: string;
  lastAnswer?: string;
  pendingClarification?: boolean;
  updatedAt: string;
  awaitingTopicDecision?: boolean;
}>();

// Failure tracking for the admin overview dashboard
export const aiFailureCount  = { value: 0 };
export const lastAiFailure   = { value: null as { at: number; route: string; message: string } | null };

// ── Getters / setters ───────────────────────────────────────────────────────

export const getAiProvider = () => _aiProvider;
export const setAiProvider = (v: string) => { _aiProvider = v; };

export const getAiModel    = () => _aiModel;
export const setAiModel    = (v: string) => { _aiModel = v; };

export const getAiApiKey   = () => _aiApiKey;
export const setAiApiKey   = (v: string) => { _aiApiKey = v; };

export const getAiChat     = () => _aiChat;
export const setAiChat     = (v: AiChatProvider | null) => { _aiChat = v; };

// ── Initializer (call once at startup) ─────────────────────────────────────

export async function initAiState(): Promise<void> {
  if (!useAi) {
    debugConsole.info("AI disabled via USE_AI env — skipping provider init");
    return;
  }
  try {
    _aiChat = createAiProvider({
      provider:   _aiProvider,
      baseUrl:    aiBaseUrl,
      apiKey:     _aiApiKey,
      model:      _aiModel,
      maxTokens:  aiMaxTokens,
      temperature: aiTemperature,
      timeoutMs:  aiTimeoutMs,
      systemPrompt: aiSystemPrompt || undefined,
    });
    debugConsole.info("AI chat provider initialized", { provider: _aiProvider, model: _aiModel });
  } catch (e) {
    debugConsole.warn("AI provider initialization failed — falling back to null", e);
    _aiChat = null;
  }
}
