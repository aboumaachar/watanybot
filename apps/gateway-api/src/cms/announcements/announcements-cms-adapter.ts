import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../../admin-authority/adminAuthorityGuard.js";
import { appendAdminAuditEvent, createAdminAuditEvent, listRecentAdminAuditEvents } from "../../admin-authority/adminAuthorityAudit.js";
import { createAdminEntityVersion, listAdminEntityVersions } from "../../admin-authority/adminAuthorityVersioning.js";
import { createGenericCmsEntity, getGenericCmsEntity, listGenericCmsEntities, updateGenericCmsEntity } from "../storage/genericCmsRepository.js";

const DOMAIN = "announcements";
const cmsPolicy = (key: string) => ({ preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey(key))] });
const actorId = (request: FastifyRequest) => String((request as any).user?.id || (request as any).user?.sub || "unknown-admin");
const toItem = (item: Awaited<ReturnType<typeof getGenericCmsEntity>>) => item ? ({ ...item, version: String(item.revision), record: { publicId: item.publicId, publicCode: item.publicCode, sourceId: item.sourceId, ...item.payload } }) : null;

async function recordMutation(request: FastifyRequest, action: string, id: string, before: unknown, after: unknown): Promise<void> {
  const actor = actorId(request);
  await createAdminEntityVersion({ entityType: "cms.announcements", entityId: id, snapshot: after, createdBy: actor, reason: action });
  await appendAdminAuditEvent(createAdminAuditEvent({ eventType: `cms.announcements.${action}`, actorId: actor, entityType: "announcement", entityId: id, before, after, reason: action, requestId: request.id, ip: request.ip, userAgent: request.headers["user-agent"]?.toString() }));
}

export function registerAnnouncementsCmsRoutes(app: FastifyInstance): void {
  app.get("/api/admin/cms/announcements", cmsPolicy("cms.read"), async (request) => {
    const query = request.query as { q?: string; status?: string };
    const items = (await listGenericCmsEntities(DOMAIN, query.q, query.status as any)).map(toItem);
    return { ok: true, domain: DOMAIN, items, total: items.length, page: 1, pageSize: items.length, statusCounts: {} };
  });
  app.get<{ Params: { id: string } }>("/api/admin/cms/announcements/:id", cmsPolicy("cms.read"), async (request, reply) => {
    const item = await getGenericCmsEntity(DOMAIN, request.params.id);
    return item ? { ok: true, item: toItem(item) } : reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
  });
  app.post<{ Body: { publicId?: string; publicCode?: string; sourceId?: string; title?: string; payload?: Record<string, unknown>; sourceMeta?: Record<string, unknown> } }>("/api/admin/cms/announcements", cmsPolicy("cms.create"), async (request, reply) => {
    const body = request.body || {};
    if (!body.publicId || !body.title) return reply.code(400).send({ ok: false, error: "VALIDATION_FAILED" });
    try {
      const item = await createGenericCmsEntity({ domain: DOMAIN, publicId: body.publicId, publicCode: body.publicCode || null, sourceId: body.sourceId || null, status: "DRAFT", locale: "ar", title: body.title, payload: body.payload || {}, sourceMeta: body.sourceMeta || {}, createdBy: actorId(request), updatedBy: actorId(request) });
      await recordMutation(request, "created", item.publicId, null, item);
      return reply.code(201).send({ ok: true, item: toItem(item) });
    } catch { return reply.code(409).send({ ok: false, error: "CMS_ID_ALREADY_EXISTS" }); }
  });
  app.patch<{ Params: { id: string }; Body: { title?: string; payload?: Record<string, unknown>; sourceMeta?: Record<string, unknown> } }>("/api/admin/cms/announcements/:id", cmsPolicy("cms.edit"), async (request, reply) => {
    const before = await getGenericCmsEntity(DOMAIN, request.params.id);
    if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    const item = await updateGenericCmsEntity(DOMAIN, request.params.id, { ...request.body, updatedBy: actorId(request) });
    await recordMutation(request, "updated", request.params.id, before, item);
    return { ok: true, item: toItem(item) };
  });
  for (const action of ["publish", "unpublish", "archive"] as const) app.post<{ Params: { id: string } }>(`/api/admin/cms/announcements/:id/actions/${action}`, cmsPolicy(`cms.${action}`), async (request, reply) => {
    const before = await getGenericCmsEntity(DOMAIN, request.params.id);
    if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    const item = await updateGenericCmsEntity(DOMAIN, request.params.id, { status: action === "publish" ? "PUBLISHED" : action === "archive" ? "ARCHIVED" : "UNPUBLISHED", updatedBy: actorId(request) });
    await recordMutation(request, action, request.params.id, before, item);
    return { ok: true, item: toItem(item) };
  });
  app.get<{ Params: { id: string } }>("/api/admin/cms/announcements/:id/versions", cmsPolicy("cms.version.read"), async (request) => ({ ok: true, versions: await listAdminEntityVersions("cms.announcements", request.params.id) }));
  app.get<{ Params: { id: string } }>("/api/admin/cms/announcements/:id/audit", cmsPolicy("cms.audit.read"), async (request) => ({ ok: true, events: (await listRecentAdminAuditEvents(200)).filter((event) => event.entityType === "announcement" && event.entityId === request.params.id) }));
}