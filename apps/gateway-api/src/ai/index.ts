/**
 * Watany AI Module — Public API
 *
 * Re-exports everything needed by the gateway server.
 */
export type {
  AiChatProvider,
  AiMessage,
  AiProviderConfig,
  AiStreamCallback,
  AiStreamEvent,
  AugmentedChatRequest,
  ExtractedIntents,
  KbChunk,
} from "./types";

export { OpenAiCompatProvider } from "./openai-compat";
export { withRetryWrapper } from "./provider-with-retry";
export {
  loadRagChunks,
  retrieveChunks,
  buildAiMessages,
  getRagChunkCount,
  resetRagChunks,
  listChunks,
  getChunkById,
  updateChunkById,
  persistChunksToFile,
  evaluateRelevance,
} from "./rag";
export { extractIntents } from "./intent-extractor";

// ═══════════════════════════════════════════════════════════════════
// Advanced KB-AI Dynamics (New in v2)
// ═══════════════════════════════════════════════════════════════════

// Query Understanding Layer
export {
  queryUnderstanding,
  normalizeArabic,
  type QueryUnderstanding,
  type Intent,
  type QueryType,
  type ComplexityLevel,
  type Entity,
  type TemporalContext,
  type Ambiguity,
} from "./query-understanding";

// Adaptive Retrieval Engine
export {
  adaptiveRetrieval,
  selectStrategy,
  type RetrievalStrategy,
  type SearchMethod,
  type RankingMethod,
  type ScoredChunk,
} from "./adaptive-retrieval";

// Multi-Hop Reasoning
export {
  multiHopReasoning,
  type MultiHopResult,
  type SubQuestion,
  type SubQuestionAnswer,
} from "./multi-hop";

// Confidence Assessment & Contextual Reranking
export {
  confidenceAssessment,
  contextualReranker,
  type ConfidenceScore,
  type ConfidenceLevel,
  type AdaptedResponse,
  type UserProfile,
} from "./confidence-reranking";

// Feedback Loop & KB Evolution
export {
  feedbackLoop,
  type Interaction,
  type Feedback,
  type KnowledgeGap,
  type ImprovementCandidate,
  type ABTest,
} from "./feedback-loop";

// Advanced Chat Handler
export {
  advancedChatHandler,
  type AdvancedChatRequest,
  type AdvancedChatResponse,
} from "./advanced-chat-handler";

// ═══════════════════════════════════════════════════════════════════
// Phase 2: Semantic Search & Neural Reranking
// ═══════════════════════════════════════════════════════════════════

// Semantic Search with Embeddings
export {
  getSemanticSearchEngine,
  createSemanticSearchEngine,
  reciprocalRankFusion,
  type EmbeddingProvider,
  type VectorStore,
  type SemanticSearchResult,
} from "./semantic-search";

// AI Query Decomposition
export {
  getAIQueryDecomposer,
  createAIQueryDecomposer,
  type LLMProvider,
  type DecompositionPlan,
  type SubQuestion as DecomposerSubQuestion,
} from "./ai-query-decomposition";

// Neural Cross-Encoder Reranking
export {
  getNeuralReranker,
  createNeuralReranker,
  type CrossEncoderConfig,
  type RerankResult,
} from "./cross-encoder";

// ═══════════════════════════════════════════════════════════════════
// Phase 3: Session, A/B Testing & Admin
// ═══════════════════════════════════════════════════════════════════

// Session Tracking
export {
  getSessionStore,
  getSessionContextBuilder,
  type Session,
  type SessionMessage,
  type SessionContext,
} from "./session-tracking";

// A/B Test Automation
export {
  getABTestEngine,
  createABTestEngine,
  type Experiment,
  type Variant,
  type UserAssignment,
  type ExperimentMetrics,
} from "./ab-testing";

/**
 * Factory: create the appropriate AI provider from environment config.
 */
import type { AiChatProvider, AiProviderConfig } from "./types";
import { OpenAiCompatProvider } from "./openai-compat";

export function createAiProvider(cfg: AiProviderConfig): AiChatProvider {
  // All currently supported providers use the OpenAI-compatible protocol.
  // Add switch cases here for providers with different APIs (e.g. Anthropic).
  switch (cfg.provider) {
    case "openai":
    case "azure":
    case "ollama":
    case "lmstudio":
    case "vllm":
    case "custom":
    default:
      return new OpenAiCompatProvider(cfg);
  }
}
