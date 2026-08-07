import type { FeatureId } from "../store/features";

export type FeatureGateResolution =
  | { kind: "loading" }
  | { kind: "redirect"; to: "/services" }
  | { kind: "allow" };

export function resolveFeatureGate(
  feature: FeatureId,
  options: Readonly<{ isHydrated: boolean; isEnabled: (feature: FeatureId) => boolean }>,
): FeatureGateResolution {
  if (!options.isHydrated) {
    return { kind: "loading" };
  }

  if (!options.isEnabled(feature)) {
    return { kind: "redirect", to: "/services" };
  }

  return { kind: "allow" };
}