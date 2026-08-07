import { WATANY_GUIDE_DEFAULTS, type WatanyGuideStatus } from './watanyGuideRegistry';

export type WatanyGuideProgress = {
  guideKey: string;
  featureKey: string;
  status: WatanyGuideStatus;
  firstSeenAt?: string;
  lastSeenAt?: string;
  shownCount: number;
  ctaClickedAt?: string;
  targetRouteVisited?: string;
  completed: boolean;
};

const STORAGE_KEY = 'watany.guide.progress.v1';

function nowIso() {
  return new Date().toISOString();
}

export function readWatanyGuideProgress(): Record<string, WatanyGuideProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, WatanyGuideProgress>;
  } catch {
    return {};
  }
}

export function writeWatanyGuideProgress(progress: Record<string, WatanyGuideProgress>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function recordWatanyGuideEvent(input: {
  guideKey: string;
  featureKey: string;
  status: WatanyGuideStatus;
  targetRoute?: string;
}) {
  const progress = readWatanyGuideProgress();
  const existing = progress[input.guideKey];
  const next: WatanyGuideProgress = {
    guideKey: input.guideKey,
    featureKey: input.featureKey,
    status: input.status,
    firstSeenAt: existing?.firstSeenAt || nowIso(),
    lastSeenAt: nowIso(),
    shownCount: (existing?.shownCount || 0) + (input.status === 'seen' ? 1 : 0),
    ctaClickedAt: input.status === 'clicked_cta' ? nowIso() : existing?.ctaClickedAt,
    targetRouteVisited: input.targetRoute || existing?.targetRouteVisited,
    completed: input.status === 'clicked_cta' || input.status === 'completed' || Boolean(existing?.completed)
  };

  progress[input.guideKey] = next;
  writeWatanyGuideProgress(progress);

  if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
    console.info('[WatanyGuide]', next);
  }

  return next;
}

export function shouldShowWatanyGuide(guideKey: string): boolean {
  const progress = readWatanyGuideProgress();
  const item = progress[guideKey];
  if (!item) return true;
  if (item.status === 'clicked_cta' || item.completed) return false;

  if (item.status === 'later' || item.status === 'dismissed') {
    const last = item.lastSeenAt ? new Date(item.lastSeenAt).getTime() : 0;
    const hours = item.status === 'later'
      ? WATANY_GUIDE_DEFAULTS.laterCooldownHours
      : WATANY_GUIDE_DEFAULTS.dismissedCooldownHours;
    return Date.now() - last > hours * 60 * 60 * 1000;
  }

  return item.status === 'not_seen';
}
