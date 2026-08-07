export const HYBRID_CHAT_DEFAULT_POLICY = {
  id: "watany-hybrid-chat-default-v1-1",
  defaultSurface: "WatanyHybridDefaultChat",
  endpoint: "/api/kb/hybrid-chat",
  preserveCommunityChat: true,
  blockedPathMarkers: ["community", ".apex", ".pma", "backups", "node_modules", "dist", "build", ".next"],
  allowedDefaultPatchMode: "strict-live-entrypoints-only",
} as const;

export type HybridChatDefaultPolicy = typeof HYBRID_CHAT_DEFAULT_POLICY;