import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import { requireRole } from "../auth/rbac.js";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../admin-authority/adminAuthorityGuard.js";
import { appendAdminAuditEvent, createAdminAuditEvent, listRecentAdminAuditEvents } from "../admin-authority/adminAuthorityAudit.js";
import { createAdminEntityVersion, listAdminEntityVersions } from "../admin-authority/adminAuthorityVersioning.js";

export interface NewsItemBody {
  title?: string;
  body?: string | null;
  category?: string | null;
  image_url?: string | null;
  source_url?: string | null;
  is_published?: number;
  published_at?: number;
  status?: NewsStatus;
}

export type NewsStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";

type NewsRow = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  image_url: string | null;
  source_url: string | null;
  is_published: number;
  published_at: number;
  created_at: number;
  updated_at: number;
  created_by: string | null;
  status?: NewsStatus;
  archived_at?: number | null;
};

const STATUS_VALUES: NewsStatus[] = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
const cmsPolicy = (key: string) => ({ preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey(key))] });

function actorId(request: FastifyRequest): string {
  const user = (request as any).user;
  return String(user?.id || user?.sub || user?.phone || "unknown-admin");
}

function normalizeStatus(row: NewsRow): NewsStatus {
  return row.status && STATUS_VALUES.includes(row.status) ? row.status : row.is_published === 1 ? "PUBLISHED" : "DRAFT";
}

function isPublished(status: NewsStatus): number {
  return status === "PUBLISHED" ? 1 : 0;
}

function toAdminItem(row: NewsRow): NewsRow & { status: NewsStatus } {
  return { ...row, status: normalizeStatus(row) };
}

function requestedStatus(body: NewsItemBody, fallback: NewsStatus): NewsStatus {
  if (body.status && STATUS_VALUES.includes(body.status)) return body.status;
  if (body.is_published !== undefined) return body.is_published === 1 ? "PUBLISHED" : "UNPUBLISHED";
  return fallback;
}

function cleanNullable(value: string | null | undefined): string | null | undefined {
  return value === undefined || value === null ? value : value.trim() || null;
}

function updateRow(app: FastifyInstance, row: NewsRow): NewsRow {
  app.pluginDb.prepare(`UPDATE news_items SET title = ?, body = ?, category = ?, image_url = ?, source_url = ?, is_published = ?, published_at = ?, updated_at = ?, status = ?, archived_at = ? WHERE id = ?`).run(
    row.title,
    row.body,
    row.category,
    row.image_url,
    row.source_url,
    row.is_published,
    row.published_at,
    row.updated_at,
    row.status,
    row.archived_at ?? null,
    row.id,
  );
  return app.pluginDb.prepare("SELECT * FROM news_items WHERE id = ?").get(row.id) as NewsRow;
}

async function recordMutation(request: FastifyRequest, action: string, id: string, before: unknown, after: unknown): Promise<void> {
  const actor = actorId(request);
  await createAdminEntityVersion({ entityType: "cms.news", entityId: id, snapshot: after, createdBy: actor, reason: action });
  await appendAdminAuditEvent(createAdminAuditEvent({
    eventType: `cms.news.${action}`,
    actorId: actor,
    entityType: "news",
    entityId: id,
    before,
    after,
    reason: action,
    requestId: request.id,
    ip: request.ip,
    userAgent: request.headers["user-agent"]?.toString(),
  }));
}

export const adminNewsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/news", { preHandler: [requireRole("admin")] }, async (_req, reply) => {
    const rows = app.pluginDb.prepare("SELECT * FROM news_items ORDER BY published_at DESC").all() as NewsRow[];
    reply.send(rows.map(toAdminItem));
  });

  app.post<{ Body: NewsItemBody }>("/admin/news", cmsPolicy("cms.create"), async (request, reply) => {
    const body = request.body ?? {};
    const title = body.title?.trim() || "";
    if (!title) return reply.status(400).send({ error: "العنوان مطلوب" });

    const now = Date.now();
    const status = requestedStatus(body, "DRAFT");
    const id = randomUUID();
    app.pluginDb.prepare(`INSERT INTO news_items (id, title, body, category, image_url, source_url, is_published, published_at, created_at, updated_at, created_by, status, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      title,
      cleanNullable(body.body) ?? null,
      cleanNullable(body.category) ?? null,
      cleanNullable(body.image_url) ?? null,
      cleanNullable(body.source_url) ?? null,
      isPublished(status),
      body.published_at ?? now,
      now,
      now,
      actorId(request),
      status,
      status === "ARCHIVED" ? now : null,
    );

    const row = app.pluginDb.prepare("SELECT * FROM news_items WHERE id = ?").get(id) as NewsRow;
    await recordMutation(request, "created", id, null, toAdminItem(row));
    reply.status(201).send(toAdminItem(row));
  });

  app.patch<{ Params: { id: string }; Body: NewsItemBody }>("/admin/news/:id", cmsPolicy("cms.edit"), async (request, reply) => {
    const existing = app.pluginDb.prepare("SELECT * FROM news_items WHERE id = ?").get(request.params.id) as NewsRow | undefined;
    if (!existing) return reply.status(404).send({ error: "not found" });

    const body = request.body ?? {};
    if (body.title !== undefined && !body.title.trim()) return reply.status(400).send({ error: "العنوان مطلوب" });
    const current = toAdminItem(existing);
    const status = requestedStatus(body, current.status);
    const next: NewsRow = {
      ...current,
      title: body.title !== undefined ? body.title.trim() : current.title,
      body: cleanNullable(body.body) ?? current.body,
      category: cleanNullable(body.category) ?? current.category,
      image_url: cleanNullable(body.image_url) ?? current.image_url,
      source_url: cleanNullable(body.source_url) ?? current.source_url,
      is_published: isPublished(status),
      published_at: body.published_at ?? current.published_at,
      updated_at: Date.now(),
      status,
      archived_at: status === "ARCHIVED" ? current.archived_at ?? Date.now() : null,
    };
    const row = updateRow(app, next);
    await recordMutation(request, "updated", row.id, current, toAdminItem(row));
    reply.send(toAdminItem(row));
  });

  const lifecycle: Record<"publish" | "unpublish" | "archive", NewsStatus> = {
    publish: "PUBLISHED",
    unpublish: "UNPUBLISHED",
    archive: "ARCHIVED",
  };
  for (const action of ["publish", "unpublish", "archive"] as const) {
    app.post<{ Params: { id: string } }>(`/admin/news/:id/actions/${action}`, cmsPolicy(`cms.${action}`), async (request, reply) => {
      const existing = app.pluginDb.prepare("SELECT * FROM news_items WHERE id = ?").get(request.params.id) as NewsRow | undefined;
      if (!existing) return reply.status(404).send({ error: "not found" });
      const current = toAdminItem(existing);
      const status = lifecycle[action];
      const now = Date.now();
      const next: NewsRow = {
        ...current,
        is_published: isPublished(status),
        published_at: action === "publish" ? now : current.published_at,
        updated_at: now,
        status,
        archived_at: action === "archive" ? now : null,
      };
      const row = updateRow(app, next);
      await recordMutation(request, action, row.id, current, toAdminItem(row));
      reply.send(toAdminItem(row));
    });
  }

  app.post<{ Params: { id: string } }>("/admin/news/:id/actions/restore", cmsPolicy("cms.restore"), async (request, reply) => {
    const existing = app.pluginDb.prepare("SELECT * FROM news_items WHERE id = ?").get(request.params.id) as NewsRow | undefined;
    if (!existing) return reply.status(404).send({ error: "not found" });
    const current = toAdminItem(existing);
    const next: NewsRow = { ...current, is_published: 0, status: "DRAFT", archived_at: null, updated_at: Date.now() };
    const row = updateRow(app, next);
    await recordMutation(request, "restore", row.id, current, toAdminItem(row));
    reply.send(toAdminItem(row));
  });

  app.post<{ Params: { id: string }; Body: { version?: number } }>("/admin/news/:id/actions/rollback", cmsPolicy("cms.restore"), async (request, reply) => {
    const existing = app.pluginDb.prepare("SELECT * FROM news_items WHERE id = ?").get(request.params.id) as NewsRow | undefined;
    if (!existing) return reply.status(404).send({ error: "not found" });
    const current = toAdminItem(existing);
    const versions = await listAdminEntityVersions("cms.news", request.params.id);
    const requestedVersion = Number(request.body?.version);
    const target = Number.isFinite(requestedVersion) && requestedVersion > 0
      ? versions.find((version) => version.version === requestedVersion)
      : versions[1];
    const snapshot = target?.snapshot as Partial<NewsRow> | undefined;
    if (!target || !snapshot || snapshot.id !== request.params.id || typeof snapshot.title !== "string") {
      return reply.status(409).send({ error: "NEWS_VERSION_NOT_FOUND" });
    }

    const status = snapshot.status && STATUS_VALUES.includes(snapshot.status) ? snapshot.status : snapshot.is_published === 1 ? "PUBLISHED" : "DRAFT";
    const next: NewsRow = {
      ...current,
      ...snapshot,
      id: current.id,
      title: snapshot.title,
      body: snapshot.body ?? null,
      category: snapshot.category ?? null,
      image_url: snapshot.image_url ?? null,
      source_url: snapshot.source_url ?? null,
      is_published: isPublished(status),
      published_at: snapshot.published_at ?? current.published_at,
      created_at: current.created_at,
      created_by: current.created_by,
      updated_at: Date.now(),
      status,
      archived_at: status === "ARCHIVED" ? snapshot.archived_at ?? Date.now() : null,
    };
    const row = updateRow(app, next);
    await recordMutation(request, "rollback", row.id, current, toAdminItem(row));
    reply.send({ ...toAdminItem(row), rolledBackToVersion: target.version });
  });

  app.get<{ Params: { id: string } }>("/admin/news/:id/versions", cmsPolicy("cms.version.read"), async (request) => ({
    ok: true,
    versions: await listAdminEntityVersions("cms.news", request.params.id),
  }));

  app.get<{ Params: { id: string } }>("/admin/news/:id/audit", cmsPolicy("cms.audit.read"), async (request) => ({
    ok: true,
    events: (await listRecentAdminAuditEvents(200)).filter((event) => event.entityType === "news" && event.entityId === request.params.id),
  }));

  app.delete<{ Params: { id: string } }>("/admin/news/:id", cmsPolicy("cms.archive"), async (request, reply) => {
    const existing = app.pluginDb.prepare("SELECT * FROM news_items WHERE id = ?").get(request.params.id) as NewsRow | undefined;
    if (!existing) return reply.status(404).send({ error: "not found" });
    const current = toAdminItem(existing);
    const changes = app.pluginDb.prepare("DELETE FROM news_items WHERE id = ?").run(request.params.id).changes;
    if (!changes) return reply.status(404).send({ error: "not found" });
    await recordMutation(request, "deleted", request.params.id, current, null);
    reply.send({ ok: true });
  });
};
