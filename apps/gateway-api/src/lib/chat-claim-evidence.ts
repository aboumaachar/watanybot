import { assessProceduralClaim, REVIEWED_PROCEDURAL_CLAIMS } from "../services/kb/official-claim-ledger";
import type { LiveSearchDocumentResult } from "../services/kb/kb-search.service";

/**
 * Shared backend factual-evidence assessment for any answer producer.
 * This does not replace existing chat routing, auth, or the legacy grounding
 * assessment. It NEVER certifies an entire generated answer as true.
 */
export type AnswerEvidenceReview = {
  status: "limited_claims_checked" | "no_approved_claims";
  matchedClaimIds: string[];
  unmatchedNonemptyAnswer: boolean;
  fullAnswerVerified: false;
  warnings: string[];
};
export function assessAnswerEvidence(
  answer: string,
  sources: readonly Pick<LiveSearchDocumentResult, "id" | "sourceUrl" | "referenceTier">[],
  at: Date = new Date(),
): AnswerEvidenceReview {
  const verified = REVIEWED_PROCEDURAL_CLAIMS.filter((claim) =>
    answer.includes(claim.textAr) &&
    sources.some((source) => assessProceduralClaim(claim.textAr, source, at).status === "source_checked"));
  const matchedClaimIds = verified.map((claim) => claim.id);
  // Remove known exact sentences to spot any additional generated text.
  const unmatched = verified.reduce((text, claim) => text.replace(claim.textAr, ""), answer)
    .replace(/\[[a-z0-9_.-]+\]/gi, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
  const warnings = ["WHOLE_ANSWER_NOT_FACTUALLY_CERTIFIED"];
  if (!matchedClaimIds.length) warnings.push("NO_APPROVED_EXACT_CLAIMS");
  if (unmatched.length) warnings.push("ADDITIONAL_TEXT_NOT_CHECKED");
  return {
    status: matchedClaimIds.length ? "limited_claims_checked" : "no_approved_claims",
    matchedClaimIds,
    unmatchedNonemptyAnswer: Boolean(unmatched.length),
    fullAnswerVerified: false,
    warnings,
  };
}
