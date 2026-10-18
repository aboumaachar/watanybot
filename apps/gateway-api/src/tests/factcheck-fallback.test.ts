import { describe, expect, it } from "vitest";
import {
  FACTCHECK_FALLBACK_CAPTURED_AT,
  FACTCHECK_FALLBACK_ITEMS,
  getFactCheckFallbackItems,
} from "../routes/factcheck-fallback";

describe("Fact Check Lebanon degraded snapshot", () => {
  it("preserves bounded official item provenance", () => {
    const items = getFactCheckFallbackItems(5);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(FACTCHECK_FALLBACK_CAPTURED_AT).toBe("2026-10-03T09:15:00.000Z");
    expect(items[0].id).toBe("factcheck:snapshot:234");
    expect(items[0].published_at).toBe(Date.parse("2026-10-02T00:00:00.000Z"));
    expect(items[0].status).toBe("زائف");
    expect(items[0].source_url).toContain("/auth/rumor/234/");
    expect(FACTCHECK_FALLBACK_ITEMS.every((item) => item.source_url.includes("/auth/rumor/"))).toBe(true);
  });
});
