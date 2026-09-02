import type { FastifyRequest } from "fastify";
import {
  bulkUpdateGenericCmsEntities,
  createGenericCmsEntity,
  createGenericCmsRelationship,
  deleteGenericCmsRelationship,
  getGenericCmsEntity,
  listGenericCmsEntitiesPage,
  listGenericCmsRelationships,
  replaceGenericCmsRelationships,
  restoreGenericCmsEntity,
  transitionGenericCmsEntity,
  updateGenericCmsEntity,
  type GenericCmsAction,
  type GenericCmsEntity,
  type GenericCmsEntityInput,
  type GenericCmsEntityPatch,
  type GenericCmsListFilters,
  type GenericCmsRelationship,
  type GenericCmsStatus,
} from "./genericCmsRepository.js";
import { appendAdminAuditEvent, createAdminAuditEvent, listRecentAdminAuditEvents, type AdminAuditEvent } from "../../admin-authority/adminAuthorityAudit.js";
import { createAdminEntityVersion, listAdminEntityVersions, type AdminEntityVersion } from "../../admin-authority/adminAuthorityVersioning.js";

export type GenericCmsView = {
  id: string;
  domain: string;
  publicId: string;
  publicCode: string | null;
  sourceId: string | null;
  title: string;
  status: GenericCmsStatus;
  version: string;
  updatedAt: string;
  createdAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  record: Record<string, unknown>;
  payload: Record<string, unknown>;
  sourceMeta: Record<string, unknown>;
  relationships?: GenericCmsRelationship[];
};

export type GenericCmsRouteConfig = {
  domain: string;
  entityType: string;
  auditEntityType: string;
  title: string;
  defaultLocale?: string;
  defaultPayload?: Record<string, unknown>;
  defaultSourceMeta?: Record<string, unknown>;
  allowedPayloadKeys?: readonly string[];
};

export class GenericCmsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: 400 | 404 | 409,
    message = code,
    public readonly id?: string,
  ) {
    super(message);
    this.name = "GenericCmsServiceError";
  }
}

const STATUS_VALUES = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;
const ACTION_VALUES = ["publish", "unpublish", "archive", "restore"] as const;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function actorId(request: FastifyRequest): string {
  const user = (request as any).user;
  return String(user?.id || user?.sub || "unknown-admin");
}

function asRecord(value: unknown, code = "VALIDATION_FAILED"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GenericCmsServiceError(code, 400, "CMS payload must be an object");
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new GenericCmsServiceError("VALIDATION_FAILED", 400, `${field} must be a string`);
  return value.trim();
}

function requiredString(value: unknown, field: string): string {
  const result = optionalString(value, field);
  if (!result) throw new GenericCmsServiceError("VALIDATION_FAILED", 400, `${field} is required`);
  return result;
}

function jsonObject(value: unknown, field: string, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (value === undefined) return { ...fallback };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GenericCmsServiceError("VALIDATION_FAILED", 400, `${field} must be an object`);
  }
  return { ...(value as Record<string, unknown>) };
}

function normalizeStatus(value: unknown, fallback?: GenericCmsStatus): GenericCmsStatus | undefined {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !STATUS_VALUES.includes(value as GenericCmsStatus)) {
    throw new GenericCmsServiceError("INVALID_STATUS", 400, "status is not supported by this CMS domain");
  }
  return value as GenericCmsStatus;
}

function normalizeStatusFilter(value: unknown): GenericCmsStatus | undefined {
  if (value === undefined || value === "") return undefined;
  return normalizeStatus(value);
}

function normalizePage(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function normalizePageSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_PAGE_SIZE);
}

function normalizeListFilters(input: Record<string, unknown>): GenericCmsListFilters {
  return {
    search: typeof input.q === "string" ? input.q.trim() : undefined,
    status: normalizeStatusFilter(input.status),
    page: normalizePage(input.page, 1),
    pageSize: normalizePageSize(input.pageSize),
  };
}

function toView(config: GenericCmsRouteConfig, entity: GenericCmsEntity, relationships?: GenericCmsRelationship[]): GenericCmsView {
  return {
    id: entity.publicId,
    domain: entity.domain,
    publicId: entity.publicId,
    publicCode: entity.publicCode,
    sourceId: entity.sourceId,
    title: entity.title,
    status: entity.status,
    version: String(entity.revision),
    updatedAt: entity.updatedAt,
    createdAt: entity.createdAt,
    publishedAt: entity.publishedAt,
    archivedAt: entity.archivedAt,
    record: {
      publicId: entity.publicId,
      publicCode: entity.publicCode,
      sourceId: entity.sourceId,
      locale: entity.locale,
      title: entity.title,
      status: entity.status,
      revision: entity.revision,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      publishedAt: entity.publishedAt,
      archivedAt: entity.archivedAt,
      ...entity.payload,
    },
    payload: entity.payload,
    sourceMeta: entity.sourceMeta,
    ...(relationships ? { relationships } : {}),
  };
}

function normalizePayload(config: GenericCmsRouteConfig, value: unknown, fallback?: Record<string, unknown>): Record<string, unknown> {
  const payload = jsonObject(value, "payload", fallback || config.defaultPayload || {});
  if (config.allowedPayloadKeys) {
    const unsupported = Object.keys(payload).filter((key) => !config.allowedPayloadKeys?.includes(key));
    if (unsupported.length > 0) throw new GenericCmsServiceError("VALIDATION_FAILED", 400, `Unsupported payload fields: ${unsupported.join(", ")}`);
  }
  return payload;
}

function normalizeSourceMeta(config: GenericCmsRouteConfig, value: unknown, fallback?: Record<string, unknown>): Record<string, unknown> {
  return jsonObject(value, "sourceMeta", fallback || config.defaultSourceMeta || {});
}

function normalizeCreate(config: GenericCmsRouteConfig, input: unknown, actor: string): GenericCmsEntityInput {
  const body = asRecord(input);
  const publicId = requiredString(body.publicId ?? body.id, "publicId");
  const title = requiredString(body.title, "title");
  return {
    domain: config.domain,
    publicId,
    publicCode: optionalString(body.publicCode, "publicCode"),
    sourceId: optionalString(body.sourceId, "sourceId"),
    status: normalizeStatus(body.status, "DRAFT"),
    locale: optionalString(body.locale, "locale") ?? config.defaultLocale ?? "ar",
    title,
    payload: normalizePayload(config, body.payload),
    sourceMeta: normalizeSourceMeta(config, body.sourceMeta),
    createdBy: actor,
    updatedBy: actor,
  };
}

function normalizePatch(config: GenericCmsRouteConfig, input: unknown, actor: string): GenericCmsEntityPatch {
  const body = asRecord(input);
  const supportedKeys = new Set(["title", "publicCode", "sourceId", "locale", "payload", "sourceMeta", "status"]);
  const unsupported = Object.keys(body).filter((key) => !supportedKeys.has(key));
  if (unsupported.length > 0) throw new GenericCmsServiceError("VALIDATION_FAILED", 400, `Unsupported CMS fields: ${unsupported.join(", ")}`);
  const patch: GenericCmsEntityPatch = { updatedBy: actor };
  if (Object.prototype.hasOwnProperty.call(body, "title")) patch.title = requiredString(body.title, "title");
  if (Object.prototype.hasOwnProperty.call(body, "publicCode")) patch.publicCode = optionalString(body.publicCode, "publicCode");
  if (Object.prototype.hasOwnProperty.call(body, "sourceId")) patch.sourceId = optionalString(body.sourceId, "sourceId");
  if (Object.prototype.hasOwnProperty.call(body, "locale")) patch.locale = optionalString(body.locale, "locale");
  if (Object.prototype.hasOwnProperty.call(body, "payload")) patch.payload = normalizePayload(config, body.payload);
  if (Object.prototype.hasOwnProperty.call(body, "sourceMeta")) patch.sourceMeta = normalizeSourceMeta(config, body.sourceMeta);
  if (Object.prototype.hasOwnProperty.call(body, "status")) patch.status = normalizeStatus(body.status);
  if (Object.keys(patch).length === 1) throw new GenericCmsServiceError("VALIDATION_FAILED", 400, "At least one CMS field is required");
  return patch;
}

function normalizeAction(value: string): GenericCmsAction {
  if (!ACTION_VALUES.includes(value as GenericCmsAction)) throw new GenericCmsServiceError("INVALID_ACTION", 400);
  return value as GenericCmsAction;
}

function errorFromRepository(error: unknown): GenericCmsServiceError | null {
  if (!(error instanceof Error)) return null;
  const code = (error as Error & { code?: string }).code;
  const id = (error as Error & { id?: string }).id;
  if (code === "CMS_ITEM_NOT_FOUND") return new GenericCmsServiceError(code, 404, code, id);
  return null;
}

export class GenericCmsService {
  constructor(public readonly config: GenericCmsRouteConfig) {}

  async list(input: Record<string, unknown> = {}) {
    const result = await listGenericCmsEntitiesPage(this.config.domain, normalizeListFilters(input));
    return {
      items: result.items.map((item) => toView(this.config, item)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      statusCounts: result.statusCounts,
    };
  }

  async get(publicId: string, includeRelationships = false): Promise<GenericCmsView | null> {
    const item = await getGenericCmsEntity(this.config.domain, publicId);
    if (!item) return null;
    const relationships = includeRelationships ? await listGenericCmsRelationships(this.config.domain, publicId) : undefined;
    return toView(this.config, item, relationships);
  }

  async create(input: unknown, actor: string): Promise<GenericCmsView> {
    try {
      const item = await createGenericCmsEntity(normalizeCreate(this.config, input, actor));
      return toView(this.config, item);
    } catch (error) {
      const mapped = errorFromRepository(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async update(publicId: string, input: unknown, actor: string): Promise<GenericCmsView | null> {
    const patch = normalizePatch(this.config, input, actor);
    try {
      const item = await updateGenericCmsEntity(this.config.domain, publicId, patch);
      return item ? toView(this.config, item) : null;
    } catch (error) {
      const mapped = errorFromRepository(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async transition(publicId: string, actionValue: string, actor: string): Promise<GenericCmsView | null> {
    const action = normalizeAction(actionValue);
    const item = action === "restore"
      ? await restoreGenericCmsEntity(this.config.domain, publicId, actor)
      : await transitionGenericCmsEntity(this.config.domain, publicId, action, actor);
    return item ? toView(this.config, item) : null;
  }

  async bulkUpdate(publicIds: readonly string[], input: unknown, actor: string, action: "bulk_edit" | "bulk_archive"): Promise<GenericCmsView[]> {
    const body = action === "bulk_edit" ? asRecord(input) : {};
    const patch = action === "bulk_archive"
      ? { status: "ARCHIVED" as const, updatedBy: actor }
      : normalizePatch(this.config, body.patch, actor);
    try {
      const items = await bulkUpdateGenericCmsEntities(this.config.domain, publicIds, patch);
      return items.map((item) => toView(this.config, item));
    } catch (error) {
      const mapped = errorFromRepository(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async rollback(publicId: string, versionId: string, actor: string): Promise<GenericCmsView | null> {
    const before = await getGenericCmsEntity(this.config.domain, publicId);
    const version = (await listAdminEntityVersions(this.config.entityType, publicId)).find((candidate) => candidate.id === versionId);
    if (!before || !version || !version.snapshot || typeof version.snapshot !== "object") return null;
    const snapshot = version.snapshot as Record<string, unknown>;
    const record = snapshot.record && typeof snapshot.record === "object" && !Array.isArray(snapshot.record)
      ? snapshot.record as Record<string, unknown>
      : snapshot;
    const payload = snapshot.payload && typeof snapshot.payload === "object" && !Array.isArray(snapshot.payload)
      ? snapshot.payload
      : Object.fromEntries(Object.entries(record).filter(([key]) => !["publicId", "publicCode", "sourceId", "locale", "title", "status", "revision", "createdBy", "updatedBy", "createdAt", "updatedAt", "publishedAt", "archivedAt", "relationships"].includes(key)));
    const item = await updateGenericCmsEntity(this.config.domain, publicId, {
      title: typeof record.title === "string" ? record.title : before.title,
      publicCode: record.publicCode === null || typeof record.publicCode === "string" ? record.publicCode : before.publicCode,
      sourceId: record.sourceId === null || typeof record.sourceId === "string" ? record.sourceId : before.sourceId,
      locale: record.locale === null || typeof record.locale === "string" ? record.locale : before.locale,
      payload: normalizePayload(this.config, payload),
      sourceMeta: snapshot.sourceMeta && typeof snapshot.sourceMeta === "object" && !Array.isArray(snapshot.sourceMeta) ? snapshot.sourceMeta as Record<string, unknown> : before.sourceMeta,
      status: normalizeStatus(record.status, "DRAFT"),
      updatedBy: actor,
    });
    return item ? toView(this.config, item) : null;
  }

  async versions(publicId: string): Promise<AdminEntityVersion[]> {
    return listAdminEntityVersions(this.config.entityType, publicId);
  }

  async audit(publicId: string): Promise<AdminAuditEvent[]> {
    const events = await listRecentAdminAuditEvents(200);
    return events.filter((event) => event.entityType === this.config.auditEntityType && event.entityId === publicId);
  }

  async relationships(publicId: string, relationType?: string): Promise<GenericCmsRelationship[]> {
    return listGenericCmsRelationships(this.config.domain, publicId, relationType);
  }

  async addRelationship(publicId: string, input: unknown): Promise<GenericCmsRelationship> {
    const body = asRecord(input);
    return createGenericCmsRelationship({
      domain: this.config.domain,
      publicId,
      relationType: requiredString(body.relationType, "relationType"),
      targetDomain: requiredString(body.targetDomain, "targetDomain"),
      targetPublicId: requiredString(body.targetPublicId, "targetPublicId"),
    });
  }

  async deleteRelationship(publicId: string, input: unknown): Promise<boolean> {
    const body = asRecord(input);
    return deleteGenericCmsRelationship({
      domain: this.config.domain,
      publicId,
      relationType: requiredString(body.relationType, "relationType"),
      targetDomain: requiredString(body.targetDomain, "targetDomain"),
      targetPublicId: requiredString(body.targetPublicId, "targetPublicId"),
    });
  }

  async replaceRelationships(publicId: string, relationType: string, input: unknown): Promise<GenericCmsRelationship[]> {
    const body = asRecord(input);
    if (!Array.isArray(body.targets)) throw new GenericCmsServiceError("VALIDATION_FAILED", 400, "targets must be an array");
    const targets = body.targets.map((value) => {
      const target = asRecord(value);
      return {
        targetDomain: requiredString(target.targetDomain, "targetDomain"),
        targetPublicId: requiredString(target.targetPublicId, "targetPublicId"),
      };
    });
    return replaceGenericCmsRelationships(this.config.domain, publicId, relationType, targets);
  }

  async recordMutation(request: FastifyRequest, action: string, publicId: string, before: unknown, after: unknown): Promise<void> {
    const actor = actorId(request);
    await createAdminEntityVersion({ entityType: this.config.entityType, entityId: publicId, snapshot: after, createdBy: actor, reason: action });
    await appendAdminAuditEvent(createAdminAuditEvent({
      eventType: `cms.${this.config.domain}.${action}`,
      actorId: actor,
      entityType: this.config.auditEntityType,
      entityId: publicId,
      before,
      after,
      reason: action,
      requestId: request.id,
      ip: request.ip,
      userAgent: request.headers["user-agent"]?.toString(),
    }));
  }
}