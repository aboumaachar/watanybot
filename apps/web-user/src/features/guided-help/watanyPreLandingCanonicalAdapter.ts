import {
  getWatanyCanonicalFeature,
  getWatanyFeatureIdForRoute,
  normalizeWatanyGuideRoute,
  type WatanyCanonicalFeature,
  type WatanyCanonicalFeatureId,
} from './watanyCanonicalFeatureRegistry';
import {
  recordWatanyFeatureGuideProgress,
  shouldShowWatanyFeatureGuide,
  type WatanyFeatureGuideProgressAction,
} from './watanyFeatureGuideProgress';

export type WatanyLegacyPreLandingGuideLike = {
  route?: string;
  targetRoute?: string;
  path?: string;
  title?: string;
  titleAr?: string;
  body?: string;
  bodyAr?: string;
  description?: string;
  ctaLabel?: string;
  ctaLabelAr?: string;
  proceedLabel?: string;
  cancelLabel?: string;
  laterLabel?: string;
  dontShowLabel?: string;
  guideKey?: string;
  featureKey?: string;
};

export type WatanyCanonicalPreLandingGuide = {
  legacyGuide?: WatanyLegacyPreLandingGuideLike;
  featureId: WatanyCanonicalFeatureId;
  feature: WatanyCanonicalFeature;
  route: string;
  canonicalRoute: string;
  titleAr: string;
  bodyAr: string;
  ctaLabelAr: string;
  cancelLabelAr: string;
  laterLabelAr: string;
  dontShowLabelAr: string;
  memoryKey: string;
};

export function getWatanyLegacyGuideRoute(guide: WatanyLegacyPreLandingGuideLike | undefined | null): string {
  return guide?.targetRoute ?? guide?.route ?? guide?.path ?? '';
}

export function getWatanyCanonicalPreLandingMemoryKey(featureId: WatanyCanonicalFeatureId): string {
  return `watany:guided-help:v2:preLanding:feature:${featureId}`;
}

export function adaptWatanyPreLandingGuideToCanonical(
  guide: WatanyLegacyPreLandingGuideLike | undefined | null,
  fallbackRoute?: string,
): WatanyCanonicalPreLandingGuide {
  const route = getWatanyLegacyGuideRoute(guide) || fallbackRoute || '';
  const canonicalRoute = normalizeWatanyGuideRoute(route);
  const featureId = getWatanyFeatureIdForRoute(canonicalRoute);
  const feature = getWatanyCanonicalFeature(featureId);
  return {
    legacyGuide: guide ?? undefined,
    featureId,
    feature,
    route,
    canonicalRoute,
    titleAr: guide?.titleAr ?? guide?.title ?? feature.titleAr,
    bodyAr: guide?.bodyAr ?? guide?.body ?? guide?.description ?? feature.shortDescriptionAr,
    ctaLabelAr: guide?.ctaLabelAr ?? guide?.ctaLabel ?? guide?.proceedLabel ?? '\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629',
    cancelLabelAr: guide?.cancelLabel ?? '\u0625\u0644\u063a\u0627\u0621',
    laterLabelAr: guide?.laterLabel ?? '\u0630\u0643\u0631\u0646\u064a \u0644\u0627\u062d\u0642\u0627\u064b',
    dontShowLabelAr: guide?.dontShowLabel ?? '\u0644\u0627 \u062a\u0638\u0647\u0631 \u0645\u062c\u062f\u062f\u0627\u064b',
    memoryKey: getWatanyCanonicalPreLandingMemoryKey(featureId),
  };
}

export function shouldShowWatanyCanonicalPreLandingGuide(
  guide: WatanyLegacyPreLandingGuideLike | undefined | null,
  fallbackRoute?: string,
): boolean {
  const adapted = adaptWatanyPreLandingGuideToCanonical(guide, fallbackRoute);
  return shouldShowWatanyFeatureGuide(adapted.featureId, 'preLanding');
}

export function recordWatanyCanonicalPreLandingAction(
  guide: WatanyLegacyPreLandingGuideLike | undefined | null,
  action: WatanyFeatureGuideProgressAction,
  fallbackRoute?: string,
): void {
  const adapted = adaptWatanyPreLandingGuideToCanonical(guide, fallbackRoute);
  recordWatanyFeatureGuideProgress(adapted.featureId, 'preLanding', action);
}

export function getWatanyCanonicalPreLandingDebugLabel(
  guide: WatanyLegacyPreLandingGuideLike | undefined | null,
  fallbackRoute?: string,
): string {
  const adapted = adaptWatanyPreLandingGuideToCanonical(guide, fallbackRoute);
  return `${adapted.featureId}:${adapted.canonicalRoute || adapted.route || 'no-route'}`;
}