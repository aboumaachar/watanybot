import type { WatanyCanonicalFeatureId, WatanyGuideEngineKind } from './watanyCanonicalFeatureRegistry';
import { getWatanyGuideMemoryKey } from './watanyFeatureGuidedHelpEngine';

export type WatanyFeatureGuideProgressAction =
  | 'seen'
  | 'proceeded'
  | 'cancelled'
  | 'remind_later'
  | 'do_not_show'
  | 'completed';

export type WatanyFeatureGuideProgress = {
  featureId: WatanyCanonicalFeatureId;
  engine: WatanyGuideEngineKind;
  action: WatanyFeatureGuideProgressAction;
  updatedAt: string;
  count: number;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be blocked; guided help must fail open.
  }
}

export function readWatanyFeatureGuideProgress(
  featureId: WatanyCanonicalFeatureId,
  engine: WatanyGuideEngineKind,
): WatanyFeatureGuideProgress | null {
  if (typeof window === 'undefined') return null;
  return readJson<WatanyFeatureGuideProgress>(getWatanyGuideMemoryKey(featureId, engine));
}

export function recordWatanyFeatureGuideProgress(
  featureId: WatanyCanonicalFeatureId,
  engine: WatanyGuideEngineKind,
  action: WatanyFeatureGuideProgressAction,
): WatanyFeatureGuideProgress {
  const existing = readWatanyFeatureGuideProgress(featureId, engine);
  const next: WatanyFeatureGuideProgress = {
    featureId,
    engine,
    action,
    updatedAt: new Date().toISOString(),
    count: (existing?.count ?? 0) + 1,
  };
  if (typeof window !== 'undefined') {
    writeJson(getWatanyGuideMemoryKey(featureId, engine), next);
  }
  return next;
}

export function shouldShowWatanyFeatureGuide(
  featureId: WatanyCanonicalFeatureId,
  engine: WatanyGuideEngineKind,
): boolean {
  const progress = readWatanyFeatureGuideProgress(featureId, engine);
  if (!progress) return true;
  if (progress.action === 'do_not_show') return false;
  if (progress.action === 'proceeded') return false;
  if (progress.action === 'completed') return false;
  if (progress.action === 'remind_later') {
    const updated = Date.parse(progress.updatedAt);
    if (Number.isFinite(updated)) {
      return Date.now() - updated > 1000 * 60 * 60 * 24;
    }
  }
  return true;
}