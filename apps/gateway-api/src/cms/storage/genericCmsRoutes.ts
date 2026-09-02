import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../../admin-authority/adminAuthorityGuard.js";
import { GenericCmsService, GenericCmsServiceError, type GenericCmsRouteConfig } from "./genericCmsService.js";

const cmsPolicy = (key: string) => ({ preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey(key))] });

function actorId(request: FastifyRequest): string {
  const user = (request as any).user;
  return String(user?.id || user?.sub || "unknown-admin");
}

function sendServiceError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof GenericCmsServiceError) {
    return reply.code(error.statusCode).send({ ok: false, error: error.code, ...(error.id ? { id: error.id } : {}) });
  }
  throw error;
}

async function recordMutation(service: GenericCmsService, request: FastifyRequest, action: string, id: string, before: unknown, after: unknown): Promise<void> {
  await service.recordMutation(request, action, id, before, after);
}

export function registerGenericCmsRoutes(app: FastifyInstance, config: GenericCmsRouteConfig): void {
  const service = new GenericCmsService(config);
  const base = `/api/admin/cms/${config.domain}`;

  app.get(base, cmsPolicy("cms.read"), async (request, reply) => {
    try {
      return { ok: true, domain: config.domain, ...(await service.list(request.query as Record<string, unknown>)) };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>(`${base}/:id`, cmsPolicy("cms.read"), async (request, reply) => {
    try {
      const item = await service.get(request.params.id, true);
      return item ? { ok: true, item } : reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.post<{ Body: Record<string, unknown> }>(base, cmsPolicy("cms.create"), async (request, reply) => {
    try {
      const item = await service.create(request.body, actorId(request));
      await recordMutation(service, request, "created", item.publicId, null, item);
      return reply.code(201).send({ ok: true, item });
    } catch (error) {
      if ((error as Error & { code?: string })?.code === "23505") return reply.code(409).send({ ok: false, error: "CMS_ID_ALREADY_EXISTS" });
      return sendServiceError(error, reply);
    }
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(`${base}/:id`, cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const before = await service.get(request.params.id, true);
      if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      const item = await service.update(request.params.id, request.body, actorId(request));
      if (!item) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      await recordMutation(service, request, "updated", request.params.id, before, item);
      return { ok: true, item };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  for (const action of ["publish", "unpublish", "archive", "restore"] as const) {
    app.post<{ Params: { id: string } }>(`${base}/:id/actions/${action}`, cmsPolicy(`cms.${action}`), async (request, reply) => {
      try {
        const before = await service.get(request.params.id, true);
        if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
        const item = await service.transition(request.params.id, action, actorId(request));
        if (!item) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
        await recordMutation(service, request, action, request.params.id, before, item);
        return { ok: true, item };
      } catch (error) {
        return sendServiceError(error, reply);
      }
    });
  }

  app.post<{ Body: { ids?: string[]; patch?: Record<string, unknown> } }>(`${base}/bulk-actions/edit`, cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const ids = Array.isArray(request.body?.ids) ? request.body.ids.filter((id): id is string => typeof id === "string" && Boolean(id.trim())) : [];
      if (ids.length === 0 || !request.body?.patch || typeof request.body.patch !== "object" || Array.isArray(request.body.patch)) {
        return reply.code(400).send({ ok: false, error: "VALIDATION_FAILED" });
      }
      if (new Set(ids).size !== ids.length) return reply.code(400).send({ ok: false, error: "VALIDATION_FAILED" });
      const before = await Promise.all(ids.map((id) => service.get(id, true)));
      const missingIndex = before.findIndex((item) => !item);
      if (missingIndex >= 0) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND", id: ids[missingIndex] });
      const items = await service.bulkUpdate(ids, request.body, actorId(request), "bulk_edit");
      for (let index = 0; index < items.length; index += 1) await recordMutation(service, request, "bulk_edit", ids[index], before[index], items[index]);
      return { ok: true, items };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.post<{ Body: { ids?: string[] } }>(`${base}/bulk-actions/archive`, cmsPolicy("cms.archive"), async (request, reply) => {
    try {
      const ids = Array.isArray(request.body?.ids) ? request.body.ids.filter((id): id is string => typeof id === "string" && Boolean(id.trim())) : [];
      if (ids.length === 0) return reply.code(400).send({ ok: false, error: "VALIDATION_FAILED" });
      if (new Set(ids).size !== ids.length) return reply.code(400).send({ ok: false, error: "VALIDATION_FAILED" });
      const before = await Promise.all(ids.map((id) => service.get(id, true)));
      const missingIndex = before.findIndex((item) => !item);
      if (missingIndex >= 0) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND", id: ids[missingIndex] });
      const items = await service.bulkUpdate(ids, {}, actorId(request), "bulk_archive");
      for (let index = 0; index < items.length; index += 1) await recordMutation(service, request, "bulk_archive", ids[index], before[index], items[index]);
      return { ok: true, items };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>(`${base}/:id/versions`, cmsPolicy("cms.version.read"), async (request) => ({ ok: true, versions: await service.versions(request.params.id) }));
  app.get<{ Params: { id: string } }>(`${base}/:id/audit`, cmsPolicy("cms.audit.read"), async (request) => ({ ok: true, events: await service.audit(request.params.id) }));

  app.post<{ Params: { id: string; versionId: string } }>(`${base}/:id/rollback/:versionId`, cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const before = await service.get(request.params.id, true);
      const item = await service.rollback(request.params.id, request.params.versionId, actorId(request));
      if (!before || !item) return reply.code(404).send({ ok: false, error: "CMS_VERSION_NOT_FOUND" });
      await recordMutation(service, request, "rollback", request.params.id, before, item);
      return { ok: true, item };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.get<{ Params: { id: string }; Querystring: { relationType?: string } }>(`${base}/:id/relationships`, cmsPolicy("cms.read"), async (request) => ({ ok: true, relationships: await service.relationships(request.params.id, request.query.relationType) }));
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(`${base}/:id/relationships`, cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const before = await service.get(request.params.id, true);
      if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      const relationship = await service.addRelationship(request.params.id, request.body);
      const after = await service.get(request.params.id, true);
      await recordMutation(service, request, "relationship_added", request.params.id, before, after);
      return { ok: true, relationship };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
  app.put<{ Params: { id: string; relationType: string }; Body: Record<string, unknown> }>(`${base}/:id/relationships/:relationType`, cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const before = await service.get(request.params.id, true);
      if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      const relationships = await service.replaceRelationships(request.params.id, request.params.relationType, request.body);
      const after = await service.get(request.params.id, true);
      await recordMutation(service, request, "relationships_replaced", request.params.id, before, after);
      return { ok: true, relationships };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
  app.delete<{ Params: { id: string; relationType: string; targetDomain: string; targetPublicId: string } }>(`${base}/:id/relationships/:relationType/:targetDomain/:targetPublicId`, cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const before = await service.get(request.params.id, true);
      if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      const deleted = await service.deleteRelationship(request.params.id, request.params);
      if (!deleted) return reply.code(404).send({ ok: false, error: "CMS_RELATIONSHIP_NOT_FOUND" });
      const after = await service.get(request.params.id, true);
      await recordMutation(service, request, "relationship_deleted", request.params.id, before, after);
      return { ok: true };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
}