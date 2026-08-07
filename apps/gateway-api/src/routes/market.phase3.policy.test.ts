import { describe, expect, it } from "vitest";
import { MARKET_CATEGORIES } from "./market";

describe("market phase3 policy surface", () => {
  it("keeps an other category for guided Arabic fallback", () => {
    expect(MARKET_CATEGORIES.some((category) => category.id === "other" && category.labelAr.includes("او شي تاني"))).toBe(true);
  });

  it("keeps the category list stable enough for UI dropdowns", () => {
    expect(MARKET_CATEGORIES.length).toBeGreaterThanOrEqual(4);
    expect(MARKET_CATEGORIES.every((category) => Boolean(category.id) && Boolean(category.labelAr))).toBe(true);
  });
});