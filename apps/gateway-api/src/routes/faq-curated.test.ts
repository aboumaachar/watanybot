import { describe, expect, it } from "vitest";
import { projectCuratedFaqs } from "./faq-curated.js";

const approved = {
  reviewStatus: "approved", reviewedBy: "reviewer-1",
  reviewedAt: "2026-10-08T12:00:00.000Z",
  answer: "هذه إجابة رسمية كاملة تستند إلى مصدر معتمد.",
  category: "إجراءات", sourceReferences: ["PROC-1"], tags: ["تقاعد"],
};
function make(id: string, statusPayload: Record<string, unknown> = {}, title = "ما شروط المعاملة؟") {
  return {
    public_id: id, title, published_at: "2026-10-08T13:00:00.000Z",
    payload: { ...approved, ...statusPayload },
  };
}
const sources = new Set(["PROC-1", "PROC-2"]);
describe("R025 curated public FAQ projection — no drafts or stale sources", () => {
  it("only presents human-approved grounded records", () => {
    const rows = [
      make("OK"), make("UNREVIEWED", { reviewStatus: "submitted" }),
      make("NO-REVIEWER", { reviewedBy: null }),
      make("NO-TIME", { reviewedAt: null }),
      make("STALE", { sourceReferences: ["MISSING"] }),
      make("DUPLICATE-SOURCE", { sourceReferences: ["PROC-1", "PROC-1"] }),
      make("EMPTY-ANSWER", { answer: "" }),
      make("UNSAFE-SOURCE", { sourceReferences: [] }),
    ];
    expect(projectCuratedFaqs(rows, sources).latest.map((item) => item.id)).toEqual(["curated-OK"]);
    expect(projectCuratedFaqs(rows, sources).trending).toEqual([]);
  });
  it("orders manually ranked latest and trending deterministically", () => {
    const rows = [
      make("THIRD", { latestRank: 3, trendingRank: 2 }),
      make("FIRST", { latestRank: 1, trendingRank: 1 }),
      make("NORMAL"),
    ];
    const result = projectCuratedFaqs(rows, sources);
    expect(result.latest.map((item) => item.id)).toEqual(["curated-FIRST", "curated-THIRD", "curated-NORMAL"]);
    expect(result.trending.map((item) => item.id)).toEqual(["curated-FIRST", "curated-THIRD"]);
  });
  it("sanitizes ranks and hides editor metadata", () => {
    const result = projectCuratedFaqs([make("OK", { trendingRank: "1", latestRank: -7, secret: "private-field" })], sources);
    expect(result.trending).toEqual([]);
    expect(result.latest[0].latestRank).toBeNull();
    expect(JSON.stringify(result.latest)).not.toContain("secret");
    expect(JSON.stringify(result.latest)).not.toContain("reviewedBy");
  });
  it("applies query and limit to both groups", () => {
    const rows = [make("A", { trendingRank: 3 }, "معاش تقاعد"), make("B", { trendingRank: 1 }, "رخصة سيارة")];
    expect(projectCuratedFaqs(rows, sources, "معاش", 1).latest.map((x) => x.id)).toEqual(["curated-A"]);
    expect(projectCuratedFaqs(rows, sources, "معاش", 1).trending.map((x) => x.id)).toEqual(["curated-A"]);
    expect(projectCuratedFaqs(rows, sources, "لا شيء").latest).toEqual([]);
  });
  it("requires all referenced sources to remain active", () => {
    const rows = [make("MIXED", { sourceReferences: ["PROC-1", "MISSING"] }), make("ACTIVE", { sourceReferences: ["PROC-1", "PROC-2"] })];
    expect(projectCuratedFaqs(rows, sources).latest.map((x) => x.id)).toEqual(["curated-ACTIVE"]);
  });
});
