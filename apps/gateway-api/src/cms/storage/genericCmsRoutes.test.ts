import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  transition: vi.fn(),
  restore: vi.fn(),
  bulk: vi.fn(),
  relationships: vi.fn(),
  addRelationship: vi.fn(),
  deleteRelationship: vi.fn(),
  replaceRelationships: vi.fn(),
  versions: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("./genericCmsRepository.js", () => ({
  createGenericCmsEntity: mocks.create,
  getGenericCmsEntity: mocks.get,
  listGenericCmsEntitiesPage: mocks.list,
  updateGenericCmsEntity: mocks.update,
  transitionGenericCmsEntity: mocks.transition,
  restoreGenericCmsEntity: mocks.restore,
  bulkUpdateGenericCmsEntities: mocks.bulk,
  listGenericCmsRelationships: mocks.relationships,
  createGenericCmsRelationship: mocks.addRelationship,
  deleteGenericCmsRelationship: mocks.deleteRelationship,
  replaceGenericCmsRelationships: mocks.replaceRelationships,
}));

vi.mock("../../admin-authority/adminAuthorityAudit.js", () => ({
  appendAdminAuditEvent: vi.fn().mockResolvedValue(undefined),
  createAdminAuditEvent: (input: unknown) => input,
  listRecentAdminAuditEvents: mocks.audit,
}));

vi.mock("../../admin-authority/adminAuthorityVersioning.js", () => ({
  createAdminEntityVersion: vi.fn().mockResolvedValue(undefined),
  listAdminEntityVersions: mocks.versions,
}));

import { registerGenericCmsRoutes } from "./genericCmsRoutes.js";

const entity = {
  id: "entity-1",
  domain: "forms",
  publicId: "FORM-1",
  publicCode: "F-1",
  sourceId: "source-1",
  status: "DRAFT" as const,
  locale: "ar",
  title: "طلب تجريبي",
  payload: { category: "housing" },
  sourceMeta: { source: "test" },
  revision: 2,
  createdBy: "superadmin-1",
  updatedBy: "superadmin-1",
  createdAt: "2026-08-27T10:00:00.000Z",
  updatedAt: "2026-08-27T10:01:00.000Z",
  publishedAt: null,
  archivedAt: null,
};

const listResult = {
  items: [entity],
  total: 11,
  page: 2,
  pageSize: 5,
  statusCounts: { DRAFT: 3, REVIEW_READY: 1, PUBLISHED: 4, UNPUBLISHED: 2, ARCHIVED: 1 },
};

function addTestActor(app: ReturnType<typeof Fastify>): void {
  app.addHook("onRequest", async (request) => {
    if (request.headers["x-test-role"] === "superadmin") {
      (request as any).user = { id: "superadmin-1", role: "superadmin" };
    }
  });
}

async function buildApp() {
  const app = Fastify();
  addTestActor(app);
  registerGenericCmsRoutes(app, { domain: "forms", entityType: "cms.forms", auditEntityType: "form", title: "Forms" });
  await app.ready();
  return app;
}

describe("generic CMS route engine", () => {
  beforeEach(() => {
    mocks.create.mockReset().mockResolvedValue(entity);
    mocks.get.mockReset().mockResolvedValue(entity);
    mocks.list.mockReset().mockResolvedValue(listResult);
    mocks.update.mockReset().mockResolvedValue({ ...entity, revision: 3, title: "Updated" });
    mocks.transition.mockReset().mockResolvedValue({ ...entity, status: "PUBLISHED", revision: 3 });
    mocks.restore.mockReset().mockResolvedValue({ ...entity, status: "DRAFT", revision: 3 });
    mocks.bulk.mockReset().mockResolvedValue([{ ...entity, title: "Bulk edited", revision: 3 }]);
    mocks.relationships.mockReset().mockResolvedValue([{ entityId: "entity-1", publicId: "FORM-1", domain: "forms", relationType: "documents", targetDomain: "documents", targetPublicId: "DOC-1", createdAt: "2026-08-27T10:00:00.000Z" }]);
    mocks.addRelationship.mockReset().mockResolvedValue({ entityId: "entity-1", publicId: "FORM-1", domain: "forms", relationType: "documents", targetDomain: "documents", targetPublicId: "DOC-2", createdAt: "2026-08-27T10:00:00.000Z" });
    mocks.deleteRelationship.mockReset().mockResolvedValue(true);
    mocks.replaceRelationships.mockReset().mockResolvedValue([]);
    mocks.versions.mockReset().mockResolvedValue([{ id: "version-1", entityType: "cms.forms", entityId: "FORM-1", version: 1, snapshot: entity, createdBy: "superadmin-1", createdAt: "2026-08-27T10:00:00.000Z", reason: "created" }]);
    mocks.audit.mockReset().mockResolvedValue([]);
  });

  it("returns normalized paginated list and relationship-rich detail", async () => {
    const app = await buildApp();
    const list = await app.inject({ method: "GET", url: "/api/admin/cms/forms?q=طلب&page=2&pageSize=5", headers: { "x-test-role": "superadmin" } });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual(expect.objectContaining({ ok: true, domain: "forms", total: 11, page: 2, pageSize: 5, statusCounts: listResult.statusCounts }));
    expect(mocks.list).toHaveBeenCalledWith("forms", { search: "طلب", status: undefined, page: 2, pageSize: 5 });

    const detail = await app.inject({ method: "GET", url: "/api/admin/cms/forms/FORM-1", headers: { "x-test-role": "superadmin" } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().item).toEqual(expect.objectContaining({ id: "FORM-1", publicId: "FORM-1", version: "2", record: expect.objectContaining({ category: "housing" }), relationships: expect.any(Array) }));
    await app.close();
  });

  it("rejects unsupported bulk fields and prevents partial selection", async () => {
    const app = await buildApp();
    const unsupported = await app.inject({ method: "POST", url: "/api/admin/cms/forms/bulk-actions/edit", headers: { "x-test-role": "superadmin" }, payload: { ids: ["FORM-1"], patch: { publicId: "forbidden" } } });
    expect(unsupported.statusCode).toBe(400);
    expect(mocks.bulk).not.toHaveBeenCalled();

    mocks.get.mockImplementation(async (_domain: string, publicId: string) => publicId === "FORM-1" ? entity : null);
    const missing = await app.inject({ method: "POST", url: "/api/admin/cms/forms/bulk-actions/archive", headers: { "x-test-role": "superadmin" }, payload: { ids: ["FORM-1", "FORM-MISSING"] } });
    expect(missing.statusCode).toBe(404);
    expect(mocks.bulk).not.toHaveBeenCalled();
    await app.close();
  });

  it("routes lifecycle, rollback, and relationship mutations through shared services", async () => {
    const app = await buildApp();
    const published = await app.inject({ method: "POST", url: "/api/admin/cms/forms/FORM-1/actions/publish", headers: { "x-test-role": "superadmin" } });
    expect(published.statusCode).toBe(200);
    expect(mocks.transition).toHaveBeenCalledWith("forms", "FORM-1", "publish", "superadmin-1");

    const restored = await app.inject({ method: "POST", url: "/api/admin/cms/forms/FORM-1/actions/restore", headers: { "x-test-role": "superadmin" } });
    expect(restored.statusCode).toBe(200);
    expect(mocks.restore).toHaveBeenCalledWith("forms", "FORM-1", "superadmin-1");

    const rollback = await app.inject({ method: "POST", url: "/api/admin/cms/forms/FORM-1/rollback/version-1", headers: { "x-test-role": "superadmin" } });
    expect(rollback.statusCode).toBe(200);
    expect(mocks.update).toHaveBeenCalled();

    const relationship = await app.inject({ method: "POST", url: "/api/admin/cms/forms/FORM-1/relationships", headers: { "x-test-role": "superadmin" }, payload: { relationType: "documents", targetDomain: "documents", targetPublicId: "DOC-2" } });
    expect(relationship.statusCode).toBe(200);
    const replacement = await app.inject({ method: "PUT", url: "/api/admin/cms/forms/FORM-1/relationships/documents", headers: { "x-test-role": "superadmin" }, payload: { targets: [{ targetDomain: "documents", targetPublicId: "DOC-3" }] } });
    expect(replacement.statusCode).toBe(200);
    expect(mocks.replaceRelationships).toHaveBeenCalledWith("forms", "FORM-1", "documents", [{ targetDomain: "documents", targetPublicId: "DOC-3" }]);
    const deletion = await app.inject({ method: "DELETE", url: "/api/admin/cms/forms/FORM-1/relationships/documents/documents/DOC-3", headers: { "x-test-role": "superadmin" } });
    expect(deletion.statusCode).toBe(200);
    expect(mocks.deleteRelationship).toHaveBeenCalledWith({ domain: "forms", publicId: "FORM-1", relationType: "documents", targetDomain: "documents", targetPublicId: "DOC-3" });
    await app.close();
  });

  it("keeps the existing admin authority boundary", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/cms/forms" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});