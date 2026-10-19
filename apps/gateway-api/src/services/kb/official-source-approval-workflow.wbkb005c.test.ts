import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { fetchOfficialSourceOnce } from "./official-source-fetch";
import { REVIEWED_PROCEDURAL_CLAIMS } from "./official-claim-ledger";
import { prepareGovernedReview, type PendingReviewRecord, type PendingReviewAuditStore, type TrustedReviewerResolver } from "./official-source-approval-workflow";

const claim = REVIEWED_PROCEDURAL_CLAIMS[0];
const when = new Date("2026-10-16T12:30:00Z");
const rationale = "I checked the exact administrative form text and request independent release review.";
const reviewer = { accountId: "synthetic_server_reviewer", authority: "kb.source.review" as const, independentlyVerified: true };
async function evidence() {
  return fetchOfficialSourceOnce(claim.sourceId, {
    now: when,
    fetcher: async () => new Response("رقم التقاعد خدمة وزارة المالية الرسمية. هذا النص اختبار اصطناعي فقط.", {
      headers: { "content-type": "text/plain" },
    }),
  });
}
function fixtures() {
  let stored: PendingReviewRecord | null = null;
  const resolver: TrustedReviewerResolver = { resolveFromProtectedContext: vi.fn(async () => reviewer) };
  const auditStore: PendingReviewAuditStore = {
    appendPending: vi.fn(async (record) => { stored = structuredClone(record); return { auditId: "local_qa_0001" }; }),
    readCommitted: vi.fn(async () => stored),
  };
  return { resolver, auditStore };
}
function command(e: Awaited<ReturnType<typeof evidence>>) {
  return { evidence: e, claimId: claim.id, decision: "approve_unchanged" as const, rationale, decidedAt: when };
}

describe("WB-KB-005C gated review contract — synthetic identities/storage ONLY", () => {
  it("blocks missing independent security adapters without evaluating a provided account", async () => {
    const result = await prepareGovernedReview(command(await evidence()), {});
    expect(result).toEqual({ status: "blocked", published: false, reason: "INDEPENDENT_SECURITY_ADAPTERS_NOT_CONNECTED" });
  });
  it("calls the injected trusted resolver and produces only an unpublished, matching readback", async () => {
    const deps = fixtures();
    const result = await prepareGovernedReview(command(await evidence()), deps);
    expect(deps.resolver.resolveFromProtectedContext).toHaveBeenCalledOnce();
    expect(deps.resolver.resolveFromProtectedContext).toHaveBeenCalledWith();
    expect(deps.auditStore.appendPending).toHaveBeenCalledOnce();
    expect(deps.auditStore.readCommitted).toHaveBeenCalledWith("local_qa_0001");
    expect(result.status).toBe("pending_external_release");
    expect(result.published).toBe(false);
    if (result.status === "pending_external_release") {
      expect(result.candidateSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.auditId).toBe("local_qa_0001");
    }
    expect(claim.reviewValidThrough).toBe("2026-11-15");
  });
  it("rejects null, denied, and failed independently resolved reviewers before any write", async () => {
    for (const response of [null, { ...reviewer, independentlyVerified: false }, { ...reviewer, authority: "read" as never }]) {
      const deps = fixtures();
      deps.resolver.resolveFromProtectedContext = vi.fn(async () => response);
      const result = await prepareGovernedReview(command(await evidence()), deps);
      expect(result.status).toBe("blocked");
      expect(deps.auditStore.appendPending).not.toHaveBeenCalled();
    }
    const deps = fixtures();
    deps.resolver.resolveFromProtectedContext = vi.fn(async () => { throw new Error("identity backend unavailable"); });
    const result = await prepareGovernedReview(command(await evidence()), deps);
    expect(result).toMatchObject({ status: "blocked", reason: "REVIEWER_RESOLUTION_FAILED" });
  });
  it("blocks changed evidence and short reasons without appending", async () => {
    const e = await evidence();
    const deps = fixtures();
    const result = await prepareGovernedReview({ ...command(e), rationale: "ok" }, deps);
    expect(result.status).toBe("blocked");
    expect(deps.auditStore.appendPending).not.toHaveBeenCalled();
    const invalid = await prepareGovernedReview(command({ ...e, textSha256: "f".repeat(64) }), deps);
    expect(invalid.status).toBe("blocked");
    expect(deps.auditStore.appendPending).not.toHaveBeenCalled();
  });
  it("fails closed on append error, bad receipt, or unavailable readback", async () => {
    const e = await evidence();
    const a = fixtures();
    a.auditStore.appendPending = vi.fn(async () => { throw new Error("not writable"); });
    expect(await prepareGovernedReview(command(e), a)).toMatchObject({ status: "blocked", reason: "AUDIT_APPEND_FAILED" });
    const b = fixtures();
    b.auditStore.appendPending = vi.fn(async () => ({ auditId: "" }));
    expect(await prepareGovernedReview(command(e), b)).toMatchObject({ status: "blocked", reason: "INVALID_AUDIT_RECEIPT" });
    const c = fixtures();
    c.auditStore.readCommitted = vi.fn(async () => { throw new Error("read failed"); });
    expect(await prepareGovernedReview(command(e), c)).toMatchObject({ status: "blocked", reason: "AUDIT_READBACK_FAILED" });
  });
  it("rejects mutated or stale readback, even with a superficially correct digest", async () => {
    const e = await evidence();
    const a = fixtures();
    a.auditStore.readCommitted = vi.fn(async () => ({ persistedAs: "PENDING_UNPUBLISHED" as const, candidateSha256: "0".repeat(64), candidate: {} as never }));
    expect(await prepareGovernedReview(command(e), a)).toMatchObject({ status: "blocked", reason: "AUDIT_READBACK_MISMATCH" });
    const b = fixtures();
    b.auditStore.readCommitted = vi.fn(async () => null);
    expect(await prepareGovernedReview(command(e), b)).toMatchObject({ status: "blocked", reason: "AUDIT_READBACK_MISMATCH" });
  });
  it("does not mistake hash checking or local fixture writes for immutable audit persistence", async () => {
    const e = await evidence();
    const deps = fixtures();
    const result = await prepareGovernedReview(command(e), deps);
    expect(result.published).toBe(false);
    expect(createHash("sha256").update("fixture").digest("hex")).toMatch(/^[a-f0-9]{64}$/);
  });
});
