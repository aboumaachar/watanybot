import { createContext, useContext, type Context } from "react";
import type { FeatureId } from "@watany/shared/features";
import type { Mode } from "./app";
export { CATEGORY_LABELS, FEATURES } from "@watany/shared/features";
export type { FeatureId, FeatureMeta } from "@watany/shared/features";

const contextStore = globalThis as typeof globalThis & {
  __watanyReactContexts__?: Map<string, Context<unknown>>;
};

function getStableContext<T>(key: string): Context<T | null> {
  contextStore.__watanyReactContexts__ ??= new Map<string, Context<unknown>>();
  const existing = contextStore.__watanyReactContexts__.get(key);
  if (existing) {
    return existing as Context<T | null>;
  }

  // Keep context identity stable across Vite HMR so providers and hooks do not drift apart.
  const created = createContext<T | null>(null);
  contextStore.__watanyReactContexts__.set(key, created as Context<unknown>);
  return created;
}

/* ── Context ── */
export type FeatureFlagsState = {
  flags: Record<FeatureId, boolean>;
  isHydrated: boolean;
  isEnabled: (id: FeatureId) => boolean;
  /** Also works for Mode ids that overlap with FeatureId */
  isModeEnabled: (mode: Mode) => boolean;
  toggle: (id: FeatureId) => void;
  setFlag: (id: FeatureId, value: boolean) => void;
  resetAll: () => void;
};

export const FeatureFlagsContext = getStableContext<FeatureFlagsState>("watany:feature-flags-context");

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("FeatureFlagsProvider missing");
  return ctx;
}
