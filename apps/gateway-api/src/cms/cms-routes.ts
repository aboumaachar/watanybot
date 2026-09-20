import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey, resolveAdminActorFromRequest } from "../admin-authority/adminAuthorityGuard.js";
import { appendAdminAuditEvent, createAdminAuditEvent, listRecentAdminAuditEvents } from "../admin-authority/adminAuthorityAudit.js";
import { listAdminEntityVersions } from "../admin-authority/adminAuthorityVersioning.js";
import { getProcedureRuntimeInfo } from "../procedures/config.js";
import { loadIndex } from "../procedures/indexer.js";
import { readJsonl } from "../procedures/jsonl.js";
import type { Procedure, ProcToDocs, StoredDocAsset } from "../procedures/types.js";
import { registerDocumentsCmsRoutes } from "./documents/documents-cms-adapter.js";
import { registerFormsCmsRoutes } from "./forms/forms-cms-adapter.js";
import { registerAnnouncementsCmsRoutes } from "./announcements/announcements-cms-adapter.js";
import { PayloadSyncError, payloadCanonicalSync } from "./payloadCanonicalSync.js";
import { applyPayloadDocumentDrafts, getPayloadBootstrapStatus, publishPayloadDocuments } from "./payloadEditorialBootstrap.js";
import { claimImportPlan, createImportPlan, getImportPlan, markImportPlanApplied, markImportPlanRecoveryRequired, reconcileImportPlan } from "../admin-authority/adminAuthorityStore.js";
import { getCanonicalAdminPrincipal } from "../auth/rbac.js";
import { mintPayloadSsoAssertion } from "./payloadSso.js";
import { canonicalExportHash, diffProcedure, renderProcedureReviewHtml, semanticDiffHash, summarizeBulkOperation, UD3_EXPORT_SCHEMA_VERSION, validateProcedureExport, type BulkOperationFailure, type BulkProcedure, type ProcedureExport } from "./proceduresBulkWorkflow.js";

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

function toBulkProcedure(row: CmsProcedure): BulkProcedure {
  return {
    procedureCode: row.id,
    title: { ar: row.title_ar, en: row.title_en || "" },
    summary: { ar: row.summary_lb, en: row.summary_en || "" },
    eligibility: row.eligibility || [],
    requirements: row.requirements || [],
    steps: row.steps || [],
    category: row.domain || "procedures",
    sourceAuthority: row.source || "gateway-index",
    publicationState: normalizeStatus(row) === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    workflowStatus: normalizeStatus(row) === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
  };
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

type PayloadProcedureResponse = {
  docs?: Array<Record<string, unknown>>;
  doc?: Record<string, unknown>;
  id?: string | number;
  error?: string;
};

function payloadBaseUrl(): string {
  const value = String(process.env.PAYLOAD_CMS_BASE_URL || "").trim().replace(/\/+$/u, "");
  if (!value) throw new Error("PAYLOAD_CMS_BASE_URL_REQUIRED");
  return value;
}

async function payloadRequest(pathname: string, assertion: string, init: RequestInit = {}): Promise<{ status: number; body: PayloadProcedureResponse }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${assertion}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${payloadBaseUrl()}${pathname}`, { ...init, headers });
  const text = await response.text();
  let body: PayloadProcedureResponse = {};
  try { body = JSON.parse(text) as PayloadProcedureResponse; } catch { body = { error: "PAYLOAD_NON_JSON_RESPONSE" }; }
  return { status: response.status, body };
}

function payloadAssertion(request: FastifyRequest): string {
  const principal = getCanonicalAdminPrincipal(request);
  if (!principal) throw new Error("NO_AUTHENTICATED_PRINCIPAL");
  return mintPayloadSsoAssertion({ userId: principal.id, role: principal.role, capabilities: principal.capabilities });
}

function planRecords(plan: Awaited<ReturnType<typeof getImportPlan>>): BulkProcedure[] {
  const input = plan?.inputPayload;
  if (!input || typeof input !== "object" || !Array.isArray((input as ProcedureExport).records)) throw new Error("IMPORT_PLAN_PAYLOAD_INVALID");
  return (input as ProcedureExport).records;
}

function payloadDraftData(record: BulkProcedure, locale: "ar" | "en") {
  const localized = record.title[locale];
  const summary = record.summary[locale];
  return {
    canonicalId: record.procedureCode,
    procedureCode: record.procedureCode,
    slug: record.procedureCode,
    title: localized,
    summary,
    eligibility: record.eligibility.map((item) => ({ item })),
    requirements: record.requirements.map((item) => ({ item })),
    steps: record.steps.map((item) => ({ item })),
    category: record.category,
    sourceAuthority: record.sourceAuthority,
    publicationState: "DRAFT",
    workflowStatus: "DRAFT",
    _status: "draft",
  };
}

async function findPayloadProcedure(assertion: string, procedureCode: string): Promise<Record<string, unknown> | null> {
  const query = new URLSearchParams({ "where[procedureCode][equals]": procedureCode, limit: "1", locale: "all", depth: "0" });
  const response = await payloadRequest(`/api/procedures?${query.toString()}`, assertion);
  if (response.status !== 200) throw new Error(`PAYLOAD_FIND_FAILED_${response.status}`);
  return response.body.docs?.[0] || null;
}

async function capturePayloadVersion(assertion: string, procedureId: string): Promise<string> {
  const query = new URLSearchParams({ "where[parent][equals]": procedureId, limit: "1", sort: "-createdAt", depth: "0" });
  const response = await payloadRequest(`/api/procedures/versions?${query.toString()}`, assertion);
  if (response.status !== 200) throw new Error(`PAYLOAD_VERSION_READ_FAILED_${response.status}`);
  const version = response.body.docs?.[0];
  const versionId = version?.id;
  if (versionId === undefined || versionId === null) throw new Error("PAYLOAD_VERSION_ID_MISSING");
  return String(versionId);
}

async function applyPayloadDraft(assertion: string, record: BulkProcedure): Promise<{ procedureId: string; versionId: string }> {
  const existing = await findPayloadProcedure(assertion, record.procedureCode);
  let procedureId = existing?.id === undefined ? "" : String(existing.id);
  if (!procedureId) {
    const created = await payloadRequest("/api/procedures?locale=ar&draft=true", assertion, {
      method: "POST",
      body: JSON.stringify(payloadDraftData(record, "ar")),
    });
    if (created.status !== 201 && created.status !== 200) throw new Error(`PAYLOAD_CREATE_FAILED_${created.status}`);
    procedureId = String(created.body.doc?.id ?? created.body.id ?? "");
    if (!procedureId) throw new Error("PAYLOAD_CREATED_ID_MISSING");
    if (record.title.en.trim()) {
      const english = await payloadRequest(`/api/procedures/${encodeURIComponent(procedureId)}?locale=en&draft=true`, assertion, {
        method: "PATCH",
        body: JSON.stringify(payloadDraftData(record, "en")),
      });
      if (english.status !== 200) throw new Error(`PAYLOAD_EN_UPDATE_FAILED_${english.status}`);
    }
  } else {
    const updated = await payloadRequest("/api/gateway-procedures/draft-update", assertion, {
      method: "POST",
      body: JSON.stringify({
        id: procedureId,
        procedureCode: record.procedureCode,
        ar: { title: record.title.ar, summary: record.summary.ar, eligibility: record.eligibility, requirements: record.requirements, steps: record.steps },
        en: { title: record.title.en, summary: record.summary.en, eligibility: record.eligibility, requirements: record.requirements, steps: record.steps },
      }),
    });
    if (updated.status !== 200) throw new Error(`PAYLOAD_DRAFT_UPDATE_FAILED_${updated.status}`);
  }
  return { procedureId, versionId: await capturePayloadVersion(assertion, procedureId) };
}

async function publishPayloadDraft(assertion: string, record: BulkProcedure): Promise<string> {
  const existing = await findPayloadProcedure(assertion, record.procedureCode);
  const procedureId = existing?.id === undefined ? "" : String(existing.id);
  if (!procedureId) throw new Error("PAYLOAD_PUBLISH_TARGET_MISSING");
  const locales = record.title.en.trim() ? (["ar", "en"] as const) : (["ar"] as const);
  for (const locale of locales) {
    const published = await payloadRequest(`/api/procedures/${encodeURIComponent(procedureId)}?locale=${locale}&draft=false`, assertion, {
      method: "PATCH",
      body: JSON.stringify({ ...payloadDraftData(record, locale), publicationState: "PUBLISHED", workflowStatus: "PUBLISHED", _status: "published" }),
    });
    if (published.status !== 200) throw new Error(`PAYLOAD_PUBLISH_FAILED_${locale}_${published.status}`);
  }
  return procedureId;
}

export async function cmsRoutes(app: FastifyInstance): Promise<void> {
  registerDocumentsCmsRoutes(app);
  registerFormsCmsRoutes(app);
  registerAnnouncementsCmsRoutes(app);
  app.get<{ Querystring: { format?: string; q?: string; status?: CmsStatus } }>("/api/admin/cms/procedures/export", cmsPolicy("cms.read"), async (request, reply) => {
    const term = String(request.query.q || "").trim().toLocaleLowerCase();
    const status = STATUS_VALUES.includes(request.query.status as CmsStatus) ? request.query.status as CmsStatus : undefined;
    const rows = (await getProcedures()).filter((row) => {
      const serialized = JSON.stringify(row).toLocaleLowerCase();
      return (!status || normalizeStatus(row) === status) && (!term || serialized.includes(term));
    });
    const exported: ProcedureExport = { schemaVersion: UD3_EXPORT_SCHEMA_VERSION, records: rows.map(toBulkProcedure) };
    const validation = validateProcedureExport(exported);
    if (request.query.format === "html") {
      return reply.type("text/html; charset=utf-8").send(renderProcedureReviewHtml(exported, validation));
    }
    return { ok: true, export: exported, validation, filter: { q: request.query.q || null, status: status || null }, artifactPolicy: "CANONICAL_JSON_ONLY_NO_INTERNAL_IDS_OR_RUNTIME_METADATA" };
  });
  app.post<{ Body: ProcedureExport }>("/api/admin/cms/procedures/import/dry-run", cmsPolicy("cms.read"), async (request, reply) => {
    const validation = validateProcedureExport(request.body);
    const current: ProcedureExport = { schemaVersion: UD3_EXPORT_SCHEMA_VERSION, records: (await getProcedures()).map(toBulkProcedure) };
    const incomingRecords = Array.isArray(request.body?.records) ? request.body.records : [];
    const diffs = incomingRecords.flatMap((record) => {
      const before = current.records.find((candidate) => candidate.procedureCode.toLowerCase() === record.procedureCode?.toLowerCase());
      return before ? [diffProcedure(before, record)] : [];
    });
    const inputCanonicalHash = canonicalExportHash(request.body);
    const baselineEditorialHash = canonicalExportHash(current);
    const updatedRows = diffs.filter((diff) => diff.materialChange).length;
    const unchangedRows = diffs.length - updatedRows;
    const event = createAdminAuditEvent({
      eventType: "UD3_PROCEDURES_IMPORT_DRY_RUN",
      actorId: actorId(request),
      entityType: "procedures-bulk-import",
      reason: "Deterministic validation only; no Payload or Gateway mutation",
      requestId: request.id,
      ip: request.ip,
      userAgent: request.headers["user-agent"]?.toString(),
      after: { schemaVersion: (request.body as ProcedureExport)?.schemaVersion || null, validation, inputCanonicalHash, baselineEditorialHash, updatedRows, unchangedRows },
    });
    await appendAdminAuditEvent(event);
    if (!validation.valid) return reply.code(422).send({ ok: false, mode: "DRY_RUN", mutation: "NONE", validation, auditId: event.id });
    const plan = await createImportPlan({
      planId: `plan_${randomUUID()}`,
      actorGatewayUserId: actorId(request),
      schemaVersion: request.body.schemaVersion,
      inputCanonicalHash,
      baselineEditorialHash,
      semanticDiffHash: semanticDiffHash(diffs),
      inputPayload: request.body,
      status: "VALIDATED",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    return reply.code(200).send({ ok: true, mode: "DRY_RUN", mutation: "NONE", validation, rowsRead: incomingRecords.length, validRows: incomingRecords.length, invalidRows: 0, newRows: incomingRecords.filter((record) => !current.records.some((candidate) => candidate.procedureCode.toLowerCase() === record.procedureCode.toLowerCase())).length, updatedRows, unchangedRows, duplicateIds: validation.duplicateIds.length, unknownReferences: 0, materialChange: updatedRows > 0, plan, auditId: event.id });
  });
  app.post<{ Body: { planId?: string } }>("/api/admin/cms/procedures/import/apply", cmsPolicy("cms.edit"), async (request, reply) => {
    const planId = String(request.body?.planId || "").trim();
    if (!planId) return reply.code(400).send({ ok: false, error: "PLAN_ID_REQUIRED" });
    const actor = resolveAdminActorFromRequest(request);
    const plan = await getImportPlan(planId);
    if (!plan) return reply.code(404).send({ ok: false, error: "IMPORT_PLAN_NOT_FOUND" });
    if (!actor || plan.actorGatewayUserId !== actor.id) return reply.code(403).send({ ok: false, error: "IMPORT_PLAN_ACTOR_MISMATCH" });
    if (plan.status === "APPLIED") return reply.send({ ok: true, idempotent: true, state: plan.status, plan });
    if (plan.status === "RECOVERY_REQUIRED") return reply.code(409).send({ ok: false, error: "IMPORT_PLAN_RECOVERY_REQUIRED", plan });
    if (plan.status !== "VALIDATED") return reply.code(409).send({ ok: false, error: "IMPORT_PLAN_NOT_APPLYABLE", plan });
    if (new Date(plan.expiresAt).getTime() <= Date.now()) return reply.code(409).send({ ok: false, error: "IMPORT_PLAN_EXPIRED", plan });
    const claimed = await claimImportPlan(planId, actor.id);
    if (!claimed) return reply.code(409).send({ ok: false, error: "IMPORT_PLAN_CLAIM_DENIED" });
    const records = planRecords(claimed);
    const applied: Array<{ procedureId: string; versionId: string }> = [];
    const failures: BulkOperationFailure[] = [];
    try {
      const assertion = payloadAssertion(request);
      for (const record of records) {
        try {
          applied.push(await applyPayloadDraft(assertion, record));
        } catch (error) {
          failures.push({ id: record.procedureCode, reason: error instanceof Error ? error.message : "UD3_IMPORT_APPLY_FAILED" });
          break;
        }
      }
      const result = summarizeBulkOperation(records.length, records.length, applied.map((item) => item.procedureId), failures);
      if (failures.length > 0) {
        await markImportPlanRecoveryRequired(planId);
        await appendAdminAuditEvent(createAdminAuditEvent({ eventType: "UD3_IMPORT_RECOVERY_REQUIRED", actorId: actor.id, entityType: "procedures-bulk-import", entityId: planId, reason: "Partial staged import requires recovery", after: { result }, requestId: request.id, ip: request.ip, userAgent: request.headers["user-agent"]?.toString() }));
        return reply.code(502).send({ ok: false, error: "IMPORT_PLAN_RECOVERY_REQUIRED", state: "RECOVERY_REQUIRED", result, plan: await getImportPlan(planId), payload: applied });
      }
      const targetSemanticHash = canonicalExportHash({ schemaVersion: UD3_EXPORT_SCHEMA_VERSION, records });
      const resultingPayloadVersionId = applied[0]?.versionId || "none";
      await markImportPlanApplied(planId, targetSemanticHash, resultingPayloadVersionId);
      await appendAdminAuditEvent(createAdminAuditEvent({ eventType: "UD3_IMPORT_APPLIED", actorId: actor.id, entityType: "procedures-bulk-import", entityId: planId, reason: "Validated import plan applied as Payload draft", after: { targetSemanticHash, resultingPayloadVersionId, records: records.length, result }, requestId: request.id, ip: request.ip, userAgent: request.headers["user-agent"]?.toString() }));
      return reply.send({ ok: true, state: "APPLIED", result, plan: await getImportPlan(planId), payload: applied });
    } catch (error) {
      if (failures.length === 0) failures.push({ id: planId, reason: error instanceof Error ? error.message : "UD3_IMPORT_APPLY_FAILED" });
      const result = summarizeBulkOperation(records.length, records.length, applied.map((item) => item.procedureId), failures);
      await markImportPlanRecoveryRequired(planId);
      await appendAdminAuditEvent(createAdminAuditEvent({ eventType: "UD3_IMPORT_RECOVERY_REQUIRED", actorId: actor.id, entityType: "procedures-bulk-import", entityId: planId, reason: "Staged import requires recovery", after: { result }, requestId: request.id, ip: request.ip, userAgent: request.headers["user-agent"]?.toString() }));
      return reply.code(502).send({ ok: false, error: "IMPORT_PLAN_RECOVERY_REQUIRED", state: "RECOVERY_REQUIRED", result, plan: await getImportPlan(planId), payload: applied });
    }
  });
  app.post<{ Body: { planId?: string } }>("/api/admin/cms/procedures/import/publish", cmsPolicy("cms.publish"), async (request, reply) => {
    const planId = String(request.body?.planId || "").trim();
    const actor = resolveAdminActorFromRequest(request);
    const plan = await getImportPlan(planId);
    if (!plan) return reply.code(404).send({ ok: false, error: "IMPORT_PLAN_NOT_FOUND" });
    if (!actor || plan.actorGatewayUserId !== actor.id) return reply.code(403).send({ ok: false, error: "IMPORT_PLAN_ACTOR_MISMATCH" });
    if (plan.status !== "APPLIED") return reply.code(409).send({ ok: false, error: "IMPORT_PLAN_NOT_PUBLISHABLE", plan });
    const records = planRecords(plan);
    const published: string[] = [];
    const failures: BulkOperationFailure[] = [];
    try {
      const assertion = payloadAssertion(request);
      for (const record of records) {
        try {
          published.push(await publishPayloadDraft(assertion, record));
        } catch (error) {
          failures.push({ id: record.procedureCode, reason: error instanceof Error ? error.message : "IMPORT_PLAN_PUBLISH_FAILED" });
          break;
        }
      }
      const result = summarizeBulkOperation(records.length, records.length, published, failures);
      if (failures.length > 0) return reply.code(502).send({ ok: false, error: "IMPORT_PLAN_PUBLISH_FAILED", state: "PUBLISH_RECOVERY_REQUIRED", result, plan: await getImportPlan(planId), payload: published });
      await appendAdminAuditEvent(createAdminAuditEvent({ eventType: "UD3_IMPORT_PUBLISHED", actorId: actor.id, entityType: "procedures-bulk-import", entityId: planId, reason: "Explicit publication transition", after: { records: published.length, result }, requestId: request.id, ip: request.ip, userAgent: request.headers["user-agent"]?.toString() }));
      return reply.send({ ok: true, state: "PUBLISHED", result, plan: await getImportPlan(planId), payload: published });
    } catch (error) {
      if (failures.length === 0) failures.push({ id: planId, reason: error instanceof Error ? error.message : "IMPORT_PLAN_PUBLISH_FAILED" });
      const result = summarizeBulkOperation(records.length, records.length, published, failures);
      return reply.code(502).send({ ok: false, error: "IMPORT_PLAN_PUBLISH_FAILED", state: "PUBLISH_RECOVERY_REQUIRED", result, plan: await getImportPlan(planId), payload: published });
    }
  });
  app.post<{ Body: { planId?: string; targetSemanticHash?: string; resultingPayloadVersionId?: string } }>("/api/admin/cms/procedures/import/reconcile", cmsPolicy("cms.edit"), async (request, reply) => {
    const planId = String(request.body?.planId || "").trim();
    const targetSemanticHash = String(request.body?.targetSemanticHash || "").trim();
    const resultingPayloadVersionId = String(request.body?.resultingPayloadVersionId || "").trim();
    const actor = resolveAdminActorFromRequest(request);
    if (!planId || !targetSemanticHash || !resultingPayloadVersionId) return reply.code(400).send({ ok: false, error: "RECONCILIATION_FIELDS_REQUIRED" });
    if (!actor) return reply.code(401).send({ ok: false, error: "NO_AUTHENTICATED_ADMIN_ACTOR" });
    const reconciled = await reconcileImportPlan(planId, actor.id, targetSemanticHash, resultingPayloadVersionId);
    if (!reconciled) return reply.code(409).send({ ok: false, error: "IMPORT_PLAN_RECONCILIATION_DENIED" });
    return reply.send({ ok: true, state: "APPLIED", plan: await getImportPlan(planId) });
  });
  app.get("/api/admin/cms/payload-bootstrap/status", cmsPolicy("cms.payload_bootstrap.read"), async (request) => {
    const runtime = await loadIndex(false);
    const status = await getPayloadBootstrapStatus(
      payloadAssertion(request),
      runtime.procedures.map((row) => row.id),
      runtime.docs,
      runtime.map,
    );
    return { ok: true, runtimeSource: getProcedureRuntimeInfo().source, runtime: { procedures: runtime.procedures.length, documents: runtime.docs.length, mappings: runtime.map.length }, payload: status };
  });

  app.post("/api/admin/cms/payload-bootstrap/documents/apply", cmsPolicy("cms.payload_bootstrap.apply"), async (request, reply) => {
    const runtime = await loadIndex(false);
    try {
      const result = await applyPayloadDocumentDrafts(payloadAssertion(request), runtime.procedures.map((row) => row.id), runtime.docs, runtime.map);
      await appendAdminAuditEvent(createAdminAuditEvent({ eventType: "cms.payload_bootstrap.documents_applied", actorId: actorId(request), entityType: "payload_document_bootstrap", entityId: "documents", after: result, reason: "owner_authenticated_runtime_snapshot_to_payload_drafts", requestId: request.id, ip: request.ip, userAgent: request.headers["user-agent"]?.toString() }));
      return { ok: true, state: "DRAFTS_APPLIED", ...result };
    } catch (error) {
      return reply.code(409).send({ ok: false, error: "PAYLOAD_DOCUMENT_BOOTSTRAP_APPLY_FAILED", detail: error instanceof Error ? error.message : "unknown" });
    }
  });

  app.post("/api/admin/cms/payload-bootstrap/documents/publish", cmsPolicy("cms.payload_bootstrap.publish"), async (request, reply) => {
    const runtime = await loadIndex(false);
    try {
      const result = await publishPayloadDocuments(payloadAssertion(request), runtime.procedures.map((row) => row.id), runtime.docs, runtime.map);
      await appendAdminAuditEvent(createAdminAuditEvent({ eventType: "cms.payload_bootstrap.documents_published", actorId: actorId(request), entityType: "payload_document_bootstrap", entityId: "documents", after: { requested: result.requested, published: result.published, parity: result.status.parity }, reason: "owner_authenticated_explicit_publication", requestId: request.id, ip: request.ip, userAgent: request.headers["user-agent"]?.toString() }));
      return { ok: true, state: "PUBLISHED", ...result };
    } catch (error) {
      return reply.code(409).send({ ok: false, error: "PAYLOAD_DOCUMENT_BOOTSTRAP_PUBLISH_FAILED", detail: error instanceof Error ? error.message : "unknown" });
    }
  });

  app.get("/api/admin/cms/payload-sync/status", cmsPolicy("cms.payload_sync.read"), async () => ({
    ok: true,
    source: "PAYLOAD",
    ...(await payloadCanonicalSync.inspectStatus()),
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
      canonicalEditor: "PAYLOAD",
      runtimeSource: "payload_sync",
    }, {
      domainId: "editorial-documents",
      displayName: "Payload Documents",
      route: "/superadmin/cms/editorial-documents",
      apiBase: "/api/admin/cms/editorial-documents",
      identityField: "id",
      lifecycle: ["PUBLISHED"],
      canonicalEditor: "PAYLOAD",
      runtimeSource: "payload_sync",
    }, {
      domainId: "forms",
      displayName: "Forms",
      route: "/superadmin/cms/forms",
      apiBase: "/api/admin/cms/forms",
      identityField: "publicId",
      lifecycle: STATUS_VALUES,
      canonicalEditor: "GATEWAY_CMS",
      publicApi: "/api/forms",
    }, {
      domainId: "announcements",
      displayName: "Announcements",
      route: "/superadmin/cms/announcements",
      apiBase: "/api/admin/cms/announcements",
      identityField: "publicId",
      lifecycle: STATUS_VALUES,
      canonicalEditor: "GATEWAY_CMS",
      publicApi: "/api/announcements",
    }],
    legacyUtilities: [{
      domainId: "documents",
      displayName: "Uploaded Documents Metadata",
      route: "/admin/documents",
      apiBase: "/api/admin/cms/documents",
      canonicalEditor: "LEGACY_METADATA_LIBRARY",
      fileDeliverySupported: false,
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
