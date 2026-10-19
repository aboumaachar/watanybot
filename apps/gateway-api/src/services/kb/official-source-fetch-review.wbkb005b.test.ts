import { describe, expect, it, vi } from "vitest";
import { fetchOfficialSourceOnce, type OfficialFetch } from "./official-source-fetch";
import { REVIEWED_PROCEDURAL_CLAIMS } from "./official-claim-ledger";
import { evaluateHumanReview } from "./official-source-human-review";

const finance = REVIEWED_PROCEDURAL_CLAIMS[0];
const fixedNow = new Date("2026-10-16T12:09:00Z");
const html = "<!doctype html><html><head><script>evil();</script><style>body{display:none}</style></head><body>" +
  "<h1>خدمة إفادة المعاش التقاعدي</h1><div>الإسم وإسم الأب والشهرة ورقم التقاعد</div></body></html>";

function mockHtml(body = html): OfficialFetch {
  return vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
}
async function goodEvidence() {
  return fetchOfficialSourceOnce(finance.sourceId, { fetcher: mockHtml(), now: fixedNow });
}
const verified = { accountId: "synthetic_reviewer_01", authority: "kb.source.review" as const, independentlyVerified: true };
const rationale = "Reviewed the page text against the published reference and retained the original claim.";

describe("WB-KB-005B controlled official source fetch — injected transport, no live calls", () => {
  it("fetches only a registered exact official URL with strict request options", async () => {
    const fetcher = mockHtml();
    const result = await fetchOfficialSourceOnce(finance.sourceId, { fetcher, now: fixedNow });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(finance.sourceUrl, expect.objectContaining({
      method: "GET", redirect: "manual", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
    }));
    expect(result.status).toBe("snapshot_ready");
    expect(result.reason).toBe("EVIDENCE_ONLY_REVIEW_REQUIRED");
    expect(result.textSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.snapshot?.plainText).toContain("رقم التقاعد");
    expect(result.snapshot?.plainText).not.toContain("evil()");
    expect(result.reviews[0]).toMatchObject({ snapshotState: "excerpt_present", requiresHumanReview: true });
    expect(finance.reviewValidThrough).toBe("2026-11-15");
  });
  it.each(["http://127.0.0.1/admin", "https://localhost/private", "wbkb-arbitrary-id", "",
    "https://www.lebarmy.gov.lb/ar/node/91654", "../file", "wbkb-finance-pension-certificate/../../etc/passwd"])(
      "never fetches an arbitrary URL or fake source identity: %s", async (id) => {
        const fetcher = mockHtml();
        const result = await fetchOfficialSourceOnce(id, { fetcher, now: fixedNow });
        expect(result).toMatchObject({ status: "blocked", reason: "NOT_IN_EXACT_ALLOWLIST" });
        expect(fetcher).not.toHaveBeenCalled();
      },
    );
  it.each(REVIEWED_PROCEDURAL_CLAIMS)("restricts the request URL for each reviewed record $id", async (claim) => {
    const fetcher = mockHtml();
    const output = await fetchOfficialSourceOnce(claim.sourceId, { fetcher, now: fixedNow });
    expect(fetcher).toHaveBeenCalledWith(claim.sourceUrl, expect.objectContaining({ redirect: "manual" }));
    expect(output.sourceId).toBe(claim.sourceId);
    expect(output.sourceUrl).toBe(claim.sourceUrl);
    expect(output.status).toBe("snapshot_ready");
  });

  it("rejects redirects, HTTP errors and response URL changes", async () => {
    for (const response of [
      new Response(null, { status: 302, headers: { Location: "https://localhost/internal" } }),
      new Response("failure", { status: 503, headers: { "content-type": "text/plain" } }),
      Object.defineProperty(new Response(html, { headers: { "content-type": "text/html" } }), "url", { value: "https://localhost/evil" }),
    ]) {
      const out = await fetchOfficialSourceOnce(finance.sourceId, { fetcher: async () => response, now: fixedNow });
      expect(out.status).toBe("fetch_failed");
      expect(out.snapshot?.retrievalSucceeded).toBe(false);
    }
  });
  it("rejects unexpected MIME, declared oversize, actual oversize, and invalid UTF-8", async () => {
    const bad = [
      new Response(html, { headers: { "content-type": "application/octet-stream" } }),
      new Response(html, { headers: { "content-type": "text/html", "content-length": "999999999" } }),
      new Response("x".repeat(129 * 1024), { headers: { "content-type": "text/html" } }),
      new Response(new Uint8Array([255, 254, 253]), { headers: { "content-type": "text/plain" } }),
    ];
    for (const response of bad) {
      const output = await fetchOfficialSourceOnce(finance.sourceId, { fetcher: async () => response, now: fixedNow });
      expect(output.status).toBe("fetch_failed");
      expect(output.textSha256).toBeUndefined();
    }
  });
  it("reports text drift without updating approved claims", async () => {
    const out = await fetchOfficialSourceOnce(finance.sourceId, { fetcher: mockHtml("<p>وزارة المالية - صفحة تغيرت بالكامل بما يكفي لتجربة قراءة</p>"), now: fixedNow });
    expect(out.status).toBe("snapshot_ready");
    expect(out.reviews[0]?.snapshotState).toBe("excerpt_missing");
    expect(out.reviews[0]?.requiresHumanReview).toBe(true);
    expect(finance.reviewValidThrough).toBe("2026-11-15");
  });
  it("fails on timeout and unsupported fetch settings without inventing evidence", async () => {
    const timeout = await fetchOfficialSourceOnce(finance.sourceId, {
      fetcher: async (_url, init) => new Promise((_resolve, reject) =>
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true })),
      timeoutMs: 100, now: fixedNow,
    });
    expect(timeout).toMatchObject({ status: "fetch_failed", reason: "FETCH_TIMEOUT" });
    const invalid = await fetchOfficialSourceOnce(finance.sourceId, { fetcher: mockHtml(), timeoutMs: 40000, now: fixedNow });
    expect(invalid.reason).toBe("INVALID_TIMEOUT");
  });
});

describe("WB-KB-005B human-reviewed change proposal — approval NEVER published", () => {
  it("produces only a pending human decision record for unchanged evidence", async () => {
    const evidence = await goodEvidence();
    const decision = evaluateHumanReview(evidence, { claimId: finance.id, decision: "approve_unchanged", reviewer: verified, rationale, decidedAt: fixedNow });
    expect(decision.status).toBe("draft_recorded");
    expect(decision.published).toBe(false);
    if (decision.status === "draft_recorded") {
      expect(decision.auditCandidate).toMatchObject({
        claimId: finance.id, snapshotSha256: evidence.textSha256, reviewerId: verified.accountId,
        originalReviewValidThrough: "2026-11-15", publishState: "PENDING_INDEPENDENT_RELEASE",
      });
    }
    expect(finance.reviewValidThrough).toBe("2026-11-15");
  });
  it("blocks forged, unauthenticated, unauthorized, or malformed reviewer identity", async () => {
    const evidence = await goodEvidence();
    for (const reviewer of [
      { ...verified, independentlyVerified: false },
      { ...verified, authority: "kb.source.read" as never },
      { ...verified, accountId: "" },
    ]) {
      const out = evaluateHumanReview(evidence, { claimId: finance.id, decision: "approve_unchanged", reviewer, rationale });
      expect(out).toMatchObject({ status: "rejected", reason: "REVIEWER_AUTHORITY_UNVERIFIED", published: false });
    }
  });
  it("refuses approval on missing reviewed excerpt; permits only investigation/rejection audit candidates", async () => {
    const changed = await fetchOfficialSourceOnce(finance.sourceId, {
      now: fixedNow, fetcher: mockHtml("<div>تغيّر محتوى الصفحة بالكامل، ولا تظهر الحقول القديمة في هذه النسخة.</div>"),
    });
    const bad = evaluateHumanReview(changed, { claimId: finance.id, decision: "approve_unchanged", reviewer: verified, rationale });
    expect(bad).toMatchObject({ status: "rejected", reason: "EXCERPT_CHANGE_REQUIRES_NEW_CLAIM_REVIEW" });
    const pending = evaluateHumanReview(changed, { claimId: finance.id, decision: "investigate", reviewer: verified, rationale });
    expect(pending.status).toBe("draft_recorded");
    if (pending.status === "draft_recorded") expect(pending.auditCandidate.publishState).toBe("NEEDS_INVESTIGATION");
  });
  it("fails closed on tampered hash or source, mismatched claim and missing rationale", async () => {
    const evidence = await goodEvidence();
    for (const modified of [
      { ...evidence, textSha256: "a".repeat(64) },
      { ...evidence, sourceUrl: "https://example.org/" },
      { ...evidence, status: "fetch_failed" as const },
    ]) {
      expect(evaluateHumanReview(modified, { claimId: finance.id, decision: "approve_unchanged", reviewer: verified, rationale }).status)
        .toBe("rejected");
    }
    expect(evaluateHumanReview(evidence, { claimId: "not-present", decision: "approve_unchanged", reviewer: verified, rationale }).status)
      .toBe("rejected");
    expect(evaluateHumanReview(evidence, { claimId: finance.id, decision: "approve_unchanged", reviewer: verified, rationale: "ok" }).status)
      .toBe("rejected");
  });
});
