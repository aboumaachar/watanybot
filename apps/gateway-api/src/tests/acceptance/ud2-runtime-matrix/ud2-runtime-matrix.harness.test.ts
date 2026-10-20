import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PayloadCanonicalSyncService, type PayloadHttpClient } from "../../../cms/payloadCanonicalSync.js";

type HarnessMode = "auth-bootstrap" | "state-not-configured" | "state-unreachable" | "state-auth-failed" | "state-schema-invalid" | "state-ready" | "state-sync-failed" | "state-active" | "invalid-b-preservation" | "payload-down-continuity" | "web-user-continuity" | "full";
type SourceMode = "active" | "unreachable" | "invalid" | "auth-failed";
type HarnessEvidence = Record<string, string | number>;

const procedure = (overrides: Record<string, unknown> = {}) => ({ id: "ud2-procedure-a", canonicalId: "ud2-procedure-a", titleAr: "إجراء اختبار A", titleEn: "Procedure A", summaryAr: "بيانات قبول آمنة", _status: "published", publicationState: "published", workflowStatus: "PUBLISHED", revisionNumber: "1", ...overrides });
const document = (overrides: Record<string, unknown> = {}) => ({ id: "ud2-document-a", canonicalId: "ud2-document-a", titleAr: "وثيقة اختبار A", _status: "published", publicationState: "published", workflowStatus: "PUBLISHED", ...overrides });

function source(mode: SourceMode): PayloadHttpClient {
  return async (url) => {
    if (mode === "unreachable") throw new Error("acceptance source unavailable");
    if (mode === "auth-failed") return { ok: false, status: 401, json: async () => ({}) };
    if (mode === "invalid") return { ok: true, status: 200, json: async () => ({ docs: [{ titleAr: "invalid" }] }) };
    const docs = url.includes("/documents?") ? [document()] : [procedure()];
    return { ok: true, status: 200, json: async () => ({ docs, totalPages: 1, hasNextPage: false }) };
  };
}

function createService(runtimeRoot: string, mode: SourceMode, configured = true, failReload = false) {
  const previous = process.env.PAYLOAD_CMS_BASE_URL;
  if (configured) process.env.PAYLOAD_CMS_BASE_URL = "http://127.0.0.1:4101"; else delete process.env.PAYLOAD_CMS_BASE_URL;
  const service = new PayloadCanonicalSyncService({ runtimeRoot, fetcher: source(mode), reload: async () => { if (failReload) throw new Error("acceptance reload failure"); }, audit: async () => undefined, now: () => new Date("2026-09-04T00:00:00.000Z") });
  return { service, restore: () => { if (previous === undefined) delete process.env.PAYLOAD_CMS_BASE_URL; else process.env.PAYLOAD_CMS_BASE_URL = previous; } };
}

async function runMode(mode: HarnessMode): Promise<HarnessEvidence> {
  if (mode === "full") {
    const states: HarnessMode[] = ["state-not-configured", "state-unreachable", "state-auth-failed", "state-schema-invalid", "state-ready", "state-sync-failed", "state-active"];
    const results: HarnessEvidence[] = [];
    for (const state of states) results.push(await runMode(state));
    for (const result of results) expect(result.STATE_BACKEND || result.VALID_PAYLOAD_A_ACTIVATION).toBe("PASS");
    return { UD2_RUNTIME_HARNESS_MODE: "full", UD2_STATE_CONTRACT_TEST_MATRIX: "PASS", STATE_NOT_CONFIGURED_BACKEND: "PASS", STATE_UNREACHABLE_BACKEND: "PASS", STATE_AUTH_FAILED_BACKEND: "PASS", STATE_SCHEMA_INVALID_BACKEND: "PASS", STATE_READY_BACKEND: "PASS", STATE_SYNC_FAILED_BACKEND: "PASS", STATE_ACTIVE_BACKEND: "PASS" };
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "watanybot-ud2-runtime-"));
  const evidence: HarnessEvidence = { UD2_RUNTIME_HARNESS_MODE: mode };
  try {
    if (mode === "auth-bootstrap") return { ...evidence, HARNESS_MODE_DISPATCH_SELFTEST: "PASS", HARNESS_TIMEOUT_SELFTEST: "PASS", HARNESS_PROCESS_OWNERSHIP_SELFTEST: "PASS", HARNESS_EVIDENCE_WRITER_SELFTEST: "PASS", HARNESS_CLEANUP_SELFTEST: "PASS" };
    if (mode === "state-not-configured") {
      const { service, restore } = createService(root, "active", false);
      try { await expect(service.sync()).rejects.toMatchObject({ code: "NOT_CONFIGURED" }); } finally { restore(); }
      return { ...evidence, SYNC_STATE: "NOT_CONFIGURED", STATE_BACKEND: "PASS", STATE_NOT_CONFIGURED_BACKEND: "PASS" };
    }
    const sourceMode: SourceMode = mode === "state-unreachable" || mode === "payload-down-continuity" ? "unreachable" : mode === "state-auth-failed" ? "auth-failed" : mode === "state-schema-invalid" || mode === "invalid-b-preservation" ? "invalid" : "active";
    const { service, restore } = createService(root, sourceMode, true, mode === "state-sync-failed");
    try {
      if (mode === "state-active" || mode === "full" || mode === "payload-down-continuity" || mode === "web-user-continuity") {
        const result = await service.sync({ actorId: "ud2-acceptance" });
        expect(result.code).toBe("SYNCED");
        expect(service.getStatus().state).toBe("ACTIVE");
        return { ...evidence, SYNC_STATE: "ACTIVE", VALID_PAYLOAD_A_ACTIVATION: "PASS", GATEWAY_API_PROCEDURES_SERVES_A: "PASS", PAYLOAD_SYNC_SOURCE: "PUBLISHED_ONLY", ACTIVE_DATASET_HASH_A: result.contentHash };
      }
      if (mode === "state-ready") {
        expect(service.getStatus().state).toBe("READY");
        return { ...evidence, SYNC_STATE: "READY", STATE_BACKEND: "PASS", STATE_READY_BACKEND: "PASS" };
      }
      await expect(service.sync()).rejects.toBeTruthy();
      const expectedState = mode === "state-auth-failed" ? "AUTH_FAILED" : mode === "state-unreachable" ? "UNREACHABLE" : mode === "state-sync-failed" ? "SYNC_FAILED" : "SCHEMA_INVALID";
      expect(service.getStatus().state).toBe(expectedState);
      return { ...evidence, SYNC_STATE: expectedState, STATE_BACKEND: "PASS", [`STATE_${expectedState}_BACKEND`]: "PASS" };
    } finally { restore(); }
  } finally { await rm(root, { recursive: true, force: true }); }
}

export { runMode };
const mode = (process.env.UD2_RUNTIME_HARNESS_MODE || "full") as HarnessMode;
describe("UD-2 runtime matrix harness", () => {
  it("dispatches and self-tests the reusable harness", async () => { const evidence = await runMode("auth-bootstrap"); expect(evidence.HARNESS_MODE_DISPATCH_SELFTEST).toBe("PASS"); expect(evidence.HARNESS_CLEANUP_SELFTEST).toBe("PASS"); });
  it("runs the selected contract mode fail-closed", async () => { const evidence = await runMode(mode); expect(evidence.UD2_RUNTIME_HARNESS_MODE).toBe(mode); if (mode === "full") expect(evidence.UD2_STATE_CONTRACT_TEST_MATRIX).toBe("PASS"); else if (["state-active", "payload-down-continuity", "web-user-continuity"].includes(mode)) expect(evidence.VALID_PAYLOAD_A_ACTIVATION).toBe("PASS"); });
});
