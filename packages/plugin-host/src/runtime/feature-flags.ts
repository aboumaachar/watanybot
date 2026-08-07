export type WatanyFeatureFlagMap = Record<string, boolean>;

export function isWatanyFeatureEnabled(flags: WatanyFeatureFlagMap, key: string, fallback = true): boolean {
  if (!flags || typeof flags[key] === 'undefined') return fallback;
  return Boolean(flags[key]);
}