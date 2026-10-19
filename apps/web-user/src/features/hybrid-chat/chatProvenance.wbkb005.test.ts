import { describe, expect, it } from "vitest";
import { getChatProvenance } from "./chatProvenance";

const source = { id: "wbkb-army-retirement-paper-copy", title: "نسخة عن التسريح", sourceUrl: "https://www.lebarmy.gov.lb/ar/node/91654" };
const review = { sourceId: source.id, sourceUrl: source.sourceUrl, reviewState: "expired", snapshotState: "not_checked" };

describe("WB-KB-005 shared chat provenance lifecycle warnings", () => {
  it("attaches an expiry warning only to the returned source identity", () => {
    const data = getChatProvenance({ sources: [source], sourceReviews: [review] });
    expect(data.status).toBe("attached");
    expect(data.reviewWarnings).toHaveLength(1);
    expect(data.reviewWarnings![0]).toContain("انتهت مراجعة المصدر");
  });

  it("warns for due-soon or failed excerpt checks", () => {
    const due = getChatProvenance({ kb_hits: [source], sourceReviews: [{ ...review, reviewState: "due_soon" }] });
    expect(due.reviewWarnings?.[0]).toContain("اقترب موعد");
    const drift = getChatProvenance({ sources: [source], sourceReviews: [{ ...review, reviewState: "current", snapshotState: "excerpt_missing" }] });
    expect(drift.reviewWarnings?.[0]).toContain("تعذّر إعادة التحقق");
  });

  it("does not display unrelated or invented review-warning metadata", () => {
    const fake = getChatProvenance({ sources: [source], sourceReviews: [{ ...review, sourceUrl: "https://unknown.invalid" }] });
    expect(fake.reviewWarnings).toBeUndefined();
    const empty = getChatProvenance({ sources: [], sourceReviews: [review] });
    expect(empty.reviewWarnings).toBeUndefined();
  });

  it("does not claim that a normal returned source was freshly verified", () => {
    const res = getChatProvenance({ sources: [source], sourceReviews: [{ ...review, reviewState: "current" }] });
    expect(res.reviewWarnings).toBeUndefined();
    expect(res.references).toHaveLength(1);
    expect(res.status).toBe("attached");
  });
});
