import { describe, expect, it } from "vitest";
import { inferLegalCategoryFromHit, mapSearchHitToLegalDocument } from "./KoudamaLegalLibrarySearchPage";

describe("KoudamaLegalLibrarySearchPage", () => {
  it("classifies law and decree hits into deterministic categories", () => {
    expect(inferLegalCategoryFromHit({
      source: "law_nodes",
      id: "law-1",
      title: "قانون التقاعد",
      body: "قانون — 12 مادة — أحكام التقاعد العامة",
      domain: "pension",
      score: 1,
    })).toBe("laws");

    expect(inferLegalCategoryFromHit({
      source: "law_nodes",
      id: "decree-1",
      title: "مرسوم التعويضات",
      body: "مرسوم — 8 مواد — تنظيم التعويضات",
      domain: "benefits",
      score: 1,
    })).toBe("decrees");
  });

  it("maps legal search hits to in-page legal doc endpoints", () => {
    const mapped = mapSearchHitToLegalDocument({
      source: "law_nodes",
      id: "law-rabita-001",
      title: "النظام الأساسي للرابطة",
      body: "قانون — 15 مادة — المواد الناظمة لعمل الرابطة",
      domain: "rabita",
      score: 1,
    });

    expect(mapped.title).toBe("النظام الأساسي للرابطة");
    expect(mapped.category).toBe("laws");
    expect(mapped.endpoint).toBe("/legal?tab=laws&doc=law-rabita-001");
    expect(mapped.keywords.length).toBeGreaterThan(0);
  });
});
