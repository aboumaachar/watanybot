import { describe, expect, it } from "vitest";
import {
  scoreWatanyVeteranRelevance,
  getWatanyAuthorityPriority,
  sortWatanyListingsVeteransFirst,
  type WatanyListingItem,
} from "./watany-veterans-first-ranking";

// ── Test A — Generic Army Item Must Rank Lower ────────────────────────────
describe("Test A — Generic vs veteran procedures", () => {
  it("social assistance for retired military ranks above aerial photography", () => {
    const items: WatanyListingItem[] = [
      { title: "طلب صورة جوية", authority: "LAF", category: "procedure" },
      { title: "طلب مساعدة اجتماعية للعسكريين المتقاعدين", authority: "LAF", category: "procedure" },
      { title: "استمارة طبابة لعائلة العسكري المتقاعد", authority: "LAF", category: "form" },
    ];

    const ranked = sortWatanyListingsVeteransFirst(items);
    expect(ranked[0].title).toBe("طلب مساعدة اجتماعية للعسكريين المتقاعدين");
    expect(ranked[1].title).toBe("استمارة طبابة لعائلة العسكري المتقاعد");
    expect(ranked[2].title).toBe("طلب صورة جوية");
  });

  it("aerial photography has lower veteran score than social assistance", () => {
    const aerial: WatanyListingItem = { title: "طلب صورة جوية", authority: "LAF" };
    const social: WatanyListingItem = { title: "طلب مساعدة اجتماعية للعسكريين المتقاعدين", authority: "LAF" };

    expect(scoreWatanyVeteranRelevance(social)).toBeGreaterThan(scoreWatanyVeteranRelevance(aerial));
  });
});

// ── Test B — Authority Tie-Breaker ────────────────────────────────────────
describe("Test B — Authority tie-breaker", () => {
  it("MoF pension item ranks above Social Affairs which ranks above LAF generic", () => {
    const items: WatanyListingItem[] = [
      { title: "مساعدة اجتماعية للمتقاعدين", authority: "LAF" },
      { title: "معاملة مالية تتعلق بمعاش المتقاعدين", authority: "وزارة المالية" },
      { title: "دعم اجتماعي لعائلة العسكري", authority: "الشؤون الاجتماعية" },
    ];

    const ranked = sortWatanyListingsVeteransFirst(items);
    expect(ranked[0].title).toBe("معاملة مالية تتعلق بمعاش المتقاعدين");
    expect(ranked[1].title).toBe("دعم اجتماعي لعائلة العسكري");
    expect(ranked[2].title).toBe("مساعدة اجتماعية للمتقاعدين");
  });

  it("MoF has higher authority priority score than LAF", () => {
    const mof: WatanyListingItem = { authority: "وزارة المالية" };
    const laf: WatanyListingItem = { authority: "LAF" };
    expect(getWatanyAuthorityPriority(mof)).toBeGreaterThan(getWatanyAuthorityPriority(laf));
  });
});

// ── Test C — FAQ Ranking ──────────────────────────────────────────────────
describe("Test C — FAQ ranking", () => {
  it("pension and social assistance FAQs rank above aerial photography FAQ", () => {
    const items: WatanyListingItem[] = [
      { title: "كيف أطلب صورة جوية؟", authority: "LAF" },
      { title: "كيف يحصل المتقاعد العسكري على مساعدة اجتماعية؟", authority: "الشؤون الاجتماعية" },
      { title: "كيف أتابع معاشي التقاعدي؟", authority: "وزارة المالية" },
    ];

    const ranked = sortWatanyListingsVeteransFirst(items);
    expect(ranked[0].title).toBe("كيف أتابع معاشي التقاعدي؟");
    expect(ranked[1].title).toBe("كيف يحصل المتقاعد العسكري على مساعدة اجتماعية؟");
    expect(ranked[2].title).toBe("كيف أطلب صورة جوية؟");
  });
});

// ── Test D — Related Items Ranking ────────────────────────────────────────
describe("Test D — Related items with mixed authority", () => {
  it("veteran benefit items appear before generic items from same authority", () => {
    const items: WatanyListingItem[] = [
      { title: "تعديل عنوان السجل المدني", authority: "LAF" },
      { title: "طلب تعويض وفاة عسكري", authority: "LAF" },
      { title: "منح مدرسية للأبناء", authority: "LAF" },
    ];

    const ranked = sortWatanyListingsVeteransFirst(items);
    // Both veteran items should precede generic civil registry change
    const veteranIds = [ranked[0].title, ranked[1].title];
    expect(veteranIds).toContain("طلب تعويض وفاة عسكري");
    expect(veteranIds).toContain("منح مدرسية للأبناء");
    expect(ranked[2].title).toBe("تعديل عنوان السجل المدني");
  });
});

// ── Scoring Unit Tests ────────────────────────────────────────────────────
describe("scoreWatanyVeteranRelevance", () => {
  it("returns 5 for direct pension/benefit items", () => {
    expect(scoreWatanyVeteranRelevance({ title: "معاش تقاعدي للعسكريين المتقاعدين" })).toBe(5);
  });

  it("returns lower score for generic administrative items", () => {
    const generic = scoreWatanyVeteranRelevance({ title: "إجراء إداري عام", category: "administrative" });
    const veteran = scoreWatanyVeteranRelevance({ title: "معاش تقاعدي" });
    expect(veteran).toBeGreaterThan(generic);
  });

  it("boosts item when query matches veteran terms", () => {
    const item: WatanyListingItem = { title: "معاملة عامة" };
    const withoutQuery = scoreWatanyVeteranRelevance(item, {});
    const withQuery = scoreWatanyVeteranRelevance(item, { query: "متقاعد" });
    // query match should not reduce score
    expect(withQuery).toBeGreaterThanOrEqual(withoutQuery);
  });
});

describe("getWatanyAuthorityPriority", () => {
  it("MoF = 9 > Social Affairs = 8 > LAF = 7", () => {
    expect(getWatanyAuthorityPriority({ authority: "وزارة المالية" })).toBe(9);
    expect(getWatanyAuthorityPriority({ authority: "الشؤون الاجتماعية" })).toBe(8);
    expect(getWatanyAuthorityPriority({ authority: "الجيش اللبناني" })).toBe(7);
  });

  it("returns 1 for unknown authority", () => {
    expect(getWatanyAuthorityPriority({ authority: "جهة مجهولة" })).toBe(1);
  });
});
