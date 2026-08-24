import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { appendAuditMock, createVersionMock, queryMock } = vi.hoisted(() => ({
  appendAuditMock: vi.fn(),
  createVersionMock: vi.fn(),
  queryMock: vi.fn(),
}));
vi.mock("../lib/db.js", () => ({ query: queryMock }));
vi.mock("../admin-authority/adminAuthorityAudit.js", () => ({
  appendAdminAuditEvent: appendAuditMock,
  createAdminAuditEvent: (input: unknown) => input,
  listRecentAdminAuditEvents: vi.fn().mockResolvedValue([]),
}));
vi.mock("../admin-authority/adminAuthorityVersioning.js", () => ({
  createAdminEntityVersion: createVersionMock,
  listAdminEntityVersions: vi.fn().mockResolvedValue([]),
}));

import { registerDocumentsCmsRoutes } from "../cms/documents/documents-cms-adapter.js";
import { DocumentService } from "../cms/documents/documents-service.js";
import { PostgresDocumentRepository, type DocumentRow } from "../cms/documents/documents-repository.js";

const documentId = "11111111-1111-4111-8111-111111111111";
const row: DocumentRow = {
  id: documentId,
  user_id: null,
  name: "Retirement guide",
  kind: "pdf",
  status: "pending",
  tags: ["retirement", "official"],
  file_path: null,
  updated_at: "2026-08-24T08:00:00.000Z",
};

describe("C9.2/C9.3 document boundary", () => {
  beforeEach(() => {
    queryMock.mockReset();
    appendAuditMock.mockReset().mockResolvedValue(undefined);
    createVersionMock.mockReset().mockResolvedValue(undefined);
  });

  it("lists public.documents through the repository with bounded filters and pagination", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ status: "pending", count: 1 }] })
      .mockResolvedValueOnce({ rows: [row] });

    const repository = new PostgresDocumentRepository();
    const result = await repository.list({
      search: "retirement",
      status: "pending",
      kind: "pdf",
      tag: "official",
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.rows).toEqual([row]);
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[0][0]).toContain("FROM public.documents");
    expect(queryMock.mock.calls[0][0]).toContain("tags @>");
    expect(queryMock.mock.calls[2][0]).toContain("LIMIT $5");
    expect(queryMock.mock.calls[2][0]).toContain("OFFSET $6");
    expect(queryMock.mock.calls[2][1]).toEqual(["%retirement%", "pending", "pdf", '["official"]', 20, 0]);

    queryMock.mockResolvedValueOnce({ rowCount: 1 });
    await expect(repository.delete(documentId)).resolves.toBe(true);
    expect(queryMock.mock.calls[3][0]).toBe("DELETE FROM public.documents WHERE id = $1::uuid");
    expect(queryMock.mock.calls[3][1]).toEqual([documentId]);
  });

  it("normalizes proven storage statuses and rejects fields outside the live contract", async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ rows: [row], total: 1, statusCounts: { pending: 1 } }),
      findById: vi.fn().mockResolvedValue(row),
      create: vi.fn().mockResolvedValue({ ...row, name: "Guide", status: "pending" }),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const service = new DocumentService(repository);

    const listed = await service.list({ status: "DRAFT", page: "1", pageSize: "10" });
    expect(listed.items[0]).toEqual(expect.objectContaining({
      id: documentId,
      title: "Retirement guide",
      status: "DRAFT",
      document: expect.objectContaining({ kind: "pdf", status: "pending", tags: ["retirement", "official"] }),
    }));
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", limit: 10, offset: 0 }));

    await expect(service.list({ status: "REVIEW_READY" })).rejects.toMatchObject({ code: "INVALID_STATUS_FILTER" });
    await expect(service.create({ name: "Guide", kind: "pdf", status: "verified", slug: "invented", file_path: null })).resolves.toBeDefined();
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Guide", kind: "pdf", status: "pending" }));
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty("slug");
  });

  it("keeps CMS routes behind the existing admin authority and delegates reads to the service", async () => {
    const service = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, statusCounts: {} }),
      get: vi.fn().mockResolvedValue({
        id: documentId,
        title: "Retirement guide",
        status: "DRAFT",
        version: "2026-08-24T08:00:00.000Z",
        updatedAt: "2026-08-24T08:00:00.000Z",
        record: {},
        document: row,
      }),
      preview: vi.fn().mockReturnValue({ supported: false, reason: "NO_FILE_PATH" }),
    } as unknown as DocumentService;

    const app = Fastify();
    app.addHook("onRequest", async (request) => {
      (request as any).user = { id: "cms-superadmin", role: "superadmin" };
    });
    registerDocumentsCmsRoutes(app, { documentService: service });
    await app.ready();

    const list = await app.inject({ method: "GET", url: "/api/admin/cms/documents?q=guide&kind=pdf" });
    expect(list.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ q: "guide", kind: "pdf" }));

    const detail = await app.inject({ method: "GET", url: `/api/admin/cms/documents/${documentId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().preview).toEqual({ supported: false, reason: "NO_FILE_PATH" });
    await app.close();

    const deniedApp = Fastify();
    registerDocumentsCmsRoutes(deniedApp, { documentService: service });
    const denied = await deniedApp.inject({ method: "GET", url: "/api/admin/cms/documents" });
    expect(denied.statusCode).toBe(401);
    await deniedApp.close();
  });

  it("deletes exactly one disposable document through the CMS authority boundary", async () => {
    const neighborId = "22222222-2222-4222-8222-222222222222";
    const rows = new Map<string, DocumentRow>([
      [documentId, row],
      [neighborId, { ...row, id: neighborId, name: "Neighbor document" }],
    ]);
    const repository = {
      list: vi.fn(),
      findById: vi.fn(async (id: string) => rows.get(id) || null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(async (id: string) => rows.delete(id)),
    };
    const service = new DocumentService(repository);

    const adminApp = Fastify();
    adminApp.addHook("onRequest", async (request) => {
      (request as any).user = { id: "cms-admin", role: "admin", permissions: ["cms.edit"] };
    });
    registerDocumentsCmsRoutes(adminApp, { documentService: service });
    await adminApp.ready();

    const deleted = await adminApp.inject({ method: "DELETE", url: `/api/admin/cms/documents/${documentId}` });
    expect(deleted.statusCode).toBe(200);
    expect(rows.has(documentId)).toBe(false);
    expect(rows.has(neighborId)).toBe(true);

    const notFound = await adminApp.inject({ method: "DELETE", url: `/api/admin/cms/documents/${documentId}` });
    expect(notFound.statusCode).toBe(404);

    const invalidId = await adminApp.inject({ method: "DELETE", url: "/api/admin/cms/documents/not-a-uuid" });
    expect(invalidId.statusCode).toBe(400);

    const bulkAttempt = await adminApp.inject({ method: "DELETE", url: "/api/admin/cms/documents?tag=official&status=pending" });
    expect(bulkAttempt.statusCode).toBe(404);
    expect(rows.has(neighborId)).toBe(true);
    await adminApp.close();

    const unauthorizedApp = Fastify();
    registerDocumentsCmsRoutes(unauthorizedApp, { documentService: service });
    await unauthorizedApp.ready();
    const unauthorized = await unauthorizedApp.inject({ method: "DELETE", url: `/api/admin/cms/documents/${neighborId}` });
    expect(unauthorized.statusCode).toBe(401);
    await unauthorizedApp.close();

    const forbiddenApp = Fastify();
    forbiddenApp.addHook("onRequest", async (request) => {
      (request as any).user = { id: "cms-admin-without-delete", role: "admin" };
    });
    registerDocumentsCmsRoutes(forbiddenApp, { documentService: service });
    await forbiddenApp.ready();
    const forbidden = await forbiddenApp.inject({ method: "DELETE", url: `/api/admin/cms/documents/${neighborId}` });
    expect(forbidden.statusCode).toBe(403);
    await forbiddenApp.close();

    const superadminApp = Fastify();
    superadminApp.addHook("onRequest", async (request) => {
      (request as any).user = { id: "cms-superadmin", role: "superadmin" };
    });
    registerDocumentsCmsRoutes(superadminApp, { documentService: service });
    await superadminApp.ready();
    const deletedNeighbor = await superadminApp.inject({ method: "DELETE", url: `/api/admin/cms/documents/${neighborId}` });
    expect(deletedNeighbor.statusCode).toBe(200);
    expect(rows.size).toBe(0);
    await superadminApp.close();

    expect(repository.delete).toHaveBeenCalledTimes(2);
    expect(repository.delete).toHaveBeenNthCalledWith(1, documentId);
    expect(repository.delete).toHaveBeenNthCalledWith(2, neighborId);
  });
});