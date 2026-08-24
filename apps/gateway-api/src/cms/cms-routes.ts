import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../admin-authority/adminAuthorityGuard.js";
import { appendAdminAuditEvent, createAdminAuditEvent, listRecentAdminAuditEvents } from "../admin-authority/adminAuthorityAudit.js";
import { createAdminEntityVersion, listAdminEntityVersions } from "../admin-authority/adminAuthorityVersioning.js";
import { getProcedureRuntimeInfo } from "../procedures/config.js";
import { loadIndex, reloadIndex } from "../procedures/indexer.js";
import { readJsonl } from "../procedures/jsonl.js";
import type { Procedure, ProcToDocs } from "../procedures/types.js";
import { registerDocumentsCmsRoutes } from "./documents/documents-cms-adapter.js";
import { registerFormsCmsRoutes } from "./forms/forms-cms-adapter.js";
import { registerAnnouncementsCmsRoutes } from "./announcements/announcements-cms-adapter.js";

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

function dataPath(fileName: string): string {
  return path.join(getProcedureRuntimeInfo().dataDir, fileName);
}

async function getProcedures(): Promise<CmsProcedure[]> {
  return (await loadIndex(false)).procedures as CmsProcedure[];
}

function writeProcedures(rows: CmsProcedure[]): void {
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(dataPath("procedures.jsonl"), body ? `${body}\n` : "", "utf8");
}

function writeLinks(rows: ProcToDocs[]): void {
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  fs.writeFileSync(dataPath("procedure_to_docs.jsonl"), body ? `${body}\n` : "", "utf8");
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

async function recordMutation(request: FastifyRequest, action: string, id: string, before: unknown, after: unknown): Promise<void> {
  const actor = actorId(request);
  await createAdminEntityVersion({ entityType: "cms.procedures", entityId: id, snapshot: after, createdBy: actor, reason: action });
  await appendAdminAuditEvent(createAdminAuditEvent({
    eventType: `cms.procedures.${action}`,
    actorId: actor,
    entityType: "procedure",
    entityId: id,
    before,
    after,
    reason: action,
    requestId: request.id,
    ip: request.ip,
    userAgent: request.headers["user-agent"]?.toString(),
  }));
}

export async function cmsRoutes(app: FastifyInstance): Promise<void> {
  registerDocumentsCmsRoutes(app);
  registerFormsCmsRoutes(app);
  registerAnnouncementsCmsRoutes(app);
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
    const id = String(request.body?.id || "").trim();
    const title = String(request.body?.title_ar || "").trim();
    if (!/^proc-[A-Za-z0-9_-]+$/.test(id) || !title) return reply.code(400).send({ ok: false, error: "VALIDATION_FAILED" });
    const rows = await getProcedures();
    if (rows.some((candidate) => candidate.id.toLowerCase() === id.toLowerCase())) return reply.code(409).send({ ok: false, error: "CMS_ID_ALREADY_EXISTS" });
    const now = new Date().toISOString();
    const created: CmsProcedure = {
      ...request.body,
      id,
      title_ar: title,
      summary_lb: String(request.body?.summary_lb || "Synthetic CMS canary"),
      source: "internal",
      status: "DRAFT",
      version: "1",
      created_at: now,
      created_by: actorId(request),
      last_updated: now,
      updated_by: actorId(request),
    };
    rows.push(created);
    writeProcedures(rows);
    await reloadIndex();
    await recordMutation(request, "created", created.id, null, created);
    return reply.code(201).send({ ok: true, item: toCmsItem(created) });
  });

  app.patch<{ Params: { domain: string; id: string }; Body: Partial<CmsProcedure> }>("/api/admin/cms/:domain/:id", cmsPolicy("cms.edit"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    const rows = await getProcedures();
    const index = rows.findIndex((candidate) => candidate.id.toLowerCase() === request.params.id.toLowerCase());
    if (index < 0) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    const before = { ...rows[index] };
    const updated = { ...rows[index], ...request.body, id: rows[index].id, last_updated: new Date().toISOString(), updated_by: actorId(request) };
    rows[index] = updated;
    writeProcedures(rows);
    await reloadIndex();
    await recordMutation(request, "updated", updated.id, before, updated);
    return { ok: true, item: toCmsItem(updated) };
  });

  app.put<{ Params: { domain: string; id: string }; Body: { doc_ids?: string[] } }>("/api/admin/cms/:domain/:id/attachments", cmsPolicy("cms.procedures.attachments.manage"), async (request, reply) => {
    if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
    const rows = await getProcedures();
    const procedure = rows.find((candidate) => candidate.id.toLowerCase() === request.params.id.toLowerCase());
    if (!procedure) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
    const requestedIds = Array.isArray(request.body?.doc_ids) ? request.body.doc_ids.map(String).filter(Boolean) : [];
    const links = await readJsonl<ProcToDocs>(dataPath("procedure_to_docs.jsonl"));
    const before = links.find((link) => link.procedure_id === procedure.id)?.doc_ids || [];
    const nextLinks = links.filter((link) => link.procedure_id !== procedure.id);
    if (requestedIds.length) nextLinks.push({ procedure_id: procedure.id, doc_ids: requestedIds });
    writeLinks(nextLinks);
    await recordMutation(request, "attachments.updated", procedure.id, { doc_ids: before }, { doc_ids: requestedIds });
    return { ok: true, procedureId: procedure.id, doc_ids: requestedIds };
  });

  for (const action of ["publish", "unpublish", "archive", "restore"] as const) {
    app.post<{ Params: { domain: string; id: string } }>(`/api/admin/cms/:domain/:id/actions/${action}`, cmsPolicy(`cms.${action}`), async (request, reply) => {
      if (request.params.domain !== "procedures") return reply.code(404).send({ ok: false, error: "CMS_DOMAIN_NOT_FOUND" });
      const rows = await getProcedures();
      const index = rows.findIndex((candidate) => candidate.id.toLowerCase() === request.params.id.toLowerCase());
      if (index < 0) return reply.code(404).send({ ok: false, error: "CMS_ITEM_NOT_FOUND" });
      const before = { ...rows[index] };
      let status: CmsStatus = "DRAFT";
      if (action === "publish") status = "PUBLISHED";
      else if (action === "unpublish") status = "UNPUBLISHED";
      else if (action === "archive") status = "ARCHIVED";
      const now = new Date().toISOString();
      const updated = { ...rows[index], status, last_updated: now, updated_by: actorId(request), ...(action === "publish" ? { published_at: now, published_by: actorId(request) } : {}), ...(action === "archive" ? { archived_at: now, archived_by: actorId(request) } : {}) };
      rows[index] = updated;
      writeProcedures(rows);
      await reloadIndex();
      await recordMutation(request, action, updated.id, before, updated);
      return { ok: true, item: toCmsItem(updated) };
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
