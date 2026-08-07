import { describe, expect, it } from "vitest";

import { normalizeSearchableArabicInput } from "./lang";

describe("normalizeSearchableArabicInput", () => {
  it("preserves retirement intent for exact Arabizi salary phrases", () => {
    expect(normalizeSearchableArabicInput("ma3ash ta2aod")).toContain("تقاعد");
    expect(normalizeSearchableArabicInput("ma3ash ta2aod")).toContain("معاش");
  });

  it("normalizes school grant Arabizi phrases into searchable Arabic tokens", () => {
    expect(normalizeSearchableArabicInput("man7a madrasiyye")).toBe("منحه مدرسيه");
  });

  it("normalizes recruitment Arabizi phrases without dropping the army signal", () => {
    const normalized = normalizeSearchableArabicInput("tatwi3 bel jesh");
    expect(normalized).toContain("تطويع");
    expect(normalized).toContain("جيش");
  });
});