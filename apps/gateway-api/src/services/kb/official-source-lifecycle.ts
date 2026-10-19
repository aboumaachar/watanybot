import { REVIEWED_PROCEDURAL_CLAIMS, type ReviewedProceduralClaim } from "./official-claim-ledger";

/** Advisory lifecycle only. Neither a matched snapshot nor HTTP 200 renews an approval. */
export type ReviewState = "current" | "due_soon" | "expired" | "invalid";
export type SnapshotState = "not_checked" | "excerpt_present" | "excerpt_missing" | "fetch_failed" | "source_mismatch";
export type SourceSnapshot = {
  sourceId: string;
  sourceUrl: string;
  /** Previously retrieved visible text of the official page, NOT untrusted HTML. */
  plainText?: string;
  retrievalSucceeded: boolean;
};
export type OfficialSourceReview = {
  claimId: string;
  sourceId: string;
  sourceUrl: string;
  reviewedAt: string;
  reviewValidThrough: string;
  reviewState: ReviewState;
  snapshotState: SnapshotState;
  requiresHumanReview: boolean;
};

const DAY_MS = 86400000;

function validDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function getReviewState(claim: ReviewedProceduralClaim, now: Date = new Date()): ReviewState {
  const start = validDay(claim.reviewedAt);
  const until = validDay(claim.reviewValidThrough);
  const time = now.getTime();
  if (start === null || until === null || start > until || !Number.isFinite(time)) return "invalid";
  const today = validDay(now.toISOString().slice(0, 10));
  if (today === null || today < start) return "invalid";
  if (today > until) return "expired";
  return until - today <= 7 * DAY_MS ? "due_soon" : "current";
}

function normalizeExcerpt(text: string): string {
  return text.normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();
}

export function reviewOfficialSources(
  now: Date = new Date(),
  snapshots: readonly SourceSnapshot[] = [],
  claims: readonly ReviewedProceduralClaim[] = REVIEWED_PROCEDURAL_CLAIMS,
): OfficialSourceReview[] {
  return claims.map((claim) => {
    const matching = snapshots.filter((snapshot) => snapshot.sourceId === claim.sourceId);
    const snapshot = matching.length === 1 ? matching[0] : undefined;
    let snapshotState: SnapshotState = "not_checked";
    if (matching.length > 1 || (snapshot && snapshot.sourceUrl !== claim.sourceUrl)) {
      snapshotState = "source_mismatch";
    } else if (snapshot && !snapshot.retrievalSucceeded) {
      snapshotState = "fetch_failed";
    } else if (snapshot) {
      const page = normalizeExcerpt(snapshot.plainText || "");
      const excerpt = normalizeExcerpt(claim.evidenceExcerpt);
      snapshotState = excerpt && page.includes(excerpt) ? "excerpt_present" : "excerpt_missing";
    }
    const reviewState = getReviewState(claim, now);
    return {
      claimId: claim.id,
      sourceId: claim.sourceId,
      sourceUrl: claim.sourceUrl,
      reviewedAt: claim.reviewedAt,
      reviewValidThrough: claim.reviewValidThrough,
      reviewState,
      snapshotState,
      // A successful text match still needs authorized human source review before renewed approval.
      requiresHumanReview: reviewState !== "current" || snapshotState !== "not_checked",
    };
  });
}

export function summarizeOfficialSourceReviews(reviews: readonly OfficialSourceReview[]) {
  return {
    total: reviews.length,
    current: reviews.filter((item) => item.reviewState === "current").length,
    dueSoon: reviews.filter((item) => item.reviewState === "due_soon").length,
    expired: reviews.filter((item) => item.reviewState === "expired").length,
    invalid: reviews.filter((item) => item.reviewState === "invalid").length,
    attention: reviews.filter((item) => item.requiresHumanReview).length,
  };
}
