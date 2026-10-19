import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PayloadCanonicalSyncService,
  PayloadSyncError,
  assertInitialActivationCoverage,
  buildPayloadRuntimeCandidate,
  deriveCanonicalSyncState,
  type PayloadHttpClient,
} from "../cms/payloadCanonicalSync.js";

const originalBaseUrl = process.env.PAYLOAD_CMS_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.PAYLOAD_CMS_BASE_URL;
  else process.env.PAYLOAD_CMS_BASE_URL = originalBaseUrl;
});

function payloadResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

function publishedProcedure(canonicalId: string, documentRelations: unknown[] = [], businessIdentifier = canonicalId) {
  return {
    id: `payload-internal-${canonicalId}`,
    canonicalId,
    businessIdentifier,
    titleAr: `إجراء ${canonicalId}`,
    summaryAr: `ملخص ${canonicalId}`,
    sourceSystem: "P4B",
    publicationState: "published",
    workflowStatus: "PUBLISHED",
    _status: "published",
    documentRelations,
  };
}

function publishedDocument(canonicalId: string, procedureRelations: unknown[] = [], businessIdentifier = canonicalId) {
  return {
    id: `payload-internal-${canonicalId}`,
    canonicalId,
    businessIdentifier,
    titleAr: `وثيقة ${canonicalId}`,
    sourceSystem: "P4B",
    publicationState: "published",
    workflowStatus: "PUBLISHED",
    _status: "published",
    procedureRelations,
  };
}

function runtimeProcedure(id: string) {
  return { id, title_ar: `إجراء ${id}`, summary_lb: `ملخص ${id}` };
}

async function temporaryRuntimeRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "watany-payload-sync-"));
}

describe("Payload canonical sync mapping", () => {
  it("derives every frozen canonical operational state", () => {
    const active = { runId: "run-a", activatedAt: "2026-09-04T00:00:00.000Z", counts: { proceduresFetched: 1, proceduresPublished: 1, documentsFetched: 0, documentsPublished: 0, mappings: 1 }, contentHash: "hash-a" };
    const failed = (errorCode: "UNAVAILABLE" | "AUTH_FAILED" | "PAYLOAD_SYNC_INVALID_DATASET" | "PAYLOAD_SYNC_ACTIVATION_FAILED") => ({ state: "FAILED" as const, runId: "run-b", startedAt: "2026-09-04T00:00:00.000Z", errorCode });
    expect(deriveCanonicalSyncState(false, false, null, null)).toBe("NOT_CONFIGURED");
    expect(deriveCanonicalSyncState(true, false, failed("UNAVAILABLE"), null)).toBe("UNREACHABLE");
    expect(deriveCanonicalSyncState(true, false, failed("AUTH_FAILED"), null)).toBe("AUTH_FAILED");
    expect(deriveCanonicalSyncState(true, false, failed("PAYLOAD_SYNC_INVALID_DATASET"), null)).toBe("SCHEMA_INVALID");
    expect(deriveCanonicalSyncState(true, false, null, null)).toBe("READY");
    expect(deriveCanonicalSyncState(true, false, failed("PAYLOAD_SYNC_ACTIVATION_FAILED"), null)).toBe("SYNC_FAILED");
    expect(deriveCanonicalSyncState(true, false, null, active)).toBe("ACTIVE");
  });

  it("retains active data while later operational failures are reported", () => {
    const active = { runId: "run-a", activatedAt: "2026-09-04T00:00:00.000Z", counts: { proceduresFetched: 1, proceduresPublished: 1, documentsFetched: 0, documentsPublished: 0, mappings: 1 }, contentHash: "hash-a" };
    const failed = (errorCode: "UNAVAILABLE" | "AUTH_FAILED" | "PAYLOAD_SYNC_INVALID_DATASET" | "PAYLOAD_SYNC_ACTIVATION_FAILED") => ({ state: "FAILED" as const, runId: "run-b", startedAt: "2026-09-04T00:00:00.000Z", errorCode });
    expect(deriveCanonicalSyncState(true, false, failed("UNAVAILABLE"), active)).toBe("UNREACHABLE");
    expect(deriveCanonicalSyncState(true, false, failed("AUTH_FAILED"), active)).toBe("AUTH_FAILED");
    expect(deriveCanonicalSyncState(true, false, failed("PAYLOAD_SYNC_INVALID_DATASET"), active)).toBe("SCHEMA_INVALID");
    expect(deriveCanonicalSyncState(true, false, failed("PAYLOAD_SYNC_ACTIVATION_FAILED"), active)).toBe("SYNC_FAILED");
  });

  it("prefers canonicalId over Payload businessIdentifier for records and relations", () => {
    const procedure = publishedProcedure(
      "P4B_REAL_PROCEDURE_A",
      [{ canonicalId: "P4B_REAL_DOCUMENT_A", businessIdentifier: "DOC-0001" }],
      "PROC-0001",
    );
    const document = publishedDocument(
      "P4B_REAL_DOCUMENT_A",
      [{ canonicalId: "P4B_REAL_PROCEDURE_A", businessIdentifier: "PROC-0001" }],
      "DOC-0001",
    );

    const candidate = buildPayloadRuntimeCandidate([procedure], [document]);

    expect(candidate.procedures.map((row) => row.id)).toEqual(["P4B_REAL_PROCEDURE_A"]);
    expect(candidate.documents.map((row) => row.id)).toEqual(["P4B_REAL_DOCUMENT_A"]);
    expect(candidate.mappings).toEqual([
      expect.objectContaining({ procedure_id: "P4B_REAL_PROCEDURE_A", doc_ids: ["P4B_REAL_DOCUMENT_A"] }),
    ]);
  });

  it("maps locale-all Payload fields and preserves the English projection", () => {
    const candidate = buildPayloadRuntimeCandidate([{
      id: "payload-internal-P4B_LOCALIZED",
      canonicalId: "P4B_LOCALIZED",
      title: { ar: "إجراء عربي", en: "English procedure" },
      summary: { ar: "ملخص عربي", en: "English summary" },
      eligibility: { ar: [{ item: "أهلية عربية" }], en: [{ item: "English eligibility" }] },
      steps: { ar: [{ item: "خطوة عربية" }], en: [{ item: "English step" }] },
      sourceSystem: "P4B",
      publicationState: "published",
      workflowStatus: "PUBLISHED",
      _status: "published",
    }], []);

    expect(candidate.procedures[0]).toMatchObject({
      title_ar: "إجراء عربي",
      title_en: "English procedure",
      summary_lb: "ملخص عربي",
      eligibility: ["أهلية عربية"],
      steps: ["خطوة عربية"],
    });
  });

  it("pages collections, filters lifecycle state, preserves IDs, and maps both relation directions", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const runtimeRoot = await temporaryRuntimeRoot();
    const calls: string[] = [];
    const procedurePages = [
      [publishedProcedure("P4B_PROCEDURE_A", [{ businessIdentifier: "P4B_DOCUMENT_A" }])],
      [{ ...publishedProcedure("P4B_PROCEDURE_DRAFT"), publicationState: "draft", workflowStatus: "DRAFT", _status: "draft" }],
    ];
    const documentPages = [[
      publishedDocument("P4B_DOCUMENT_A"),
      publishedDocument("P4B_DOCUMENT_B", [{ businessIdentifier: "P4B_PROCEDURE_A" }]),
      { ...publishedDocument("P4B_DOCUMENT_DRAFT"), publicationState: "draft", workflowStatus: "DRAFT", _status: "draft" },
    ]];
    const fetcher: PayloadHttpClient = async (url) => {
      const parsed = new URL(url);
      const collection = parsed.pathname.split("/").pop() === "procedures" ? "procedures" : "documents";
      const page = Number(parsed.searchParams.get("page"));
      calls.push(url);
      const pages = collection === "procedures" ? procedurePages : documentPages;
      return payloadResponse({
        docs: pages[page - 1] || [],
        page,
        totalPages: pages.length,
        hasNextPage: page < pages.length,
        nextPage: page < pages.length ? page + 1 : null,
      });
    };
    const audits: unknown[] = [];
    const service = new PayloadCanonicalSyncService({
      fetcher,
      runtimeRoot,
      reload: async () => undefined,
      audit: async (event) => { audits.push(event); return event; },
      runtimeCoverage: async () => ({ procedures: [], documents: [], mappings: [] }),
    });

    try {
      const result = await service.sync({ actorId: "test-admin" });
      expect(result.ok).toBe(true);
      expect(result.counts).toMatchObject({
        proceduresFetched: 2,
        proceduresPublished: 1,
        documentsFetched: 3,
        documentsPublished: 2,
        mappings: 1,
      });
      expect(calls.some((url) => url.includes("page=2"))).toBe(true);
      expect(calls.filter((url) => url.includes("/api/procedures?")).every((url) => new URL(url).searchParams.get("locale") === "all")).toBe(true);
      expect(audits.map((event: any) => event.eventType)).toEqual([
        "cms.payload_sync.started",
        "cms.payload_sync.completed",
      ]);

      const active = JSON.parse(await readFile(path.join(runtimeRoot, "active.json"), "utf8"));
      const procedures = (await readFile(path.join(runtimeRoot, active.activeDirectory, "procedures.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
      const documents = (await readFile(path.join(runtimeRoot, active.activeDirectory, "documents.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
      const mappings = (await readFile(path.join(runtimeRoot, active.activeDirectory, "procedure_to_docs.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
      expect(procedures.map((row: any) => row.id)).toEqual(["P4B_PROCEDURE_A"]);
      expect(documents.map((row: any) => row.id).sort()).toEqual(["P4B_DOCUMENT_A", "P4B_DOCUMENT_B"]);
      expect(mappings).toEqual([expect.objectContaining({ procedure_id: "P4B_PROCEDURE_A", doc_ids: ["P4B_DOCUMENT_A", "P4B_DOCUMENT_B"] })]);
    } finally {
      await rm(runtimeRoot, { recursive: true, force: true });
    }
  });

  it("rejects duplicate canonical IDs and broken relationships before publication", () => {
    expect(() => buildPayloadRuntimeCandidate([
      publishedProcedure("P4B_PROCEDURE_A"),
      publishedProcedure("P4B_PROCEDURE_A"),
    ], [])).toThrowError(/Duplicate Payload procedure canonicalId/);

    expect(() => buildPayloadRuntimeCandidate([
      publishedProcedure("P4B_PROCEDURE_A", [{ businessIdentifier: "P4B_DOCUMENT_MISSING" }]),
    ], [])).toThrowError(/Broken Payload document relationship/);
  });

  it("keeps the last-good pointer after a failed candidate and emits failed audit", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const runtimeRoot = await temporaryRuntimeRoot();
    let broken = false;
    const fetcher: PayloadHttpClient = async (url) => {
      const collection = new URL(url).pathname.endsWith("/procedures") ? "procedures" : "documents";
      if (collection === "procedures") {
        return payloadResponse({ docs: [publishedProcedure("P4B_PROCEDURE_A", broken ? [{ businessIdentifier: "P4B_DOCUMENT_MISSING" }] : [])], totalPages: 1 });
      }
      return payloadResponse({ docs: [publishedDocument("P4B_DOCUMENT_A")], totalPages: 1 });
    };
    const service = new PayloadCanonicalSyncService({ fetcher, runtimeRoot, reload: async () => undefined, audit: async () => undefined, runtimeCoverage: async () => ({ procedures: [], documents: [], mappings: [] }) });

    try {
      await service.sync();
      const pointerBefore = readFileSync(path.join(runtimeRoot, "active.json"), "utf8");
      broken = true;
      await expect(service.sync()).rejects.toMatchObject<Partial<PayloadSyncError>>({ code: "PAYLOAD_SYNC_INVALID_DATASET" });
      expect(readFileSync(path.join(runtimeRoot, "active.json"), "utf8")).toBe(pointerBefore);
      expect(service.getStatus().lastRun?.state).toBe("FAILED");
    } finally {
      await rm(runtimeRoot, { recursive: true, force: true });
    }
  });

  it("rejects an empty published Procedure candidate before activation", () => {
    expect(() => buildPayloadRuntimeCandidate([], [])).toThrowError(/at least one published procedure/);
    expect(() => buildPayloadRuntimeCandidate([{ ...publishedProcedure("P4B_DRAFT_ONLY"), publicationState: "draft", workflowStatus: "DRAFT", _status: "draft" }], [])).toThrowError(/at least one published procedure/);
  });

  it("rejects a partial first Payload activation that would truncate the current runtime", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const runtimeRoot = await temporaryRuntimeRoot();
    const fetcher: PayloadHttpClient = async (url) => {
      const procedures = new URL(url).pathname.endsWith("/procedures");
      return payloadResponse({ docs: procedures ? [publishedProcedure("P4B_PARTIAL_PROCEDURE")] : [], totalPages: 1 });
    };
    const service = new PayloadCanonicalSyncService({
      runtimeRoot,
      fetcher,
      reload: async () => undefined,
      audit: vi.fn(async () => undefined),
      runtimeCoverage: async () => ({
        procedures: [runtimeProcedure("P4B_REQUIRED_PROCEDURE_A"), runtimeProcedure("P4B_REQUIRED_PROCEDURE_B")],
        documents: [],
        mappings: [],
      }),
    });
    try {
      await expect(service.sync()).rejects.toMatchObject<Partial<PayloadSyncError>>({ code: "PAYLOAD_SYNC_INVALID_DATASET", statusCode: 422 });
      expect(existsSync(path.join(runtimeRoot, "active.json"))).toBe(false);
      expect(service.getStatus().lastRun?.state).toBe("FAILED");
    } finally {
      await rm(runtimeRoot, { recursive: true, force: true });
    }
  });

  it("accepts a complete first Payload activation that preserves the current runtime count", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const runtimeRoot = await temporaryRuntimeRoot();
    const fetcher: PayloadHttpClient = async (url) => {
      const procedures = new URL(url).pathname.endsWith("/procedures");
      return payloadResponse({ docs: procedures ? [publishedProcedure("P4B_COMPLETE_PROCEDURE_A"), publishedProcedure("P4B_COMPLETE_PROCEDURE_B")] : [], totalPages: 1 });
    };
    const service = new PayloadCanonicalSyncService({
      runtimeRoot,
      fetcher,
      reload: async () => undefined,
      audit: vi.fn(async () => undefined),
      runtimeCoverage: async () => ({
        procedures: [runtimeProcedure("P4B_COMPLETE_PROCEDURE_A"), runtimeProcedure("P4B_COMPLETE_PROCEDURE_B")],
        documents: [],
        mappings: [],
      }),
    });
    try {
      const result = await service.sync();
      expect(result.counts.proceduresPublished).toBe(2);
      expect(existsSync(path.join(runtimeRoot, "active.json"))).toBe(true);
    } finally {
      await rm(runtimeRoot, { recursive: true, force: true });
    }
  });

  it("rejects first activation when Procedure IDs match but a runtime Document is missing", () => {
    const candidate = buildPayloadRuntimeCandidate([publishedProcedure("P4B_PROC_A")], []);
    expect(() => assertInitialActivationCoverage(candidate, {
      procedures: [runtimeProcedure("P4B_PROC_A")],
      documents: [{ id: "P4B_DOC_REQUIRED", title: "Required" }],
      mappings: [],
    })).toThrowError(/documentsMissing/);
  });

  it("rejects first activation when counts match but a Procedure-Document relationship changes", () => {
    const candidate = buildPayloadRuntimeCandidate(
      [publishedProcedure("P4B_PROC_A")],
      [publishedDocument("P4B_DOC_A")],
    );
    expect(() => assertInitialActivationCoverage(candidate, {
      procedures: [runtimeProcedure("P4B_PROC_A")],
      documents: [{ id: "P4B_DOC_A", title: "Document A" }],
      mappings: [{ procedure_id: "P4B_PROC_A", doc_ids: ["P4B_DOC_A"], confidence: 1 }],
    })).toThrowError(/mappingsMissing/);
  });

  it("reports OUT_OF_SYNC when published Payload content changes after activation", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const runtimeRoot = await temporaryRuntimeRoot();
    let titleAr = "Stable title";
    const fetcher: PayloadHttpClient = async (url) => {
      const procedures = new URL(url).pathname.endsWith("/procedures");
      return payloadResponse({
        docs: procedures ? [{ ...publishedProcedure("P4B_DRIFT_PROCEDURE"), titleAr }] : [],
        totalPages: 1,
      });
    };
    const service = new PayloadCanonicalSyncService({
      runtimeRoot,
      fetcher,
      reload: async () => undefined,
      audit: vi.fn(async () => undefined),
      runtimeCoverage: async () => ({ procedures: [runtimeProcedure("P4B_DRIFT_PROCEDURE")], documents: [], mappings: [] }),
    });
    try {
      await service.sync();
      expect((await service.inspectStatus()).state).toBe("ACTIVE");
      titleAr = "Changed title";
      expect((await service.inspectStatus()).state).toBe("OUT_OF_SYNC");
    } finally {
      await rm(runtimeRoot, { recursive: true, force: true });
    }
  });
  it("rejects a concurrent sync while the first fetch is in progress", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const runtimeRoot = await temporaryRuntimeRoot();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetcher: PayloadHttpClient = async (url) => {
      await gate;
      const procedures = new URL(url).pathname.endsWith("/procedures");
      return payloadResponse({ docs: procedures ? [publishedProcedure("P4B_CONCURRENT_PROCEDURE")] : [], totalPages: 1 });
    };
    const service = new PayloadCanonicalSyncService({ runtimeRoot, fetcher, reload: async () => undefined, audit: vi.fn(async () => undefined), runtimeCoverage: async () => ({ procedures: [], documents: [], mappings: [] }) });
    try {
      const first = service.sync();
      await expect(service.sync()).rejects.toMatchObject<Partial<PayloadSyncError>>({ code: "PAYLOAD_SYNC_ALREADY_RUNNING" });
      release();
      await first;
    } finally {
      await rm(runtimeRoot, { recursive: true, force: true });
    }
  });
});