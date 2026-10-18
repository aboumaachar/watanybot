import { describe, expect, it } from "vitest";
import { assessAnswerEvidence } from "./chat-claim-evidence";
import { REVIEWED_PROCEDURAL_CLAIMS } from "../services/kb/official-claim-ledger";
import { runHybridKbChat } from "../services/chat/hybrid-chat.service";

const claim = REVIEWED_PROCEDURAL_CLAIMS[0];
const s = { id: claim.sourceId, sourceUrl: claim.sourceUrl, referenceTier: "curated_official" as const };
const when = new Date("2026-10-16T12:30:00Z");

describe("WB-KB-005C shared claim evidence classification — not a claim of whole-answer truth", () => {
  it("recognizes exact reviewed text and never certifies the complete answer", () => {
    const result = assessAnswerEvidence(claim.textAr, [s], when);
    expect(result.status).toBe("limited_claims_checked");
    expect(result.matchedClaimIds).toEqual([claim.id]);
    expect(result.unmatchedNonemptyAnswer).toBe(false);
    expect(result.fullAnswerVerified).toBe(false);
    expect(result.warnings).toContain("WHOLE_ANSWER_NOT_FACTUALLY_CERTIFIED");
  });
  it("refuses an unsupported legal/payment conclusion blended with reviewed text", () => {
    const result = assessAnswerEvidence(claim.textAr + " ويستحق جميع المتقاعدين زيادة ثلاثة أضعاف.", [s], when);
    expect(result.status).toBe("limited_claims_checked");
    expect(result.unmatchedNonemptyAnswer).toBe(true);
    expect(result.fullAnswerVerified).toBe(false);
    expect(result.warnings).toContain("ADDITIONAL_TEXT_NOT_CHECKED");
  });
  it("rejects citations supplied without matching authoritative source identity", () => {
    expect(assessAnswerEvidence(claim.textAr, [], when).status).toBe("no_approved_claims");
    expect(assessAnswerEvidence(claim.textAr, [{ ...s, sourceUrl: "https://example.org/forged" }], when).status).toBe("no_approved_claims");
    expect(assessAnswerEvidence(claim.textAr, [{ ...s, referenceTier: "linked_indexed" }], when).status).toBe("no_approved_claims");
  });
  it("fails closed for expired procedural statements", () => {
    expect(assessAnswerEvidence(claim.textAr, [s], new Date("2026-11-16T00:00:00Z")).status).toBe("no_approved_claims");
  });
  it("keeps the actual Hybrid KB response explicitly uncertified", async () => {
    const response = await runHybridKbChat({ message: "كيف أحصل على إفادة معاش التقاعد؟" });
    expect(response.answerEvidence).toMatchObject({ status: "limited_claims_checked", fullAnswerVerified: false });
    expect(response.answerEvidence?.matchedClaimIds).toContain(claim.id);
    expect(response.answerEvidence?.unmatchedNonemptyAnswer).toBe(true);
  });
  it("marks unanswered legal entitlement as unsupported instead of asserting success", async () => {
    const res = await runHybridKbChat({ message: "ما هي شروط استحقاق معاش التقاعد؟" });
    expect(res.answerEvidence).toMatchObject({ status: "no_approved_claims", fullAnswerVerified: false });
  });
});
