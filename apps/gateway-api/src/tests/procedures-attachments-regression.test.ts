import { describe, expect, it, afterAll } from "vitest";

// Force Python upstream down for attachment and procedure tests to avoid
// accidental live Python calls during gateway-only test runs.
import { restorePythonEnv, forcePythonDown } from "./setup/force-python-down";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

import { getKbRoot } from "../procedures/config";
import { getProcedure, getProcedureDoc, getProcedureDocs, loadIndex, mapStoredDocAssetToDocRef } from "../procedures/indexer";

// Apply the forced-Python-down shim before the gateway code is imported
// so the in-memory pythonBase is initialized to the unreachable URL.
forcePythonDown();
const { default: app } = await import("../server");

afterAll(() => {
  // restore global env/module state changed by the force-python-down shim
  restorePythonEnv();
});

// These tests require the full kb-studio/watany export with attachment data.
// Skip gracefully when only the minimal kb_vnext dataset is available.
const ATTACHMENT_KB_AVAILABLE = getKbRoot().replaceAll("\\", "/").includes("kb-studio/watany/runtime/exports/watanybot");

function isOkAttachmentResponse(statusCode: number): boolean {
  return statusCode === 200 || statusCode === 302;
}

describe("Gateway procedure attachment regressions", () => {
  it("resolves doc-id aliases consistently across procedure detail, docs, files, and flow routes", async () => {
    const aliasedProcedure = await getProcedure("summary-proc-0095");
    const aliasedDocs = await getProcedureDocs("summary-proc-0095");

    expect(aliasedProcedure?.id.toLowerCase()).toBe("proc-0095");
    expect(aliasedDocs.some((doc) => doc.id === "summary-proc-0095")).toBe(true);

    const detailResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/summary-proc-0095",
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(JSON.parse(detailResponse.payload || "{}").procedure?.id?.toLowerCase()).toBe("proc-0095");

    const docsResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/summary-proc-0095/docs",
    });

    expect(docsResponse.statusCode).toBe(200);
    expect(JSON.parse(docsResponse.payload || "{}").docs?.some((doc: { id?: string }) => doc.id === "summary-proc-0095")).toBe(true);

    const filesResponse = await app.inject({
      method: "GET",
      url: "/api/v2/files?procedureId=summary-proc-0095&limit=50&includeArchive=true",
    });

    expect(filesResponse.statusCode).toBe(200);
    expect(JSON.parse(filesResponse.payload || "{}").items?.some((item: { id?: string }) => item.id === "summary-proc-0095")).toBe(true);

    const flowResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/summary-proc-0095/flow",
    });

    expect(flowResponse.statusCode).toBe(200);
    expect(JSON.parse(flowResponse.payload || "{}").mermaid).toContain("flowchart");
  });

  it("hydrates missing MOF source docs and resolves the MOF reference source page", async () => {
    const mofDoc = await getProcedureDoc("DOC-WATANY_MOF_HTML-0006");

    expect(mofDoc?.id).toBe("DOC-WATANY_MOF_HTML-0006");

    const previewResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0006/preview",
    });

    expect(isOkAttachmentResponse(previewResponse.statusCode)).toBe(true);
    if (previewResponse.statusCode === 302) {
      expect(previewResponse.headers.location || "").toContain("../../reference/mof");
    } else {
      expect(previewResponse.statusCode).toBe(200);
      expect(previewResponse.headers["content-type"]).toContain("text/html");
      expect(previewResponse.body).toContain("data:image/jpeg;base64,");
      expect(previewResponse.body).toContain("طلب اعادة تخصيص معاش تقاعدي - ت7");
      expect(previewResponse.body).not.toContain("DOC-WATANY_MOF_HTML-0034");
    }

    const downloadResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/docs/DOC-WATANY_MOF_HTML-0006/download",
    });

    expect(isOkAttachmentResponse(downloadResponse.statusCode)).toBe(true);
    if (downloadResponse.statusCode === 302) {
      expect(downloadResponse.headers.location || "").toContain("../../reference/mof");
    } else {
      expect(downloadResponse.statusCode).toBe(200);
    }

    const referenceResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/reference/mof",
    });

    expect(referenceResponse.statusCode).toBe(200);
    expect(referenceResponse.body).toContain("DOC-WATANY_MOF_HTML-0006");
  });

  it("renders an HTML fallback page when a preview doc id is missing", async () => {
    const previewResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/docs/DOES-NOT-EXIST/preview",
    });

    expect(previewResponse.statusCode).toBe(404);
    expect(previewResponse.headers["content-type"]).toContain("text/html");
    expect(previewResponse.body).toContain("الملف غير متوفر حالياً");
    expect(previewResponse.body).toContain("إعادة المحاولة");
    expect(previewResponse.body).toContain("../../reference/procedures");
  });

  it.skipIf(!ATTACHMENT_KB_AVAILABLE)("loads the attachment-complete KB export and preserves mapped docs for all procedures", async () => {
    const state = await loadIndex(true);
    const kbRoot = getKbRoot().replaceAll("\\", "/");
    const relations = state.map.filter((relation) => (relation.doc_ids || []).length > 0);

    expect(kbRoot).toContain("kb-studio/watany/runtime/exports/watanybot");
    expect(relations.length).toBeGreaterThan(0);

    const missingExactProcedureIds: string[] = [];
    const missingNormalizedProcedureIds: string[] = [];
    const missingMappedDocs: string[] = [];
    const missingActionUrls: string[] = [];

    for (const relation of relations) {
      const exactProcedure = await getProcedure(relation.procedure_id);
      if (!exactProcedure) {
        missingExactProcedureIds.push(relation.procedure_id);
        continue;
      }

      const normalizedProcedure = await getProcedure(relation.procedure_id.toLowerCase());
      if (!normalizedProcedure) {
        missingNormalizedProcedureIds.push(relation.procedure_id);
      }

      const docs = await getProcedureDocs(relation.procedure_id);
      const docIds = new Set(docs.map((doc) => doc.id));

      for (const docId of relation.doc_ids || []) {
        if (!docIds.has(docId)) {
          missingMappedDocs.push(`${relation.procedure_id}:${docId}`);
          continue;
        }

        const docRef = docs.find((doc) => doc.id === docId);
        if (!docRef?.preview_url && !docRef?.download_url && !docRef?.share_url && !docRef?.url) {
          missingActionUrls.push(`${relation.procedure_id}:${docId}`);
        }
      }
    }

    expect(missingExactProcedureIds).toEqual([]);
    expect(missingNormalizedProcedureIds).toEqual([]);
    expect(missingMappedDocs).toEqual([]);
    expect(missingActionUrls).toEqual([]);
  });

  it.skipIf(!ATTACHMENT_KB_AVAILABLE)("serves preview and download endpoints for every mapped attached document", async () => {
    const state = await loadIndex(false);
    const uniqueDocIds = Array.from(new Set(state.map.flatMap((relation) => relation.doc_ids || [])));
    const previewFailures: string[] = [];
    const downloadFailures: string[] = [];

    expect(uniqueDocIds.length).toBeGreaterThan(0);

    for (const docId of uniqueDocIds) {
      const doc = await getProcedureDoc(docId);
      expect(doc, docId).toBeTruthy();
      if (!doc) continue;

      if (doc.preview_url) {
        const response = await app.inject({
          method: "GET",
          url: `/api/v2/procedures/docs/${encodeURIComponent(docId)}/preview`,
        });

        if (!isOkAttachmentResponse(response.statusCode)) {
          previewFailures.push(`${docId}:${response.statusCode}`);
        }
      }

      if (doc.download_enabled !== false || doc.public_url) {
        const response = await app.inject({
          method: "GET",
          url: `/api/v2/procedures/docs/${encodeURIComponent(docId)}/download`,
        });

        if (!isOkAttachmentResponse(response.statusCode)) {
          downloadFailures.push(`${docId}:${response.statusCode}`);
        }
      }
    }

    expect(previewFailures).toEqual([]);
    expect(downloadFailures).toEqual([]);
  });

  it.skipIf(!ATTACHMENT_KB_AVAILABLE)("renders docx previews as HTML while keeping downloads as the original file", async () => {
    const previewResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/docs/DOC-WATANY_LAF_HTML-0105/preview",
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.headers["content-type"]).toContain("text/html");
    expect(previewResponse.headers["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(previewResponse.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(previewResponse.body).toContain("معاينة المستند داخل المتصفح");
    expect(previewResponse.body).toContain("../download");

    const downloadResponse = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/docs/DOC-WATANY_LAF_HTML-0105/download",
    });

    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(downloadResponse.body.slice(0, 2)).toBe("PK");
  });

  it("publishes normalized related procedure ids for file attachments across the full KB", async () => {
    const state = await loadIndex(false);
    const response = await app.inject({
      method: "GET",
      url: "/api/v2/files?limit=500&includeArchive=true",
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload || "{}");
    const items = body.items || [];
    const mappedProcedureIds = new Set(state.map.map((relation) => relation.procedure_id.toLowerCase()));
    const nonNormalizedRelatedIds: string[] = [];
    const unknownRelatedIds: string[] = [];

    for (const item of items) {
      for (const relatedProcedureId of item.relatedProcedureIds || []) {
        if (relatedProcedureId !== relatedProcedureId.toLowerCase()) {
          nonNormalizedRelatedIds.push(`${item.id}:${relatedProcedureId}`);
        }
        if (!mappedProcedureIds.has(relatedProcedureId.toLowerCase())) {
          unknownRelatedIds.push(`${item.id}:${relatedProcedureId}`);
        }
      }
    }

    expect(nonNormalizedRelatedIds).toEqual([]);
    expect(unknownRelatedIds).toEqual([]);
  });

  it("preserves preview, download, and share URLs on shared file items for reference attachments", async () => {
    const state = await loadIndex(false);
    const expectedById = new Map(
      state.docs
        .map(mapStoredDocAssetToDocRef)
        .filter((doc) => doc.preview_url || doc.download_url || doc.share_url)
        .map((doc) => [doc.id, doc] as const),
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/v2/files?limit=500&includeArchive=true",
    });

    expect(response.statusCode).toBe(200);

    if (expectedById.size === 0) {
      const body = JSON.parse(response.payload || "{}");
      expect(Array.isArray(body.items)).toBe(true);
      return;
    }

    const body = JSON.parse(response.payload || "{}");
    const mismatches: string[] = [];

    for (const item of body.items || []) {
      const expected = expectedById.get(item.id);
      if (!expected) continue;

      if ((item.preview_url || undefined) !== (expected.preview_url || undefined)) {
        mismatches.push(`${item.id}:preview`);
      }
      if ((item.download_url || undefined) !== (expected.download_url || undefined)) {
        mismatches.push(`${item.id}:download`);
      }
      if ((item.share_url || undefined) !== (expected.share_url || undefined)) {
        mismatches.push(`${item.id}:share`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});