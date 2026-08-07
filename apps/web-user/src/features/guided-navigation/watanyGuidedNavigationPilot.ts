import {
  findWatanyFeatureByRoute,
  getWatanyFeatureGraphPilotEntries,
  isWatanyFeatureRoutePilotEligible,
  normalizeWatanyFeatureRoute,
  type WatanyFeatureGraphEntry,
} from '../feature-graph/watanyFeatureGraph.readonly';

export type WatanyGuidedNavigationPilotRoute = '/salary' | '/procedures' | '/school-grants';

export type WatanyGuidedNavigationPilotDecision = Readonly<{
  allowed: boolean;
  normalizedRoute: string;
  route: WatanyGuidedNavigationPilotRoute | null;
  feature: WatanyFeatureGraphEntry | null;
  reason: 'pilot-route' | 'not-pilot-route';
}>;

export const WATANY_GUIDED_NAVIGATION_PILOT_ROUTES = [
  '/salary',
  '/procedures',
  '/school-grants',
] as const satisfies readonly WatanyGuidedNavigationPilotRoute[];

function routePathOnly(route: string): string {
  return route.split('#')[0].split('?')[0] || '/';
}

export function isWatanyGuidedNavigationPilotRoute(route: string): route is WatanyGuidedNavigationPilotRoute {
  const normalizedRoute = routePathOnly(normalizeWatanyFeatureRoute(route));
  return WATANY_GUIDED_NAVIGATION_PILOT_ROUTES.some((pilotRoute) => pilotRoute === normalizedRoute);
}

export function getWatanyGuidedNavigationPilotRoutes(): readonly WatanyGuidedNavigationPilotRoute[] {
  return WATANY_GUIDED_NAVIGATION_PILOT_ROUTES;
}

export function getWatanyGuidedNavigationPilotFeatures(): readonly WatanyFeatureGraphEntry[] {
  return getWatanyFeatureGraphPilotEntries();
}

export function resolveWatanyGuidedNavigationPilot(route: string): WatanyGuidedNavigationPilotDecision {
  const normalizedRoute = normalizeWatanyFeatureRoute(route);
  const routePath = routePathOnly(normalizedRoute);
  const match = findWatanyFeatureByRoute(normalizedRoute);
  const graphEligible = isWatanyFeatureRoutePilotEligible(normalizedRoute);
  const allowlisted = isWatanyGuidedNavigationPilotRoute(routePath);

  if (allowlisted && graphEligible && match) {
    return {
      allowed: true,
      normalizedRoute,
      route: routePath as WatanyGuidedNavigationPilotRoute,
      feature: match.entry,
      reason: 'pilot-route',
    };
  }

  return {
    allowed: false,
    normalizedRoute,
    route: null,
    feature: match ? match.entry : null,
    reason: 'not-pilot-route',
  };
}

export function createWatanyGuidedNavigationPilotEvent(
  route: string,
  label?: string,
): CustomEvent<{
  route: string;
  label?: string;
  pilot: true;
}> {
  const decision = resolveWatanyGuidedNavigationPilot(route);

  return new CustomEvent('watany:guided-navigation-pilot', {
    cancelable: true,
    detail: {
      route: decision.normalizedRoute,
      label,
      pilot: true,
    },
  });
}