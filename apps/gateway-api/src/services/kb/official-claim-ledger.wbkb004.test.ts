import { describe, expect, it } from "vitest";
import { assessProceduralClaim, getSourceCheckedClaims, REVIEWED_PROCEDURAL_CLAIMS } from "./official-claim-ledger";
import { searchKbLive } from "./kb-search.service";
import { runHybridKbChat } from "../chat/hybrid-chat.service";
import type { LiveSearchDocumentResult } from "./kb-search.service";

const reviewedDate = new Date("2026-10-16T12:00:00Z");
const expiryDay = new Date("2026-11-16T01:00:00Z");

function asSource(claim = REVIEWED_PROCEDURAL_CLAIMS[0]): LiveSearchDocumentResult {
  return { id: claim.sourceId, title: "مصدر رسمي محدود", sourceUrl: claim.sourceUrl, referenceTier: "curated_official",
    score: 85, sourceType: "procedure", tags: [] };
}

describe("WB-KB-004 closed-set source/excerpt claims — local proof only", () => {
  it.each(REVIEWED_PROCEDURAL_CLAIMS)("checks exact curated source & approved statement for $id", (claim) => {
    const result = assessProceduralClaim(claim.textAr, asSource(claim), reviewedDate);
    expect(result).toEqual({ status: "source_checked", reason: "EXACT_SOURCE_AND_STATEMENT", claim });
    expect(claim.evidenceExcerpt.length).toBeGreaterThan(8);
    expect(claim.textAr.length).toBeGreaterThan(20);
  });

  it("rejects a fabricated or semantically similar statement; word overlap is not source proof", () => {
    const source = asSource();
    const original = REVIEWED_PROCEDURAL_CLAIMS[0].textAr;
    expect(assessProceduralClaim(original + " وتزداد المعاشات ثلاثة أضعاف.", source, reviewedDate)).toMatchObject({
      status: "unverified", reason: "UNREVIEWED_CLAIM",
    });
    expect(assessProceduralClaim("يستحق كل متقاعد معاشاً إضافياً.", source, reviewedDate).status).toBe("unverified");
  });

  it("rejects wrong identity, forged URL and reference tier even if wording matches", () => {
    const claim = REVIEWED_PROCEDURAL_CLAIMS[1];
    const source = asSource(claim);
    for (const altered of [
      { ...source, id: "another-source" },
      { ...source, sourceUrl: "https://www.lebarmy.gov.lb/ar/" },
      { ...source, sourceUrl: "http://www.lebarmy.gov.lb/ar/node/91654" },
      { ...source, referenceTier: "linked_indexed" as const },
    ]) {
      expect(assessProceduralClaim(claim.textAr, altered, reviewedDate)).toMatchObject({
        status: "unverified", reason: "SOURCE_MISMATCH",
      });
    }
  });

  it("fails closed after source-review expiry and for invalid or predating review dates", () => {
    const claim = REVIEWED_PROCEDURAL_CLAIMS[2];
    const source = asSource(claim);
    expect(assessProceduralClaim(claim.textAr, source, new Date("2026-11-15T23:59:59Z")).status).toBe("source_checked");
    expect(assessProceduralClaim(claim.textAr, source, expiryDay)).toMatchObject({
      status: "stale", reason: "REVIEW_EXPIRED",
    });
    expect(assessProceduralClaim(claim.textAr, source, new Date("2026-10-15T12:00:00Z")).status).toBe("stale");
    expect(assessProceduralClaim(claim.textAr, source, new Date("bad")).status).toBe("unverified");
  });

  it("does not promote a source from a different topic or a mismatched duplicate", () => {
    const pension = REVIEWED_PROCEDURAL_CLAIMS[0];
    const different = asSource(REVIEWED_PROCEDURAL_CLAIMS[3]);
    expect(assessProceduralClaim(pension.textAr, different, reviewedDate).status).toBe("unverified");
    expect(getSourceCheckedClaims([different], reviewedDate).map((c) => c.id)).toEqual([REVIEWED_PROCEDURAL_CLAIMS[3].id]);
    expect(getSourceCheckedClaims([asSource(pension), asSource(pension)], reviewedDate)).toHaveLength(1);
  });
});

const realQuestions = [
  ["pension service", "كيف أحصل على إفادة معاش التقاعد؟", "finance.pension.service"],
  ["retirement form", "ما مستندات طلب نسخة عن مستند التسريح أو الإحالة على التقاعد؟", "army.retirement.copy.request"],
  ["school form", "ما مستندات تسوية أوراق مدرسية؟", "army.school.settlement.request"],
  ["overdue school aid", "ما مستندات المساعدات المدرسية المتأخرة؟", "army.school.overdue.request"],
  ["medical declaration", "ما مستندات تصريح الاستفادة من الطبابة؟", "army.medical.declaration.request"],
] as const;

describe("WB-KB-004 local response generation from real indexed records", () => {
  it.each(realQuestions)("shows only source-checked procedural statement for $0", async (_, query, id) => {
    const res = await runHybridKbChat({ message: query });
    const checked = res.sourceCheckedClaims || [];
    expect(checked.some((c) => c.id === id)).toBe(true);
    const claim = checked.find((c) => c.id === id)!;
    expect(res.sources.some((s) => s.id === claim.sourceId && s.sourceUrl === claim.sourceUrl)).toBe(true);
    expect(res.answer).toContain(claim.textAr);
    expect(res.answer).toContain("معلومات إجرائية محدودة");
    expect(res.answer).not.toMatch(/زيادة المعاش (?:3|ثلاثة) أضعاف/);
  });

  it("does not produce a procedural fact for a legal-pension entitlement question without legal text", async () => {
    const res = await runHybridKbChat({ message: "ما هي شروط استحقاق معاش التقاعد؟" });
    expect(res.mode).toBe("clarification-required");
    expect(res.sourceCheckedClaims).toEqual([]);
    expect(res.sources).toEqual([]);
    expect(res.answer).toContain("لا أستطيع تأكيد الشروط");
  });

  it("leaves underspecified transactions unverified and asks what transaction the user needs", async () => {
    const res = await runHybridKbChat({ message: "ما هي المستندات اللازمة للمعاملة؟" });
    expect(res.mode).toBe("clarification-required");
    expect(res.sourceCheckedClaims).toEqual([]);
    expect(res.answer).toContain("أي معاملة تقصد");
  });

  it("makes no claim about arbitrary uncurated index results", async () => {
    const result = await searchKbLive("كيف أقدم طلب الخدمة؟", { limit: 8 });
    expect(getSourceCheckedClaims(result.documents.filter((s) => s.referenceTier !== "curated_official"), reviewedDate)).toEqual([]);
  });
});
