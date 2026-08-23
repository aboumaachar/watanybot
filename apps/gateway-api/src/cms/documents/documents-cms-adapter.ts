import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../../admin-authority/adminAuthorityGuard.js";
import { appendAdminAuditEvent, createAdminAuditEvent, listRecentAdminAuditEvents } from "../../admin-authority/adminAuthorityAudit.js";
import { createAdminEntityVersion, listAdminEntityVersions } from "../../admin-authority/adminAuthorityVersioning.js";

type DocumentStatus = "pending" | "verified" | "rejected";
type CmsStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";

type PluginDb = {
  prepare(sql: string): { all(...args: unknown[]): Array<Record<string, unknown>>; get(...args: unknown[]): Record<string, unknown> | undefined; run(...args: unknown[]): { changes: number } };
};

type CmsDocument = {
  id: string;
  title: string;
  status: CmsStatus;
  version: string;
  updatedAt: number;
  record: Record<string, unknown>;
};

const cmsPolicy = (key: string) => ({ preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey(key))] });

function actorId(request: FastifyRequest): string {
  const user = (request as any).user;
  return String(user?.id || user?.sub || "unknown-admin");
}

function parseTags(row: Record<string, unknown>): string[] {
  try { return row.tags ? JSON.parse(String(row.tags)) as string[] : []; } catch { return []; }
}

function mapStatus(status: unknown): CmsStatus {
  if (status === "verified") return "PUBLISHED";
  if (status === "rejected") return "ARCHIVED";
  return "DRAFT";
}

function mapDocument(row: Record<string, unknown>): CmsDocument {
  return {
    id: String(row.id),
    title: String(row.name),
    status: mapStatus(row.status),
    version: String(row.updated_at || "1"),
    updatedAt: Number(row.updated_at),
    record: { ...row, tags: parseTags(row) },
  };
}

function rows(db: PluginDb): Array<Record<string, unknown>> {
  return db.prepare("SELECT * FROM documents ORDER BY updated_at DESC").all();
}

function findRow(db: PluginDb, id: string): Record<string, unknown> | undefined {
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
}

async function recordMutation(request: FastifyRequest, action: string, id: string, before: unknown, after: unknown): Promise<void> {
  const actor = actorId(request);
  await createAdminEntityVersion({ entityType: "cms.documents", entityId: id, snapshot: after, createdBy: actor, reason: action });
  await appendAdminAuditEvent(createAdminAuditEvent({
    eventType: `cms.documents.${action}`,
    actorId: actor,
    entityType: "document",
    entityId: id,
    before,
    after,
    reason: action,
    requestId: request.id,
    ip: request.ip,
    userAgent: request.headers["user-agent"]?.toString(),
  }));
}

function writeRow(db: PluginDb, row: Record<string, unknown>): void {
  db.prepare("UPDATE documents SET name = ?, kind = ?, status = ?, updated_at = ?, tags = ?, meta = ? WHERE id = ?").run(
    row.name, row.kind, row.status, row.updated_at, JSON.stringify(row.tags || []), row.meta || null, row.id,
  );
}

export function registerDocumentsCmsRoutes(app: FastifyInstance, db: PluginDb): void {
  app.get("/api/admin/cms/documents", cmsPolicy("cms.read"), async (request) => {
    const query = request.query as { q?: string; status?: CmsStatus; page?: string; pageSize?: string };
    const term = String(query.q || "").trim().toLocaleLowerCase();
    const filtered = rows(db).map(mapDocument).filter((item) => (!query.status || item.status === query.status) && (!term || JSON.stringify(item).toLocaleLowerCase().includes(term)));
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
    const page = Math.max(Number(query.page || 1), 1);
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { ok: true, domain: "documents", items, total: filtered.length, page, pageSize, statusCounts: { DRAFT: filtered.filter((item) => item.status === "DRAFT").length, PUBLISHED: filtered.filter((item) => item.status === "PUBLISHED").length, UNPUBLISHED: filtered.filter((item) => item.status === "UNPUBLISHED").length, ARCHIVED: filtered.filter((item) => item.status === "ARCHIVED").length } };
  });

  app.get<{ Params: { id: string } }>("/api/admin/cms/documents/:id", cmsPolicy("cms.read"), async (request, reply) => {
    const row = findRow(db, request.params.id);
    if (!row) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    return { ok: true, item: mapDocument(row), attachments: { supported: false, reason: "UNVERIFIED_NOT_PRESENT_IN_CURRENT_OWNER" } };
  });

  app.post<{ Body: Record<string, unknown> }>("/api/admin/cms/documents", cmsPolicy("cms.create"), async (request, reply) => {
    const body = request.body || {};
    const id = String(body.id || "").trim();
    const name = String(body.name || body.title || "").trim();
    if (!id || !name || findRow(db, id)) return reply.code(id && findRow(db, id) ? 409 : 400).send({ ok: false, error: "VALIDATION_FAILED" });
    const now = Date.now();
    const row = { id, name, kind: String(body.kind || "file"), status: "pending", updated_at: now, tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []), meta: null };
    db.prepare("INSERT INTO documents (id, name, kind, status, updated_at, tags, meta) VALUES (?, ?, ?, ?, ?, ?, ?)").run(row.id, row.name, row.kind, row.status, row.updated_at, row.tags, row.meta);
    const item = mapDocument(row);
    await recordMutation(request, "created", id, null, item);
    return reply.code(201).send({ ok: true, item });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/api/admin/cms/documents/:id", cmsPolicy("cms.edit"), async (request, reply) => {
    const existing = findRow(db, request.params.id);
    if (!existing) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    const before = mapDocument(existing);
    const next = { ...existing, name: request.body?.name || request.body?.title || existing.name, kind: request.body?.kind || existing.kind, tags: JSON.stringify(Array.isArray(request.body?.tags) ? request.body.tags : parseTags(existing)), updated_at: Date.now() };
    writeRow(db, next);
    const item = mapDocument(next);
    await recordMutation(request, "updated", request.params.id, before, item);
    return { ok: true, item };
  });

  for (const action of ["publish", "unpublish", "archive"] as const) {
    app.post<{ Params: { id: string } }>(`/api/admin/cms/documents/:id/actions/${action}`, cmsPolicy(`cms.${action}`), async (request, reply) => {
      const existing = findRow(db, request.params.id);
      if (!existing) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      const before = mapDocument(existing);
      const next = { ...existing, status: action === "publish" ? "verified" : action === "archive" ? "rejected" : "pending", updated_at: Date.now() };
      writeRow(db, next);
      const item = mapDocument(next);
      await recordMutation(request, action, request.params.id, before, item);
      return { ok: true, item };
    });
  }

  app.get<{ Params: { id: string } }>("/api/admin/cms/documents/:id/versions", cmsPolicy("cms.version.read"), async (request) => ({ ok: true, versions: await listAdminEntityVersions("cms.documents", request.params.id) }));
  app.get<{ Params: { id: string } }>("/api/admin/cms/documents/:id/audit", cmsPolicy("cms.audit.read"), async (request) => ({ ok: true, events: (await listRecentAdminAuditEvents(200)).filter((event) => event.entityType === "document" && event.entityId === request.params.id) }));
  app.post<{ Params: { id: string; versionId: string } }>("/api/admin/cms/documents/:id/rollback/:versionId", cmsPolicy("cms.edit"), async (request, reply) => {
    const existing = findRow(db, request.params.id);
    const version = (await listAdminEntityVersions("cms.documents", request.params.id)).find((candidate) => candidate.id === request.params.versionId);
    if (!existing || !version || !version.snapshot || typeof version.snapshot !== "object") return reply.code(404).send({ ok: false, error: "CMS_VERSION_NOT_FOUND" });
    const snapshot = (version.snapshot as { record?: Record<string, unknown> }).record || version.snapshot as Record<string, unknown>;
    const before = mapDocument(existing);
    writeRow(db, { ...existing, name: snapshot.name || snapshot.title || existing.name, kind: snapshot.kind || existing.kind, status: snapshot.status === "PUBLISHED" ? "verified" : snapshot.status === "ARCHIVED" ? "rejected" : "pending", tags: JSON.stringify(Array.isArray(snapshot.tags) ? snapshot.tags : parseTags(existing)), updated_at: Date.now() });
    const item = mapDocument(findRow(db, request.params.id)!);
    await recordMutation(request, "rollback", request.params.id, before, item);
    return { ok: true, item };
  });
}
