import {
  getWatanyCanonicalFeature,
  getWatanyFeatureIdForRoute,
  normalizeWatanyGuideRoute,
  type WatanyCanonicalFeature,
  type WatanyCanonicalFeatureId,
  type WatanyGuideEngineKind,
} from './watanyCanonicalFeatureRegistry';

export type WatanyFeatureGuideIntent =
  | 'first_entry'
  | 'pre_landing'
  | 'smart_tip'
  | 'profile_completion'
  | 'journey_next_step';

export type WatanyFeatureGuideCard = {
  featureId: WatanyCanonicalFeatureId;
  engine: WatanyGuideEngineKind;
  intent: WatanyFeatureGuideIntent;
  titleAr: string;
  bodyAr: string;
  primaryRoute: string;
  ctaLabelAr: string;
  cancelLabelAr?: string;
  laterLabelAr?: string;
  dontShowLabelAr?: string;
};

export function createWatanyFeatureGuideCard(
  featureId: WatanyCanonicalFeatureId,
  engine: WatanyGuideEngineKind,
  intent: WatanyFeatureGuideIntent,
): WatanyFeatureGuideCard {
  const feature: WatanyCanonicalFeature = getWatanyCanonicalFeature(featureId);
  return {
    featureId,
    engine,
    intent,
    titleAr: feature.titleAr,
    bodyAr: feature.shortDescriptionAr,
    primaryRoute: feature.primaryRoute,
    ctaLabelAr: '\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629',
    cancelLabelAr: '\u0625\u0644\u063a\u0627\u0621',
    laterLabelAr: '\u0630\u0643\u0631\u0646\u064a \u0644\u0627\u062d\u0642\u0627\u064b',
    dontShowLabelAr: '\u0644\u0627 \u062a\u0638\u0647\u0631 \u0645\u062c\u062f\u062f\u0627\u064b',
  };
}

export function createWatanyPreLandingCardForRoute(route: string): WatanyFeatureGuideCard {
  const featureId = getWatanyFeatureIdForRoute(route);
  return createWatanyFeatureGuideCard(featureId, 'preLanding', 'pre_landing');
}

export function getWatanyGuideMemoryKey(featureId: WatanyCanonicalFeatureId, engine: WatanyGuideEngineKind): string {
  return `watany:guided-help:v2:feature:${featureId}:engine:${engine}`;
}

export function getWatanyGuideRouteMemoryKey(route: string, engine: WatanyGuideEngineKind): string {
  const featureId = getWatanyFeatureIdForRoute(route);
  const normalizedRoute = normalizeWatanyGuideRoute(route);
  return `${getWatanyGuideMemoryKey(featureId, engine)}:route:${normalizedRoute}`;
}