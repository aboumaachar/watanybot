import { useEffect, useRef } from "react";
import { isLoggedIn } from "../../lib/auth";
import { resolveNotificationBadgeFeatureKey } from "./notification-badge-types";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./notification-badges.css";

export type BadgeCounts = Record<string, number>;

declare global {
  interface Window {
    __watany_feature_badge_counts__?: BadgeCounts;
  }
}

const BADGE_EVENT_NAME = "watany:feature-badge-counts";
const BADGE_STORAGE_KEY = "watany.featureBadgeCounts";
const BADGE_SELECTOR = "[data-feature-key], [data-notification-feature-key], [data-badge-feature-key]";
const DOM_BADGE_SELECTOR = ".watany-icon-notification-badge[data-watany-dom-badge='true']";
const DEFAULT_POLL_INTERVAL_MS = 45000;

type BadgeCountsResponse = {
  readonly ok?: boolean;
  readonly counts?: BadgeCounts;
};

function normalizeCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

function normalizeCounts(value: unknown): BadgeCounts {
  const counts: BadgeCounts = {};
  if (value == null || typeof value !== "object") {
    return counts;
  }

  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const featureKey = resolveNotificationBadgeFeatureKey(key.trim());
    if (featureKey.length === 0) {
      continue;
    }

    counts[featureKey] = normalizeCount(rawValue);
  }

  return counts;
}

function readStoredCounts(): BadgeCounts {
  try {
    const raw = (globalThis as any).localStorage?.getItem?.(BADGE_STORAGE_KEY);
    if (raw == null) return {};
    return normalizeCounts(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writeStoredCounts(counts: BadgeCounts): void {
  try {
    (globalThis as any).localStorage?.setItem?.(BADGE_STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // localStorage can be blocked. Badges should remain non-fatal.
  }
}

function getFeatureKey(element: Element): string {
  const host = element as HTMLElement;
  return resolveNotificationBadgeFeatureKey(
    (
    host.dataset.featureKey ?? host.dataset.notificationFeatureKey ?? host.dataset.badgeFeatureKey ?? ""
    ).trim()
  );
}

function removeExistingDomBadge(element: Element): void {
  const host = element as HTMLElement;
  if (host.classList.contains("watany-icon-notification-badge-anchor")) {
    host.classList.remove("watany-icon-notification-badge-anchor");
  }
  if (host.matches(DOM_BADGE_SELECTOR)) {
    host.remove();
    return;
  }
  host.querySelectorAll(".watany-icon-notification-badge-anchor").forEach((anchor) => {
    anchor.classList.remove("watany-icon-notification-badge-anchor");
  });
  element.querySelectorAll(DOM_BADGE_SELECTOR).forEach((badge) => badge.remove());
}

function resolveBadgeAnchor(element: Element): HTMLElement {
  const host = element as HTMLElement;
  if (
    host.matches(
      ".watany-app-icon__tile, .watany-header-action__icon, .tab-icon, .rail-icon, .drawer-icon, .sticky-hybrid-chat-launcher__utility-icon, .watany-search, .koudama-feature-icon__tile",
    )
  ) {
    return host;
  }

  return (
    host.querySelector<HTMLElement>(
      ".watany-app-icon__tile, .watany-header-action__icon, .tab-icon, .rail-icon, .drawer-icon, .sticky-hybrid-chat-launcher__utility-icon, .koudama-feature-icon__tile",
    ) || host
  );
}

function formatBadgeCount(count: number): string {
  if (count > 99) {
    return "99+";
  }

  return String(count);
}

function applyBadge(element: Element, count: number): void {
  removeExistingDomBadge(element);

  if (count <= 0) {
    return;
  }

  const anchor = resolveBadgeAnchor(element);
  anchor.classList.add("watany-icon-notification-badge-anchor");

  const badge = document.createElement("span");
  badge.className = "watany-icon-notification-badge watany-app-icon__badge";
  badge.dataset.watanyDomBadge = "true";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = formatBadgeCount(count);
  anchor.appendChild(badge);
}

function readEventCounts(event: Event): BadgeCounts {
  const detail = (event as CustomEvent<unknown>).detail;
  if (detail && typeof detail === "object" && "counts" in detail) {
    return normalizeCounts((detail as { counts?: unknown }).counts);
  }

  return normalizeCounts(detail);
}

async function fetchBackendBadgeCounts(signal: AbortSignal): Promise<BadgeCounts> {
  if (!isLoggedIn()) {
    return {};
  }

  const response = await fetch("/api/notification-badges/counts", {
    credentials: "include",
    headers: {
      accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    return {};
  }

  const payload = (await response.json()) as BadgeCountsResponse;
  return normalizeCounts(payload.counts);
}

export function NotificationBadgeDomBridge(): null {
  const countsRef = useRef<BadgeCounts>({});
  const pendingApplyRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (globalThis.window === undefined || globalThis.document === undefined) {
      return undefined;
    }

    const applyAll = () => {
      const counts = countsRef.current;
      document.querySelectorAll(BADGE_SELECTOR).forEach((element) => {
        const featureKey = getFeatureKey(element);
        if (featureKey.length === 0) {
          return;
        }

        applyBadge(element, counts[featureKey] ?? 0);
      });
    };

    const scheduleApply = () => {
      if (pendingApplyRef.current !== null) {
        (globalThis as any).clearTimeout(pendingApplyRef.current);
      }

      pendingApplyRef.current = (globalThis as any).setTimeout(applyAll, 60);
    };

    const mergeCounts = (incoming: BadgeCounts) => {
      countsRef.current = {
        ...countsRef.current,
        ...incoming,
      };
      (globalThis as any).__watany_feature_badge_counts__ = countsRef.current;
      writeStoredCounts(countsRef.current);
      applyAll();
    };

    const refreshCounts = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const backendCounts = await fetchBackendBadgeCounts(controller.signal);
        mergeCounts(backendCounts);
      } catch {
        // Backend counts are progressive enhancement. UI must not fail when offline.
      }
    };

    const seedCounts = {
      ...readStoredCounts(),
      ...normalizeCounts((globalThis as any).__watany_feature_badge_counts__),
    };
    countsRef.current = seedCounts;
    (globalThis as any).__watany_feature_badge_counts__ = seedCounts;
    applyAll();
    void refreshCounts();

    const handleBadgeCounts = (event: Event) => {
      mergeCounts(readEventCounts(event));
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void refreshCounts();
      }
    };

    (globalThis as any).addEventListener(BADGE_EVENT_NAME, handleBadgeCounts);
    (globalThis as any).addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    const intervalId = (globalThis as any).setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshCounts();
      }
    }, DEFAULT_POLL_INTERVAL_MS);

    const observer = MutationObserver === undefined ? null : new MutationObserver(() => scheduleApply());

    observer?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-feature-key", "data-notification-feature-key", "data-badge-feature-key"],
    });

    return () => {
      abortRef.current?.abort();
      (globalThis as any).removeEventListener(BADGE_EVENT_NAME, handleBadgeCounts);
      (globalThis as any).removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      (globalThis as any).clearInterval(intervalId);
      observer?.disconnect();
      if (pendingApplyRef.current !== null) {
        (globalThis as any).clearTimeout(pendingApplyRef.current);
      }
    };
  }, []);

  return null;
}

export function emitWatanyFeatureBadgeCounts(counts: BadgeCounts): void {
  if (typeof globalThis === "undefined") return;

  const existing = (globalThis as any).__watany_feature_badge_counts__ ?? {};
  const merged = { ...(existing as Record<string, number>), ...normalizeCounts(counts) };
  (globalThis as any).__watany_feature_badge_counts__ = merged;

  globalThis.dispatchEvent(
    new CustomEvent(BADGE_EVENT_NAME, {
      detail: { counts: merged },
    })
  );
}
