import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReliableWebSocketClient } from "@watany/shared/reliable-websocket";
import { defaultFeatureFlags } from "@watany/shared/features";
import type { Mode } from "./app";
import { getDefaultApiWebSocketUrl } from "../lib/api-base";
import { api } from "../lib/api";
import { FeatureFlagsContext, type FeatureFlagsState, type FeatureId } from "./features";

type PublishedFeatureFlagsPayload = {
  flags: Record<string, boolean>;
  lastUpdatedAt: string | null;
};

type FeatureFlagsSocketEvent = {
  type: "feature-flags.snapshot" | "feature-flags.updated";
  payload: PublishedFeatureFlagsPayload;
  timestamp: number;
};

function defaultFlags(): Record<FeatureId, boolean> {
  return defaultFeatureFlags();
}

const STORAGE_KEY = "watany_feature_flags";
const FEATURE_FLAGS_FALLBACK_REFRESH_MS = 120_000;
const FEATURE_FLAGS_WS_ENABLED = import.meta.env.VITE_ENABLE_FEATURE_FLAGS_WS === "true";
const FEATURE_FLAGS_WS_URL = FEATURE_FLAGS_WS_ENABLED ? getDefaultApiWebSocketUrl("/ws/features") : "";

function isLocalRuntime(): boolean {
  const host = globalThis.location?.hostname ?? "";
  return host === "localhost" || host === "127.0.0.1";
}

function enforceLocalFeatureAccess(flags: Record<FeatureId, boolean>): Record<FeatureId, boolean> {
  if (!isLocalRuntime()) {
    return flags;
  }

  // Keep core veteran surfaces reachable during local development even if
  // remote published flags are stale or temporarily drift.
  return {
    ...flags,
    salary: true,
    procedures: true,
    forms: true,
    saved: true,
    dictation: true,
    ticker_faq: true,
    govservices: true,
  };
}

function loadFlags(): Record<FeatureId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<FeatureId, boolean>>;
      return enforceLocalFeatureAccess({ ...defaultFlags(), ...saved });
    }
  } catch {
    // ignore malformed cached flags
  }
  return enforceLocalFeatureAccess(defaultFlags());
}

function saveFlags(flags: Record<FeatureId, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}

export function FeatureFlagsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [flags, setFlags] = useState<Record<FeatureId, boolean>>(loadFlags);
  const [isHydrated, setIsHydrated] = useState(false);
  const wsRef = useRef<ReliableWebSocketClient | null>(null);
  const lastPublishedAtRef = useRef<string | null>(null);

  const applyPublishedFlags = useCallback((payload: PublishedFeatureFlagsPayload) => {
    if (payload.lastUpdatedAt && payload.lastUpdatedAt === lastPublishedAtRef.current) {
      return;
    }

    if (Object.keys(payload.flags).length === 0 && !payload.lastUpdatedAt) {
      return;
    }

    const next = { ...defaultFlags(), ...payload.flags } as Record<FeatureId, boolean>;
    const normalized = enforceLocalFeatureAccess(next);
    setFlags(normalized);
    saveFlags(normalized);
    lastPublishedAtRef.current = payload.lastUpdatedAt;
  }, []);

  useEffect(() => {
    let active = true;

    async function syncPublishedFlags() {
      try {
        const payload = await api.getFeatureFlags();
        if (!active) return;
        applyPublishedFlags(payload);
      } catch {
        // Fall back to locally cached flags when the published snapshot is unavailable.
      } finally {
        if (active) {
          setIsHydrated(true);
        }
      }
    }

    void syncPublishedFlags();
    const timer = globalThis.setInterval(() => {
      void syncPublishedFlags();
    }, FEATURE_FLAGS_FALLBACK_REFRESH_MS);

    return () => {
      active = false;
      globalThis.clearInterval(timer);
    };
  }, [applyPublishedFlags]);

  useEffect(() => {
    wsRef.current?.disconnect();

    if (!FEATURE_FLAGS_WS_URL) {
      return;
    }

    const ws = new ReliableWebSocketClient(FEATURE_FLAGS_WS_URL, {
      onMessage: (event) => {
        try {
          const message = JSON.parse(event.data as string) as FeatureFlagsSocketEvent;
          if (message.type === "feature-flags.snapshot" || message.type === "feature-flags.updated") {
            applyPublishedFlags(message.payload);
          }
        } catch {
          // ignore non-feature websocket events
        }
      },
    });

    wsRef.current = ws;
    ws.connect();

    return () => {
      wsRef.current?.disconnect();
    };
  }, [applyPublishedFlags]);

  const isEnabled = useCallback((id: FeatureId) => flags[id] ?? true, [flags]);

  const isModeEnabled = useCallback((mode: Mode) => {
    if (
      mode === "home" ||
      mode === "chat" ||
      mode === "mobile-os" ||
      mode === "mobile-os-chat" ||
      mode === "community" ||
      mode === "services"
    ) {
      return true;
    }
    if (mode in flags) return flags[mode as FeatureId] ?? true;
    return true;
  }, [flags]);

  const toggle = useCallback((id: FeatureId) => {
    setFlags((prev) => {
      const next = enforceLocalFeatureAccess({ ...prev, [id]: !prev[id] });
      saveFlags(next);
      return next;
    });
  }, []);

  const setFlag = useCallback((id: FeatureId, value: boolean) => {
    setFlags((prev) => {
      const next = enforceLocalFeatureAccess({ ...prev, [id]: value });
      saveFlags(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const defaults = enforceLocalFeatureAccess(defaultFlags());
    setFlags(defaults);
    saveFlags(defaults);
  }, []);

  const value = useMemo<FeatureFlagsState>(() => ({
    flags,
    isHydrated,
    isEnabled,
    isModeEnabled,
    toggle,
    setFlag,
    resetAll,
  }), [flags, isHydrated, isEnabled, isModeEnabled, toggle, setFlag, resetAll]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}