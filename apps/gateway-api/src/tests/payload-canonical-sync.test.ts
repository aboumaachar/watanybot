import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PayloadCanonicalSyncService,
  PayloadSyncError,
  buildPayloadRuntimeCandidate,
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

async function temporaryRuntimeRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "watany-payload-sync-"));
}

describe("Payload canonical sync mapping", () => {
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
    const service = new PayloadCanonicalSyncService({ fetcher, runtimeRoot, reload: async () => undefined, audit: async () => undefined });

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

  it("rejects a concurrent sync while the first fetch is in progress", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const runtimeRoot = await temporaryRuntimeRoot();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetcher: PayloadHttpClient = async () => {
      await gate;
      return payloadResponse({ docs: [], totalPages: 1 });
    };
    const service = new PayloadCanonicalSyncService({ runtimeRoot, fetcher, reload: async () => undefined, audit: vi.fn(async () => undefined) });
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