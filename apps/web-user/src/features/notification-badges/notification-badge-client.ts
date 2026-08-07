import {
  clampBadgeCount,
  resolveNotificationBadgeFeatureKey,
  type NotificationBadgeItem,
  type NotificationBadgeMap,
  type NotificationBadgeResponse,
} from './notification-badge-types';
import { isLoggedIn } from '../../lib/auth';

function toBadgeMap(payload: NotificationBadgeResponse | null | undefined): NotificationBadgeMap {
  const next: NotificationBadgeMap = {};
  if (!payload) return next;

  const toPartialBadgeItem = (value: Partial<NotificationBadgeItem> | null | undefined): Partial<NotificationBadgeItem> | undefined => {
    return value && typeof value === 'object' ? value : undefined;
  };

  const addIfValid: (featureKey: string | undefined, countValue: unknown, source?: Partial<NotificationBadgeItem>) => void = (
    featureKey,
    countValue,
    source,
  ) => {
    const normalizedKey = resolveNotificationBadgeFeatureKey(featureKey ?? '');
    const count = clampBadgeCount(countValue as any);
    if (!normalizedKey || count <= 0) return;

    next[normalizedKey] = {
      ...source,
      featureKey: normalizedKey,
      count,
      severity: source?.severity || 'info',
      label: source?.label,
      updatedAt: source?.updatedAt,
    };
  };

  if (payload.badges && typeof payload.badges === 'object') {
    for (const [key, value] of Object.entries(payload.badges)) {
      const badgeItem = toPartialBadgeItem(value);
      addIfValid(badgeItem?.featureKey || key, badgeItem?.count, badgeItem);
    }
  }

  if (Array.isArray(payload.items)) {
    for (const item of payload.items) {
      addIfValid(item.featureKey, item.count, item);
    }
  }

  if (payload.counts && typeof payload.counts === 'object') {
    for (const [key, countValue] of Object.entries(payload.counts)) {
      addIfValid(key, countValue, { featureKey: key });
    }
  }

  return next;
}

async function tryFetchJson(url: string): Promise<NotificationBadgeMap | null> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 503) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as NotificationBadgeResponse;
  return toBadgeMap(payload);
}

export async function fetchNotificationBadges(apiBaseUrl = ''): Promise<NotificationBadgeMap> {
  if (!isLoggedIn()) {
    return {};
  }

  const base = apiBaseUrl.replace(/\/$/, '');
  const endpoints = [
    `${base}/api/notification-badges/counts`,
  ];

  for (const endpoint of endpoints) {
    try {
      const badges = await tryFetchJson(endpoint);
      if (badges && Object.keys(badges).length > 0) {
        return badges;
      }
    } catch {
      // Fail closed: never break the home screen because a badge endpoint failed.
    }
  }

  return {};
}

export function getBadgeCount(badges: NotificationBadgeMap, featureKey: string): number {
  const key = resolveNotificationBadgeFeatureKey(featureKey);
  return clampBadgeCount(badges[key]?.count);
}

export function getBadgeItem(badges: NotificationBadgeMap, featureKey: string): NotificationBadgeItem | undefined {
  const key = resolveNotificationBadgeFeatureKey(featureKey);
  return badges[key];
}

// Emit helper for DOM or other bridge to receive consolidated counts
export type BadgeCounts = Record<string, number>;

export function emitWatanyFeatureBadgeCounts(counts: BadgeCounts): void {
  if (globalThis.window === undefined) return;

  try {
    const existing = (globalThis as any).__watany_feature_badge_counts__ ?? {};
    const normalizedIncoming = Object.fromEntries(
      Object.entries(counts).map(([key, value]) => [resolveNotificationBadgeFeatureKey(key), value]),
    );
    const merged = { ...(existing as Record<string, number>), ...normalizedIncoming };
    (globalThis as any).__watany_feature_badge_counts__ = merged;
    globalThis.dispatchEvent(
      new CustomEvent('watany:feature-badge-counts', {
        detail: { counts: merged },
      })
    );
  } catch {
    // non-fatal
  }
}
