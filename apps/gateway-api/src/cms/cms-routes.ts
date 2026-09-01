import path from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../admin-authority/adminAuthorityGuard.js";
import { listRecentAdminAuditEvents } from "../admin-authority/adminAuthorityAudit.js";
import { listAdminEntityVersions } from "../admin-authority/adminAuthorityVersioning.js";
import { getProcedureRuntimeInfo } from "../procedures/config.js";
import { loadIndex } from "../procedures/indexer.js";
import { readJsonl } from "../procedures/jsonl.js";
import type { Procedure, ProcToDocs, StoredDocAsset } from "../procedures/types.js";
import { registerDocumentsCmsRoutes } from "./documents/documents-cms-adapter.js";
import { registerFormsCmsRoutes } from "./forms/forms-cms-adapter.js";
import { registerAnnouncementsCmsRoutes } from "./announcements/announcements-cms-adapter.js";
import { PayloadSyncError, payloadCanonicalSync } from "./payloadCanonicalSync.js";

type CmsStatus = "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
type CmsProcedure = Procedure & {
  status?: CmsStatus;
  created_at?: string;
  created_by?: string;
  updated_by?: string;
  published_at?: string;
  published_by?: string;
  archived_at?: string;
  archived_by?: string;
};

const STATUS_VALUES: CmsStatus[] = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];
const cmsPolicy = (key: string) => ({ preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey(key))] });

function payloadCanonicalOwner(reply: any) {
  return reply.code(409).send({ ok: false, error: "CANONICAL_EDITOR_PAYLOAD", canonicalEditor: "PAYLOAD" });
}

function dataPath(fileName: string): string {
  return path.join(getProcedureRuntimeInfo().dataDir, fileName);
}

async function getProcedures(): Promise<CmsProcedure[]> {
  return (await loadIndex(false)).procedures as CmsProcedure[];
}

function actorId(request: FastifyRequest): string {
  const user = (request as any).user;
  return String(user?.id || user?.sub || "unknown-admin");
}

function normalizeStatus(row: CmsProcedure): CmsStatus {
  return STATUS_VALUES.includes(row.status as CmsStatus) ? row.status as CmsStatus : "PUBLISHED";
}

function toCmsItem(row: CmsProcedure) {
  return {
    id: row.id,
    domain: "procedures",
    canonicalIdentity: row.id,
    title: row.title_ar,
    status: normalizeStatus(row),
    version: row.version || "1",
    updatedAt: row.last_updated || null,
    publishedAt: row.published_at || null,
    archivedAt: row.archived_at || null,
    record: row,
  };
}

function toEditorialDocumentItem(document: StoredDocAsset, activatedAt: string, runId: string) {
  return {
    id: document.id,
    title: document.title,
    status: "PUBLISHED" as const,
    version: runId,
    updatedAt: activatedAt,
    record: document,
    document,
    canonicalEditor: "PAYLOAD" as const,
  };
}

export async function cmsRoutes(app: FastifyInstance): Promise<void> {
  registerDocumentsCmsRoutes(app);
  registerFormsCmsRoutes(app);
  registerAnnouncementsCmsRoutes(app);
  app.get("/api/admin/cms/payload-sync/status", cmsPolicy("cms.payload_sync.read"), async () => ({
    ok: true,
    source: "PAYLOAD",
    ...payloadCanonicalSync.getStatus(),
  }));
  app.post("/api/admin/cms/payload-sync/sync", cmsPolicy("cms.payload_sync.trigger"), async (request, reply) => {
    try {
      return await payloadCanonicalSync.sync({
        actorId: actorId(request),
        requestId: request.id,
        ip: request.ip,
        userAgent: request.headers["user-agent"]?.toString(),
      });
    } catch (error) {
      if (error instanceof PayloadSyncError) {
        return reply.code(error.statusCode).send({ ok: false, error: error.code });
      }
      throw error;
    }
  });
  app.get("/api/admin/cms/registry", cmsPolicy("cms.read"), async () => ({
    ok: true,
    children: [{
      domainId: "procedures",
      displayName: "Procedures",
      route: "/superadmin/cms/procedures",
      apiBase: "/api/admin/cms/procedures",
      identityField: "id",
      lifecycle: STATUS_VALUES,
    }, {
      domainId: "forms",
      displayName: "Forms",
      route: "/superadmin/cms/forms",
      apiBase: "/api/admin/cms/forms",
      identityField: "publicId",
      lifecycle: STATUS_VALUES,
    }, {
      domainId: "announcements",
      displayName: "Announcements",
      route: "/superadmin/cms/announcements",
      apiBase: "/api/admin/cms/announcements",
      identityField: "publicId",
      lifecycle: STATUS_VALUES,
    }, {
      domainId: "documents",
      displayName: "Documents",
      route: "/superadmin/cms/documents",
      apiBase: "/api/admin/cms/documents",
      identityField: "id",
      lifecycle: STATUS_VALUES,
    }],
  }));

  app.get<{ Querystring: { q?: string; page?: string; pageSize?: string } }>("/api/admin/cms/editorial-documents", cmsPolicy("cms.payload_sync.read"), async (request) => {
    const syncStatus = payloadCanonicalSync.getStatus();
    const pageSize = Math.min(Math.max(Number(request.query.pageSize || 25), 1), 100);
    const page = Math.max(Number(request.query.page || 1), 1);
    if (getProcedureRuntimeInfo().source !== "payload_sync" || !syncStatus.active) {
      return {
        ok: true,
        source: "PAYLOAD",
        canonicalEditor: "PAYLOAD",
        available: false,
        items: [],
        total: 0,
        page,
        pageSize,
        sync: syncStatus,
      };
    }

    const term = String(request.query.q || "").trim().toLocaleLowerCase();
    const documents = (await loadIndex(false)).docs.filter((document) => !term || JSON.stringify(document).toLocaleLowerCase().includes(term));
    const items = documents
      .slice((page - 1) * pageSize, page * pageSize)
      .map((document) => toEditorialDocumentItem(document, syncStatus.active?.activatedAt || "", syncStatus.active?.runId || ""));
    return {
      ok: true,
      source: "PAYLOAD",
      canonicalEditor: "PAYLOAD",
      available: true,
      items,
      total: documents.length,
      page,
      pageSize,
      sync: syncStatus,
    };
  });

  app.get<{ Params: { id: string } }>("/api/admin/cms/editorial-documents/:id", cmsPolicy("cms.payload_sync.read"), async (request, reply) => {
    const syncStatus = payloadCanonicalSync.getStatus();
    if (getProcedureRuntimeInfo().source !== "payload_sync" || !syncStatus.active) {
      return reply.code(404).send({ ok: false, error: "PAYLOAD_EDITORIAL_DOCUMENT_NOT_AVAILABLE" });
    }
    const document = (await loadIndex(false)).docs.find((candidate) => candidate.id.toLocaleLowerCase() === request.params.id.toLocaleLowerCase());
    if (!document) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    return {
      ok: true,
      source: "PAYLOAD",
      canonicalEditor: "PAYLOAD",
      item: toEditorialDocumentItem(document, syncStatus.active.activatedAt, syncStatus.active.runId),
    };
  });

  app.get<{ Params: { domain: string } }>("/api/admin/cms/:domain", cmsPolicy("cms.read"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    const query = request.query as { q?: string; status?: CmsStatus; page?: string; pageSize?: string; sort?: string; direction?: string };
    const term = String(query.q || "").trim().toLocaleLowerCase();
    const status = STATUS_VALUES.includes(query.status as CmsStatus) ? query.status : undefined;
    const all = (await getProcedures()).filter((row) => {
      const serialized = JSON.stringify(row).toLocaleLowerCase();
      return (!status || normalizeStatus(row) === status) && (!term || serialized.includes(term));
    });
    const sort = query.sort === "title" ? (row: CmsProcedure) => row.title_ar : (row: CmsProcedure) => row.last_updated || "";
    all.sort((left, right) => sort(left).localeCompare(sort(right)) * (query.direction === "desc" ? -1 : 1));
    const pageSize = Math.min(Math.max(Number(query.pageSize || 25), 1), 100);
    const page = Math.max(Number(query.page || 1), 1);
    const items = all.slice((page - 1) * pageSize, page * pageSize).map(toCmsItem);
    return { ok: true, domain: "procedures", items, total: all.length, page, pageSize, statusCounts: Object.fromEntries(STATUS_VALUES.map((value) => [value, all.filter((row) => normalizeStatus(row) === value).length])) };
  });

  app.get<{ Params: { domain: string; id: string } }>("/api/admin/cms/:domain/:id", cmsPolicy("cms.read"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    const row = (await getProcedures()).find((candidate) => candidate.id.toLowerCase() === request.params.id.toLowerCase());
    if (!row) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    const links = await readJsonl<ProcToDocs>(dataPath("procedure_to_docs.jsonl"));
    return { ok: true, item: toCmsItem(row), attachments: links.find((link) => link.procedure_id === row.id)?.doc_ids || [] };
  });

  app.post<{ Params: { domain: string }; Body: Partial<CmsProcedure> }>("/api/admin/cms/:domain", cmsPolicy("cms.create"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    return payloadCanonicalOwner(reply);
  });

  app.patch<{ Params: { domain: string; id: string }; Body: Partial<CmsProcedure> }>("/api/admin/cms/:domain/:id", cmsPolicy("cms.edit"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    return payloadCanonicalOwner(reply);
  });

  app.put<{ Params: { domain: string; id: string }; Body: { doc_ids?: string[] } }>("/api/admin/cms/:domain/:id/attachments", cmsPolicy("cms.procedures.attachments.manage"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    return payloadCanonicalOwner(reply);
  });

  for (const action of ["publish", "unpublish", "archive", "restore"] as const) {
    app.post<{ Params: { domain: string; id: string } }>(`/api/admin/cms/:domain/:id/actions/${action}`, cmsPolicy(`cms.${action}`), async (request, reply) => {
      if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
      return payloadCanonicalOwner(reply);
    });
  }

  app.get<{ Params: { domain: string; id: string } }>("/api/admin/cms/:domain/:id/versions", cmsPolicy("cms.version.read"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    return { ok: true, versions: await listAdminEntityVersions("cms.procedures", request.params.id) };
  });

  app.get<{ Params: { domain: string; id: string } }>("/api/admin/cms/:domain/:id/audit", cmsPolicy("cms.audit.read"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    const events = await listRecentAdminAuditEvents(200);
    return { ok: true, events: events.filter((event) => event.entityType === "procedure" && event.entityId === request.params.id) };
  });
}
