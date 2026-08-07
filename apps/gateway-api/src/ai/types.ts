/**
 * Watany AI Chat Provider — Type Definitions
 *
 * Defines the contract between the gateway and any AI/LLM backend.
 * Keeps compatibility with existing ChatRequest/ChatResponse types
 * while enabling true streaming and RAG augmentation.
 */
import type { ChatRequest, ChatResponse, ActionIntent } from "@watany/types";

/* ------------------------------------------------------------------ */
/*  RAG context                                                       */
/* ------------------------------------------------------------------ */

/** A single chunk retrieved from the knowledge base for RAG context. */
export interface KbChunk {
  id: string;
  text: string;
  chunk_type: string;
  metadata: Record<string, unknown>;
  /** Similarity score (0-1) from the search step. */
  score?: number;
}

/* ------------------------------------------------------------------ */
/*  AI provider                                                       */
/* ------------------------------------------------------------------ */

/** Configuration options passed when constructing an AI provider. */
export interface AiProviderConfig {
  /** Provider name for logging ("openai" | "ollama" | "azure" | "custom"). */
  provider: string;
  /** Base URL, e.g. "https://api.openai.com/v1" or "http://localhost:11434". */
  baseUrl: string;
  /** API key (if required). */
  apiKey?: string;
  /** Model identifier, e.g. "gpt-4o-mini", "llama3.1". */
  model: string;
  /** System prompt — injected at the start of every conversation. */
  systemPrompt?: string;
  /** Max tokens for the completion. */
  maxTokens?: number;
  /** Temperature (0-2). */
  temperature?: number;
  /** Timeout in milliseconds for AI calls (default: 60000). */
  timeoutMs?: number;
}

/** Events emitted during streaming. */
export type AiStreamEvent =
  | { type: "delta"; delta: string }
  | { type: "done"; fullText: string; usage?: { promptTokens: number; completionTokens: number } }
  | { type: "error"; message: string };

/** Callback for each streamed delta/event. */
export type AiStreamCallback = (event: AiStreamEvent) => void;

/** A single message in the AI conversation (OpenAI-compatible format). */
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Abstract interface for an AI chat provider.
 *
 * Implementations handle communication with the LLM backend while
 * the gateway stays agnostic of the underlying service.
 */
export interface AiChatProvider {
  readonly name: string;

  /**
   * Non-streaming completion. Returns the full response.
   * @param messages  Conversation history (including system prompt, RAG context, etc.)
   * @param options   Optional per-request overrides.
   */
  complete(messages: AiMessage[], options?: Partial<AiProviderConfig>): Promise<string>;

  /**
   * Streaming completion. Calls `onEvent` for every chunk.
   * Returns the full concatenated text once the stream finishes.
   */
  stream(
    messages: AiMessage[],
    onEvent: AiStreamCallback,
    options?: Partial<AiProviderConfig>,
  ): Promise<string>;

  /** Lightweight health/connectivity check. */
  healthCheck(): Promise<{ ok: boolean; model: string; latencyMs: number }>;
}

/* ------------------------------------------------------------------ */
/*  Request augmented with AI context                                 */
/* ------------------------------------------------------------------ */

/** Extended chat request used internally after RAG augmentation. */
export interface AugmentedChatRequest extends ChatRequest {
  /** KB chunks retrieved for this query (RAG). */
  kbContext?: KbChunk[];
  /** Conversation history for multi-turn. */
  history?: AiMessage[];
}

/* ------------------------------------------------------------------ */
/*  Intent extraction result                                          */
/* ------------------------------------------------------------------ */

/** The AI post-processor returns intents extracted from the LLM reply. */
export interface ExtractedIntents {
  intents: ActionIntent[];
  /** Optional clarifying question detected in the answer. */
  clarifyingQuestion?: string;
}
