import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPayloadDocumentDrafts,
  getPayloadBootstrapStatus,
  publishPayloadDocuments,
} from "../cms/payloadEditorialBootstrap.js";

const originalBaseUrl = process.env.PAYLOAD_CMS_BASE_URL;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.PAYLOAD_CMS_BASE_URL;
  else process.env.PAYLOAD_CMS_BASE_URL = originalBaseUrl;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function publishedProcedure() {
  return {
    id: "payload-proc-a",
    canonicalId: "proc-a",
    publicationState: "PUBLISHED",
    workflowStatus: "PUBLISHED",
    _status: "published",
  };
}

describe("Payload editorial document bootstrap", () => {
  it("applies drafts, publishes them, and proves exact document relationship parity", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const documents: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/procedures") {
        return jsonResponse({ docs: [publishedProcedure()], totalPages: 1, hasNextPage: false });
      }
      if (url.pathname === "/api/documents" && (!init?.method || init.method === "GET")) {
        const includeDrafts = url.searchParams.get("draft") === "true";
        const visible = includeDrafts ? documents : documents.filter((row) => row._status === "published");
        return jsonResponse({ docs: visible, totalPages: 1, hasNextPage: false });
      }
      if (url.pathname === "/api/documents" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        documents.push({ id: "payload-doc-a", ...body });
        return jsonResponse({ doc: documents[0] }, 201);
      }
      if (url.pathname === "/api/documents/payload-doc-a" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        Object.assign(documents[0], body);
        return jsonResponse({ doc: documents[0] });
      }
      return jsonResponse({ error: "unexpected" }, 404);
    }) as typeof fetch;
    const runtimeDocuments = [{ id: "doc-a", title: "وثيقة أ", url: "/docs/a", tags: ["one"] }];
    const runtimeMappings = [{ procedure_id: "proc-a", doc_ids: ["doc-a"], confidence: 1 }];
    const draftResult = await applyPayloadDocumentDrafts("assertion", ["proc-a"], runtimeDocuments, runtimeMappings);
    expect(draftResult).toEqual({ requested: 1, applied: 1 });
    expect(documents[0]).toMatchObject({
      canonicalId: "doc-a",
      _status: "draft",
      procedureRelations: ["payload-proc-a"],
    });

    const publishResult = await publishPayloadDocuments("assertion", ["proc-a"], runtimeDocuments, runtimeMappings);
    expect(publishResult.requested).toBe(1);
    expect(publishResult.published).toBe(1);
    expect(publishResult.status.parity).toBe(true);
    expect(documents[0]).toMatchObject({ _status: "published", publicationState: "PUBLISHED", workflowStatus: "PUBLISHED" });

    const status = await getPayloadBootstrapStatus("assertion", ["proc-a"], runtimeDocuments, runtimeMappings);
    expect(status).toMatchObject({
      publishedProcedureCount: 1,
      publishedDocumentCount: 1,
      missingProcedureIds: 0,
      missingDocumentIds: 0,
      missingMappingPairs: 0,
      extraMappingPairs: 0,
      brokenRelationships: 0,
      parity: true,
    });
  });


  it("preserves native numeric Payload procedure IDs in document relationships", async () => {
    process.env.PAYLOAD_CMS_BASE_URL = "http://payload.test";
    const documents: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/procedures") {
        return jsonResponse({ docs: [{ ...publishedProcedure(), id: 42 }], totalPages: 1, hasNextPage: false });
      }
      if (url.pathname === "/api/documents" && (!init?.method || init.method === "GET")) {
        const includeDrafts = url.searchParams.get("draft") === "true";
        const visible = includeDrafts ? documents : documents.filter((row) => row._status === "published");
        return jsonResponse({ docs: visible, totalPages: 1, hasNextPage: false });
      }
      if (url.pathname === "/api/documents" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        if (!Array.isArray(body.procedureRelations) || typeof body.procedureRelations[0] !== "number") {
          return jsonResponse({ error: "relationship IDs must preserve numeric type" }, 400);
        }
        documents.push({ id: 77, ...body });
        return jsonResponse({ doc: documents[0] }, 201);
      }
      if (url.pathname === "/api/documents/77" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        if (!Array.isArray(body.procedureRelations) || typeof body.procedureRelations[0] !== "number") {
          return jsonResponse({ error: "relationship IDs must preserve numeric type" }, 400);
        }
        Object.assign(documents[0], body);
        return jsonResponse({ doc: documents[0] });
      }
      return jsonResponse({ error: "unexpected" }, 404);
    }) as typeof fetch;

    const runtimeDocuments = [{ id: "doc-a", title: "Document A", url: "/docs/a", tags: ["one"] }];
    const runtimeMappings = [{ procedure_id: "proc-a", doc_ids: ["doc-a"], confidence: 1 }];
    await expect(applyPayloadDocumentDrafts("assertion", ["proc-a"], runtimeDocuments, runtimeMappings))
      .resolves.toEqual({ requested: 1, applied: 1 });
    expect(documents[0]?.procedureRelations).toEqual([42]);

    const published = await publishPayloadDocuments("assertion", ["proc-a"], runtimeDocuments, runtimeMappings);
    expect(published.status.parity).toBe(true);
    expect(documents[0]?.procedureRelations).toEqual([42]);
  });
});
