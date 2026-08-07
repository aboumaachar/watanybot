import { describe, expect, it } from "vitest";
import { TOP_HEADER_ICON_ENDPOINT_CONTRACT } from "./menu-endpoint-contract";
import { unifiedPillars } from "../features/unified-pillars/pillar-config";
import { WORLD_CUP_FEATURES } from "../components/worldcup/worldCupFeatures";

function isMeaningfulEndpoint(endpoint: string): boolean {
  const value = String(endpoint || "").trim();
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value === "/") return false;
  if (value.startsWith("/ ")) return false;
  if (/javascript:/i.test(value)) return false;
  return true;
}

describe("menu endpoint smoke", () => {
  it("ensures top header icons have title and meaningful distinct endpoints", () => {
    const endpoints = TOP_HEADER_ICON_ENDPOINT_CONTRACT.map((item) => item.endpoint);

    for (const item of TOP_HEADER_ICON_ENDPOINT_CONTRACT) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(isMeaningfulEndpoint(item.endpoint)).toBe(true);
    }

    expect(new Set(endpoints).size).toBe(endpoints.length);
  });

  it("ensures in-page header menus have title and meaningful distinct endpoints", () => {
    for (const [pillarId, config] of Object.entries(unifiedPillars)) {
      const endpoints = config.navItems.map((item) => item.route);

      for (const item of config.navItems) {
        expect(item.label.trim().length).toBeGreaterThan(0);
        expect(isMeaningfulEndpoint(item.route)).toBe(true);
      }

      expect(new Set(endpoints).size).toBe(
        endpoints.length,
      );
      expect(config.navItems.length).toBeGreaterThan(0);
      expect(pillarId.trim().length).toBeGreaterThan(0);
    }

    const worldCupEndpoints = WORLD_CUP_FEATURES.map((item) => item.path);
    for (const item of WORLD_CUP_FEATURES) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(isMeaningfulEndpoint(item.path)).toBe(true);
    }
    expect(new Set(worldCupEndpoints).size).toBe(worldCupEndpoints.length);
  });
});
