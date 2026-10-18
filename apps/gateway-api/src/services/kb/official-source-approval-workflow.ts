import { createHash } from "node:crypto";
import { evaluateHumanReview, type ReviewAuditCandidate, type ReviewDecision, type TrustedReviewer } from "./official-source-human-review";
import type { OfficialFetchResult } from "./official-source-fetch";

/**
 * WB-KB-005C application-local adapter contract — not a route and not an auth provider.
 * Real authenticated identity resolution and immutable DB storage require independent
 * protected security review and cannot be inferred from passing mocked adapter tests.
 *
 * The incoming request never contains a reviewer identity, role or clearance flag.
 */
export interface TrustedReviewerResolver {
  resolveFromProtectedContext(): Promise<TrustedReviewer | null>;
}
export type PendingReviewRecord = {
  candidate: ReviewAuditCandidate;
  candidateSha256: string;
  persistedAs: "PENDING_UNPUBLISHED";
};
export interface PendingReviewAuditStore {
  /** Must be a durable insert-only transaction with idempotency enforcement in a real integration. */
  appendPending(record: PendingReviewRecord): Promise<{ auditId: string }>;
  /** Must read back the committed row from an independent connection in a real integration. */
  readCommitted(auditId: string): Promise<PendingReviewRecord | null>;
}

export type ReviewWorkflowResult =
  | { status: "pending_external_release"; published: false; auditId: string; candidateSha256: string }
  | { status: "blocked"; published: false; reason: string };

export async function prepareGovernedReview(
  input: { evidence: OfficialFetchResult; claimId: string; decision: ReviewDecision; rationale: string; decidedAt?: Date },
  adapters: { resolver?: TrustedReviewerResolver; auditStore?: PendingReviewAuditStore },
): Promise<ReviewWorkflowResult> {
  const blocked = (reason: string): ReviewWorkflowResult => ({ status: "blocked", published: false, reason });
  if (!adapters.resolver || !adapters.auditStore) return blocked("INDEPENDENT_SECURITY_ADAPTERS_NOT_CONNECTED");
  let reviewer: TrustedReviewer | null;
  try { reviewer = await adapters.resolver.resolveFromProtectedContext(); }
  catch { return blocked("REVIEWER_RESOLUTION_FAILED"); }
  if (!reviewer || !reviewer.independentlyVerified || reviewer.authority !== "kb.source.review") {
    return blocked("REVIEWER_NOT_INDEPENDENTLY_AUTHORIZED");
  }
  const evaluated = evaluateHumanReview(input.evidence, {
    claimId: input.claimId, decision: input.decision, rationale: input.rationale,
    reviewer, decidedAt: input.decidedAt,
  });
  if (evaluated.status !== "draft_recorded") return blocked(evaluated.reason);
  const candidate = evaluated.auditCandidate;
  // Canonical record hash is a tamper-evidence comparison, NOT a replacement for immutable storage.
  const record: PendingReviewRecord = {
    candidate,
    candidateSha256: createHash("sha256").update(JSON.stringify(candidate), "utf8").digest("hex"),
    persistedAs: "PENDING_UNPUBLISHED",
  };
  let auditId: string;
  try {
    const receipt = await adapters.auditStore.appendPending(record);
    if (!receipt || typeof receipt.auditId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(receipt.auditId)) {
      return blocked("INVALID_AUDIT_RECEIPT");
    }
    auditId = receipt.auditId;
  } catch { return blocked("AUDIT_APPEND_FAILED"); }
  let committed: PendingReviewRecord | null;
  try { committed = await adapters.auditStore.readCommitted(auditId); }
  catch { return blocked("AUDIT_READBACK_FAILED"); }
  if (!committed || committed.persistedAs !== "PENDING_UNPUBLISHED" ||
      committed.candidateSha256 !== record.candidateSha256 ||
      createHash("sha256").update(JSON.stringify(committed.candidate), "utf8").digest("hex") !== record.candidateSha256) {
    return blocked("AUDIT_READBACK_MISMATCH");
  }
  // A readback only demonstrates a current matching row; immutable storage remains UNVERIFIED.
  return { status: "pending_external_release", published: false, auditId, candidateSha256: record.candidateSha256 };
}
