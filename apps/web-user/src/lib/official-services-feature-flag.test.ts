import { describe, expect, it } from "vitest";

import { FEATURES, defaultFeatureFlags } from "@watany/shared/features";

import { resolveFeatureGate } from "./feature-gates";
import { SERVICE_CATEGORIES } from "./service-catalog";

describe("official services feature flag wiring", () => {
  it("publishes govservices in shared metadata and defaults", () => {
    const feature = FEATURES.find((entry) => entry.id === "govservices");
    const defaults = defaultFeatureFlags();

    expect(feature).toMatchObject({
      id: "govservices",
      label: "الخدمات الرسمية السريعة",
      canDisable: true,
    });
    expect(defaults.govservices).toBe(true);
  });

  it("keeps the official services tile bound to govservices", () => {
    const assistantCategory = SERVICE_CATEGORIES.find((category) => category.id === "assistant");
    const officialServicesTile = assistantCategory?.tiles.find((tile) => tile.id === "official-services");

    expect(officialServicesTile).toMatchObject({
      id: "official-services",
      featureId: "govservices",
      action: { kind: "route", path: "/services/official" },
    });
  });

  it("redirects disabled govservices routes back to services from the shell gate", () => {
    const resolution = resolveFeatureGate("govservices", {
      isHydrated: true,
      isEnabled: (feature) => feature !== "govservices",
    });

    expect(resolution).toEqual({ kind: "redirect", to: "/services" });
  });
});