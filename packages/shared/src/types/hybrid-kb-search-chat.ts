export type HybridKbSelectedResultKind = "tag" | "document" | "procedure" | "faq" | "salary" | "payment" | "unknown";

export type HybridKbSelectedResult = {
  kind: HybridKbSelectedResultKind;
  type?: string;
  id: string;
  label: string;
  title?: string;
  tags: string[];
  kbIds: string[];
  sourceType?: string;
  route?: string;
  summary?: string;
  score?: number;
};

export type HybridKbSearchSnapshot = {
  query?: string;
  topTags?: string[];
  selectedLabel?: string;
};

export type HybridChatIntent = "ask" | "open_selected_context";

export type HybridChatRequest = {
  message: string;
  intent?: HybridChatIntent;
  selectedTags?: string[];
  selectedKbIds?: string[];
  selectedResult?: HybridKbSelectedResult | null;
  searchSnapshot?: HybridKbSearchSnapshot;
  conversationId?: string;
};

export type HybridChatAction = {
  kind: "open_procedure" | "open_document" | "ask_follow_up" | "clear_context";
  label: string;
  targetId?: string;
  route?: string;
};

export type HybridChatSource = {
  id?: string;
  title?: string;
  chunkId?: string;
  kbId?: string;
  tags?: string[];
  sourceType?: string;
  score?: number;
};

export type HybridChatResponse = {
  answer: string;
  mode: "selected-context-ready" | "retrieval-context-ready" | "clarification-required";
  sources: HybridChatSource[];
  followUps: string[];
  selectedTags: string[];
  selectedKbIds: string[];
  selectedResult?: HybridKbSelectedResult | null;
  actions: HybridChatAction[];
  confidence: number;
  conversationId: string;
  generatedAt: string;
};