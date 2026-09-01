import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { payloadStatusMock, payloadSyncMock, createGenericMock, listGenericMock, auditMock, versionMock } = vi.hoisted(() => ({
  payloadStatusMock: vi.fn(),
  payloadSyncMock: vi.fn(),
  createGenericMock: vi.fn(),
  listGenericMock: vi.fn(),
  auditMock: vi.fn(),
  versionMock: vi.fn(),
}));

vi.mock("../cms/payloadCanonicalSync.js", () => ({
  PayloadSyncError: class PayloadSyncError extends Error {
    code: string;
    statusCode: number;

    constructor(code: string, message: string, statusCode = 502) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  payloadCanonicalSync: {
    getStatus: payloadStatusMock,
    sync: payloadSyncMock,
  },
}));

vi.mock("../cms/storage/genericCmsRepository.js", () => ({
  createGenericCmsEntity: createGenericMock,
  getGenericCmsEntity: vi.fn(),
  listGenericCmsEntities: listGenericMock,
  updateGenericCmsEntity: vi.fn(),
}));

vi.mock("../admin-authority/adminAuthorityAudit.js", () => ({
  appendAdminAuditEvent: auditMock,
  createAdminAuditEvent: (input: unknown) => input,
  listRecentAdminAuditEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("../admin-authority/adminAuthorityVersioning.js", () => ({
  createAdminEntityVersion: versionMock,
  listAdminEntityVersions: vi.fn().mockResolvedValue([]),
}));

import { cmsRoutes } from "../cms/cms-routes.js";
import { proceduresRoutes } from "../procedures/routes.js";

const activeSync = {
  configured: true,
  running: false,
  lastRun: null,
  active: {
    runId: "run-1",
    activatedAt: "2026-08-27T10:00:00.000Z",
    counts: { proceduresFetched: 1, proceduresPublished: 1, documentsFetched: 1, documentsPublished: 1, mappings: 1 },
    contentHash: "hash-1",
  },
};

const operationalEntity = {
  id: "entity-1",
  domain: "forms",
  publicId: "FORM-1",
  publicCode: null,
  sourceId: null,
  status: "DRAFT" as const,
  locale: "ar",
  title: "طلب تجريبي",
  payload: {},
  sourceMeta: {},
  revision: 1,
  createdBy: "admin-1",
  updatedBy: "admin-1",
  createdAt: "2026-08-27T10:00:00.000Z",
  updatedAt: "2026-08-27T10:00:00.000Z",
  publishedAt: null,
  archivedAt: null,
};

function addTestActor(app: ReturnType<typeof Fastify>): void {
  app.addHook("onRequest", async (request) => {
    const role = String(request.headers["x-test-role"] || "");
    if (role === "admin") {
      (request as any).user = { id: "admin-1", role: "admin", permissions: ["cms.procedures.read"] };
    } else if (role === "superadmin") {
      (request as any).user = { id: "superadmin-1", role: "superadmin" };
    }
  });
}

describe("Payload CMS authority and legacy writer boundary", () => {
  beforeEach(() => {
    payloadStatusMock.mockReset().mockReturnValue(activeSync);
    payloadSyncMock.mockReset().mockResolvedValue({ ok: true, code: "SYNCED", runId: "run-2", activatedAt: "2026-08-27T10:01:00.000Z", counts: activeSync.active.counts, contentHash: "hash-2" });
    createGenericMock.mockReset().mockResolvedValue(operationalEntity);
    listGenericMock.mockReset().mockResolvedValue([]);
    auditMock.mockReset().mockResolvedValue(undefined);
    versionMock.mockReset().mockResolvedValue(undefined);
  });

  it("protects sync status and trigger routes with the existing admin authority", async () => {
    const app = Fastify();
    addTestActor(app);
    await app.register(cmsRoutes);
    await app.ready();

    expect((await app.inject({ method: "GET", url: "/api/admin/cms/payload-sync/status" })).statusCode).toBe(401);
    const adminStatus = await app.inject({ method: "GET", url: "/api/admin/cms/payload-sync/status", headers: { "x-test-role": "admin" } });
    expect(adminStatus.statusCode).toBe(200);
    expect(adminStatus.json()).toEqual(expect.objectContaining({ ok: true, source: "PAYLOAD", configured: true }));

    const adminTrigger = await app.inject({ method: "POST", url: "/api/admin/cms/payload-sync/sync", headers: { "x-test-role": "admin" } });
    expect(adminTrigger.statusCode).toBe(403);
    const superadminTrigger = await app.inject({ method: "POST", url: "/api/admin/cms/payload-sync/sync", headers: { "x-test-role": "superadmin", "user-agent": "boundary-test" } });
    expect(superadminTrigger.statusCode).toBe(200);
    expect(payloadSyncMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: "superadmin-1", userAgent: "boundary-test" }));
    await app.close();
  });

  it("fails closed for every CMS Procedure writer while keeping Forms and Announcements writable", async () => {
    const app = Fastify();
    addTestActor(app);
    await app.register(cmsRoutes);
    await app.ready();

    const writerRequests = [
      { method: "POST", url: "/api/admin/cms/procedures", payload: { title_ar: "blocked" } },
      { method: "PATCH", url: "/api/admin/cms/procedures/P4B_PROCEDURE_A", payload: { title_ar: "blocked" } },
      { method: "PUT", url: "/api/admin/cms/procedures/P4B_PROCEDURE_A/attachments", payload: { doc_ids: [] } },
      ...["publish", "unpublish", "archive", "restore"].map((action) => ({ method: "POST", url: `/api/admin/cms/procedures/P4B_PROCEDURE_A/actions/${action}` })),
    ] as const;

    for (const request of writerRequests) {
      const response = await app.inject({ ...request, headers: { "x-test-role": "superadmin" } });
      expect(response.statusCode, request.url).toBe(409);
      expect(response.json()).toEqual({ ok: false, error: "CANONICAL_EDITOR_PAYLOAD", canonicalEditor: "PAYLOAD" });
    }

    const form = await app.inject({ method: "POST", url: "/api/admin/cms/forms", headers: { "x-test-role": "superadmin" }, payload: { publicId: "FORM-1", title: "طلب تجريبي" } });
    expect(form.statusCode).toBe(201);
    const announcement = await app.inject({ method: "POST", url: "/api/admin/cms/announcements", headers: { "x-test-role": "superadmin" }, payload: { publicId: "ANN-1", title: "إعلان تجريبي" } });
    expect(announcement.statusCode).toBe(201);
    expect(createGenericMock).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it("fails closed for every legacy admin Procedure writer", async () => {
    const app = Fastify();
    addTestActor(app);
    await proceduresRoutes(app);
    await app.ready();

    const writerRequests = [
      { method: "PUT", url: "/api/admin/procedures/P4B_PROCEDURE_A/doc-links", payload: { doc_ids: ["P4B_DOCUMENT_A"] } },
      { method: "POST", url: "/api/admin/procedures", payload: { id: "P4B_PROCEDURE_NEW" } },
      { method: "PUT", url: "/api/admin/procedures/P4B_PROCEDURE_A", payload: { title_ar: "blocked" } },
      { method: "DELETE", url: "/api/admin/procedures/P4B_PROCEDURE_A" },
    ] as const;

    for (const request of writerRequests) {
      const response = await app.inject({ ...request, headers: { "x-test-role": "superadmin" } });
      expect(response.statusCode, request.url).toBe(409);
      expect(response.json()).toEqual({ ok: false, error: "CANONICAL_EDITOR_PAYLOAD", canonicalEditor: "PAYLOAD" });
    }
    await app.close();
  });
});