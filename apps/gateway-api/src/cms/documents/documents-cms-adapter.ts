import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../../admin-authority/adminAuthorityGuard.js";
import { appendAdminAuditEvent, createAdminAuditEvent, listRecentAdminAuditEvents } from "../../admin-authority/adminAuthorityAudit.js";
import { createAdminEntityVersion, listAdminEntityVersions } from "../../admin-authority/adminAuthorityVersioning.js";
import { PostgresDocumentRepository } from "./documents-repository.js";
import { DocumentService, DocumentServiceError, type CmsDocumentAction, type CmsDocumentItem } from "./documents-service.js";

const cmsPolicy = (key: string) => ({ preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey(key))] });

function actorId(request: FastifyRequest): string {
  const user = (request as any).user;
  return String(user?.id || user?.sub || "unknown-admin");
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

export interface DocumentsCmsRoutesOptions {
  documentService?: DocumentService;
}

function sendServiceError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof DocumentServiceError) {
    return reply.code(error.statusCode).send({ ok: false, error: error.code });
  }
  throw error;
}

export function registerDocumentsCmsRoutes(app: FastifyInstance, options: DocumentsCmsRoutesOptions = {}): void {
  const service = options.documentService || new DocumentService(new PostgresDocumentRepository());

  app.get("/api/admin/cms/documents", cmsPolicy("cms.read"), async (request, reply) => {
    try {
      const result = await service.list(request.query as Record<string, unknown>);
      return { ok: true, domain: "documents", ...result };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>("/api/admin/cms/documents/:id", cmsPolicy("cms.read"), async (request, reply) => {
    try {
      const item = await service.get(request.params.id);
      if (!item) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      return { ok: true, item, preview: service.preview(item), attachments: { supported: false, reason: "FILE_DELIVERY_NOT_PART_OF_CURRENT_CONTRACT" } };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>("/api/admin/cms/documents/:id/preview", cmsPolicy("cms.read"), async (request, reply) => {
    try {
      const item = await service.get(request.params.id);
      if (!item) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      return { ok: true, preview: service.preview(item) };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.post<{ Body: Record<string, unknown> }>("/api/admin/cms/documents", cmsPolicy("cms.create"), async (request, reply) => {
    try {
      const item = await service.create(request.body);
      await recordMutation(request, "created", item.id, null, item);
      return reply.code(201).send({ ok: true, item });
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/api/admin/cms/documents/:id", cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const before = await service.get(request.params.id);
      if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      const item = await service.update(request.params.id, request.body);
      if (!item) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      await recordMutation(request, "updated", item.id, before, item);
      return { ok: true, item };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  app.delete<{ Params: { id: string } }>("/api/admin/cms/documents/:id", cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const before = await service.get(request.params.id);
      if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      const deleted = await service.delete(request.params.id);
      if (!deleted) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      await recordMutation(request, "deleted", before.id, before, null);
      return { ok: true, id: before.id };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });

  for (const action of ["publish", "unpublish", "archive"] as const) {
    app.post<{ Params: { id: string } }>(`/api/admin/cms/documents/:id/actions/${action}`, cmsPolicy(`cms.${action}`), async (request, reply) => {
      try {
        const before = await service.get(request.params.id);
        if (!before) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
        const item = await service.transition(request.params.id, action as CmsDocumentAction);
        if (!item) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
        await recordMutation(request, action, item.id, before, item);
        return { ok: true, item };
      } catch (error) {
        return sendServiceError(error, reply);
      }
    });
  }

  app.get<{ Params: { id: string } }>("/api/admin/cms/documents/:id/versions", cmsPolicy("cms.version.read"), async (request) => ({ ok: true, versions: await listAdminEntityVersions("cms.documents", request.params.id) }));
  app.get<{ Params: { id: string } }>("/api/admin/cms/documents/:id/audit", cmsPolicy("cms.audit.read"), async (request) => ({ ok: true, events: (await listRecentAdminAuditEvents(200)).filter((event) => event.entityType === "document" && event.entityId === request.params.id) }));
  app.post<{ Params: { id: string; versionId: string } }>("/api/admin/cms/documents/:id/rollback/:versionId", cmsPolicy("cms.edit"), async (request, reply) => {
    try {
      const before = await service.get(request.params.id);
      const version = (await listAdminEntityVersions("cms.documents", request.params.id)).find((candidate) => candidate.id === request.params.versionId);
      if (!before || !version || !version.snapshot || typeof version.snapshot !== "object") return reply.code(404).send({ ok: false, error: "CMS_VERSION_NOT_FOUND" });
      const item = await service.rollback(request.params.id, version.snapshot);
      if (!item) return reply.code(404).send({ ok: false, error: "CMS_VERSION_NOT_FOUND" });
      await recordMutation(request, "rollback", item.id, before, item);
      return { ok: true, item };
    } catch (error) {
      return sendServiceError(error, reply);
    }
  });
}
