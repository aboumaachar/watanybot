import { createHash } from "node:crypto";
import { REVIEWED_PROCEDURAL_CLAIMS } from "./official-claim-ledger";
import type { OfficialFetchResult } from "./official-source-fetch";

/**
 * Review event is a candidate audit record, NOT a published approval.
 * Production caller must supply independently authenticated / authorized identity
 * and separately persist immutable audit evidence (not implemented in this module).
 */
export type ReviewDecision = "approve_unchanged" | "reject" | "investigate";
export type TrustedReviewer = {
  accountId: string;
  authority: "kb.source.review";
  independentlyVerified: boolean;
};
export type ReviewAuditCandidate = {
  claimId: string;
  sourceId: string;
  sourceUrl: string;
  snapshotSha256: string;
  decision: ReviewDecision;
  reviewerId: string;
  decidedAt: string;
  rationale: string;
  publishState: "PENDING_INDEPENDENT_RELEASE" | "REJECTED" | "NEEDS_INVESTIGATION";
  originalReviewValidThrough: string;
};

export type ReviewOutcome =
  | { status: "draft_recorded"; auditCandidate: ReviewAuditCandidate; published: false; }
  | { status: "rejected"; reason: string; published: false; };

export function evaluateHumanReview(
  result: OfficialFetchResult,
  choice: {
    claimId: string;
    decision: ReviewDecision;
    rationale: string;
    reviewer: TrustedReviewer;
    decidedAt?: Date;
  },
): ReviewOutcome {
  const claim = REVIEWED_PROCEDURAL_CLAIMS.find((item) => item.id === choice.claimId);
  if (!claim || claim.sourceId !== result.sourceId || claim.sourceUrl !== result.sourceUrl) {
    return { status: "rejected", reason: "UNKNOWN_OR_MISMATCHED_CLAIM", published: false };
  }
  if (!choice.reviewer.independentlyVerified || choice.reviewer.authority !== "kb.source.review" ||
      !/^[a-zA-Z0-9_.@-]{3,128}$/.test(choice.reviewer.accountId)) {
    return { status: "rejected", reason: "REVIEWER_AUTHORITY_UNVERIFIED", published: false };
  }
  if (choice.rationale.trim().length < 20 || choice.rationale.trim().length > 1000) {
    return { status: "rejected", reason: "RATIONALE_REQUIRED", published: false };
  }
  const decidedAt = choice.decidedAt ?? new Date();
  if (!Number.isFinite(decidedAt.getTime())) {
    return { status: "rejected", reason: "INVALID_DECISION_TIME", published: false };
  }
  if (result.status !== "snapshot_ready" || !result.snapshot?.retrievalSucceeded ||
      result.snapshot.sourceId !== claim.sourceId || result.snapshot.sourceUrl !== claim.sourceUrl ||
      !/^[a-f0-9]{64}$/.test(result.textSha256 || "") ||
      !result.snapshot.plainText ||
      createHash("sha256").update(result.snapshot.plainText, "utf8").digest("hex") !== result.textSha256) {
    return { status: "rejected", reason: "SNAPSHOT_EVIDENCE_UNVERIFIED", published: false };
  }
  const associated = result.reviews.filter((item) => item.claimId === claim.id &&
    item.sourceId === claim.sourceId && item.sourceUrl === claim.sourceUrl);
  if (associated.length !== 1) {
    return { status: "rejected", reason: "REVIEW_RECORD_NOT_UNIQUE", published: false };
  }
  const review = associated[0];
  if (choice.decision === "approve_unchanged" && review.snapshotState !== "excerpt_present") {
    return { status: "rejected", reason: "EXCERPT_CHANGE_REQUIRES_NEW_CLAIM_REVIEW", published: false };
  }
  const publishState = choice.decision === "approve_unchanged"
    ? "PENDING_INDEPENDENT_RELEASE"
    : choice.decision === "reject" ? "REJECTED" : "NEEDS_INVESTIGATION";
  return {
    status: "draft_recorded",
    published: false,
    auditCandidate: {
      claimId: claim.id, sourceId: claim.sourceId, sourceUrl: claim.sourceUrl,
      snapshotSha256: result.textSha256,
      decision: choice.decision,
      reviewerId: choice.reviewer.accountId,
      decidedAt: decidedAt.toISOString(),
      rationale: choice.rationale.trim(),
      publishState,
      originalReviewValidThrough: claim.reviewValidThrough,
    },
  };
}
