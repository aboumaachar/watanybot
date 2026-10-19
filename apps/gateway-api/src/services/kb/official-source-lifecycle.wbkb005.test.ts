import { describe, expect, it } from "vitest";
import { REVIEWED_PROCEDURAL_CLAIMS } from "./official-claim-ledger";
import { getReviewState, reviewOfficialSources, summarizeOfficialSourceReviews } from "./official-source-lifecycle";
import { runHybridKbChat } from "../chat/hybrid-chat.service";

const first = REVIEWED_PROCEDURAL_CLAIMS[0];
const entry = {
  sourceId: first.sourceId,
  sourceUrl: first.sourceUrl,
  retrievalSucceeded: true,
  plainText: `محتوى الصفحة: ${first.evidenceExcerpt}. النص هو مقتطف اصطناعي لا شهادة حكومية.`,
} as const;

describe("WB-KB-005 source-review lifecycle without background fetching", () => {
  it("lists all reviewed claims and does not silently extend the source review", () => {
    const reviews = reviewOfficialSources(new Date("2026-10-16T12:00:00Z"));
    expect(reviews).toHaveLength(5);
    expect(reviews.every((r) => r.reviewState === "current" && r.snapshotState === "not_checked")).toBe(true);
    expect(summarizeOfficialSourceReviews(reviews)).toEqual({
      total: 5, current: 5, dueSoon: 0, expired: 0, invalid: 0, attention: 0,
    });
  });

  it.each([
    ["2026-11-07T12:00:00Z", "current"],
    ["2026-11-08T12:00:00Z", "due_soon"],
    ["2026-11-09T12:00:00Z", "due_soon"],
    ["2026-11-15T23:59:59Z", "due_soon"],
    ["2026-11-16T00:00:01Z", "expired"],
    ["2026-10-15T23:59:59Z", "invalid"],
  ] as const)("applies the exact review boundary on %s", (when, expected) => {
    expect(getReviewState(first, new Date(when))).toBe(expected);
  });

  it("requires review if retrieval content matches; a match does not reapprove the record", () => {
    const review = reviewOfficialSources(new Date("2026-11-16"), [entry])[0];
    expect(review).toMatchObject({
      reviewState: "expired", snapshotState: "excerpt_present", requiresHumanReview: true,
      reviewedAt: "2026-10-16", reviewValidThrough: "2026-11-15",
    });
    expect(first.reviewValidThrough).toBe("2026-11-15");
  });

  it("flags page-text drift and denies silent content-approval", () => {
    const result = reviewOfficialSources(new Date("2026-10-16"), [{ ...entry, plainText: "تم تعديل نموذج الخدمة" }]);
    expect(result[0]).toMatchObject({ snapshotState: "excerpt_missing", requiresHumanReview: true });
  });

  it("fails closed for a broken fetch, changed URL and duplicate snapshots", () => {
    expect(reviewOfficialSources(new Date("2026-10-16"), [{ ...entry, retrievalSucceeded: false }])[0].snapshotState)
      .toBe("fetch_failed");
    expect(reviewOfficialSources(new Date("2026-10-16"), [{ ...entry, sourceUrl: "https://example.org" }])[0].snapshotState)
      .toBe("source_mismatch");
    expect(reviewOfficialSources(new Date("2026-10-16"), [entry, entry])[0].snapshotState)
      .toBe("source_mismatch");
  });

  it("rejects invalid or impossible review dates", () => {
    expect(getReviewState(first, new Date("invalid"))).toBe("invalid");
    expect(getReviewState({ ...first, reviewValidThrough: "2026-02-31" })).toBe("invalid");
    expect(getReviewState({ ...first, reviewedAt: "2026-12-01" })).toBe("invalid");
  });

  it("exposes bounded review metadata in the actual local hybrid response", async () => {
    const answer = await runHybridKbChat({ message: "كيف أحصل على إفادة معاش التقاعد؟" });
    expect(answer.sourceCheckedClaims?.map((claim) => claim.sourceId)).toContain(first.sourceId);
    const review = answer.sourceReviews?.find((record) => record.sourceId === first.sourceId);
    expect(review).toMatchObject({ reviewState: "current", snapshotState: "not_checked" });
    expect(answer.answer).toContain("معلومات إجرائية محدودة");
  });

  it("never claims a monitored/automatically refreshed source without supplied snapshots", () => {
    const all = reviewOfficialSources(new Date("2026-11-16"));
    expect(all.every((item) => item.reviewState === "expired" && item.snapshotState === "not_checked")).toBe(true);
    expect(summarizeOfficialSourceReviews(all).expired).toBe(5);
  });
});
