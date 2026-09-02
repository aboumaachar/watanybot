import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { getClient, query } from "../../lib/db.js";

export const GENERIC_CMS_STATUSES = ["DRAFT", "REVIEW_READY", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;
export type GenericCmsStatus = typeof GENERIC_CMS_STATUSES[number];
export type GenericCmsAction = "publish" | "unpublish" | "archive" | "restore";

export type GenericCmsEntity = {
  id: string;
  domain: string;
  publicId: string;
  publicCode: string | null;
  sourceId: string | null;
  status: GenericCmsStatus;
  locale: string | null;
  title: string;
  payload: Record<string, unknown>;
  sourceMeta: Record<string, unknown>;
  revision: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export type GenericCmsEntityInput = {
  domain: string;
  publicId: string;
  publicCode?: string | null;
  sourceId?: string | null;
  status?: GenericCmsStatus;
  locale?: string | null;
  title: string;
  payload?: Record<string, unknown>;
  sourceMeta?: Record<string, unknown>;
  createdBy: string;
  updatedBy?: string;
};

export type GenericCmsEntityPatch = Partial<Pick<GenericCmsEntity, "title" | "payload" | "sourceMeta" | "status" | "updatedBy" | "publicCode" | "sourceId" | "locale">>;

export type GenericCmsListFilters = {
  search?: string;
  q?: string;
  status?: GenericCmsStatus;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
};

export type GenericCmsListResult = {
  items: GenericCmsEntity[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<GenericCmsStatus, number>;
};

export type GenericCmsRelationship = {
  entityId: string;
  publicId: string;
  domain: string;
  relationType: string;
  targetDomain: string;
  targetPublicId: string;
  createdAt: string;
};

export type GenericCmsRelationshipInput = {
  domain: string;
  publicId: string;
  relationType: string;
  targetDomain: string;
  targetPublicId: string;
};

type CmsRow = Record<string, unknown>;
type QueryExecutor = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: any[]): Promise<QueryResult<T>>;
};

const defaultExecutor = { query } as unknown as QueryExecutor;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return asJsonObject(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapRow(row: CmsRow): GenericCmsEntity {
  return {
    id: String(row.id),
    domain: String(row.domain),
    publicId: String(row.public_id),
    publicCode: row.public_code === null || row.public_code === undefined ? null : String(row.public_code),
    sourceId: row.source_id === null || row.source_id === undefined ? null : String(row.source_id),
    status: String(row.status) as GenericCmsStatus,
    locale: row.locale === null || row.locale === undefined ? null : String(row.locale),
    title: String(row.title ?? ""),
    payload: asJsonObject(row.payload),
    sourceMeta: asJsonObject(row.source_meta),
    revision: Number(row.revision),
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    publishedAt: row.published_at ? toIso(row.published_at) : null,
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
  };
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

function normalizeSearch(filters: GenericCmsListFilters): string {
  return String(filters.search ?? filters.q ?? "").trim();
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildWhere(domain: string, filters: GenericCmsListFilters, includeStatus = true): { sql: string; params: unknown[] } {
  const params: unknown[] = [domain];
  const clauses = ["domain = $1"];
  const search = normalizeSearch(filters);
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    const parameter = `$${params.length}`;
    clauses.push(`(title ILIKE ${parameter} ESCAPE '\\' OR public_id ILIKE ${parameter} ESCAPE '\\' OR COALESCE(public_code, '') ILIKE ${parameter} ESCAPE '\\' OR COALESCE(source_id, '') ILIKE ${parameter} ESCAPE '\\')`);
  }
  if (includeStatus && filters.status) {
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }
  return { sql: `WHERE ${clauses.join(" AND ")}`, params };
}

function normalizeListFilters(filters: GenericCmsListFilters = {}): Required<Pick<GenericCmsListFilters, "page" | "pageSize" | "limit" | "offset">> & GenericCmsListFilters {
  const page = normalizePage(filters.page, filters.offset !== undefined ? Math.floor(Number(filters.offset) / Math.max(Number(filters.limit) || DEFAULT_PAGE_SIZE, 1)) + 1 : 1);
  const pageSize = normalizePageSize(filters.pageSize ?? filters.limit);
  return {
    ...filters,
    page,
    pageSize,
    limit: pageSize,
    offset: filters.offset === undefined ? (page - 1) * pageSize : Math.max(Math.floor(Number(filters.offset) || 0), 0),
  };
}

async function listPageWithExecutor(executor: QueryExecutor, domain: string, rawFilters: GenericCmsListFilters = {}): Promise<GenericCmsListResult> {
  const filters = normalizeListFilters(rawFilters);
  const where = buildWhere(domain, filters);
  const countsWhere = buildWhere(domain, filters, false);
  const countResult = await executor.query<{ count: number | string }>(`SELECT COUNT(*)::int AS count FROM cms_content_entities ${where.sql}`, where.params);
  const statusResult = await executor.query<{ status: GenericCmsStatus; count: number | string }>(`SELECT status, COUNT(*)::int AS count FROM cms_content_entities ${countsWhere.sql} GROUP BY status`, countsWhere.params);
  const pageParams = [...where.params, filters.limit, filters.offset];
  const rowsResult = await executor.query<CmsRow>(
    `SELECT * FROM cms_content_entities ${where.sql} ORDER BY updated_at DESC, public_id ASC LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );
  const statusCounts = Object.fromEntries(GENERIC_CMS_STATUSES.map((status) => [status, 0])) as Record<GenericCmsStatus, number>;
  for (const row of statusResult.rows) statusCounts[row.status] = Number(row.count || 0);
  return {
    items: rowsResult.rows.map(mapRow),
    total: Number(countResult.rows[0]?.count || 0),
    page: filters.page,
    pageSize: filters.pageSize,
    statusCounts,
  };
}

export async function listGenericCmsEntitiesPage(domain: string, filters: GenericCmsListFilters = {}): Promise<GenericCmsListResult> {
  return listPageWithExecutor(defaultExecutor, domain, filters);
}

export function listGenericCmsEntities(domain: string, filters?: GenericCmsListFilters): Promise<GenericCmsListResult>;
export function listGenericCmsEntities(domain: string, search?: string, status?: GenericCmsStatus): Promise<GenericCmsEntity[]>;
export async function listGenericCmsEntities(domain: string, filtersOrSearch?: GenericCmsListFilters | string, status?: GenericCmsStatus): Promise<GenericCmsListResult | GenericCmsEntity[]> {
  if (filtersOrSearch && typeof filtersOrSearch === "object") return listGenericCmsEntitiesPage(domain, filtersOrSearch);
  const result = await listPageWithExecutor(defaultExecutor, domain, { search: filtersOrSearch || "", status, page: 1, pageSize: MAX_PAGE_SIZE });
  return result.items;
}

export async function getGenericCmsEntity(domain: string, publicId: string, executor: QueryExecutor = defaultExecutor): Promise<GenericCmsEntity | null> {
  const result = await executor.query<CmsRow>("SELECT * FROM cms_content_entities WHERE domain = $1 AND public_id = $2", [domain, publicId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

async function createWithExecutor(executor: QueryExecutor, input: GenericCmsEntityInput): Promise<GenericCmsEntity> {
  const result = await executor.query<CmsRow>(
    `INSERT INTO cms_content_entities (domain, public_id, public_code, source_id, status, locale, title, payload, source_meta, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
     RETURNING *`,
    [input.domain, input.publicId, input.publicCode ?? null, input.sourceId ?? null, input.status ?? "DRAFT", input.locale ?? "ar", input.title, JSON.stringify(input.payload ?? {}), JSON.stringify(input.sourceMeta ?? {}), input.createdBy, input.updatedBy ?? input.createdBy],
  );
  return mapRow(result.rows[0]);
}

export async function createGenericCmsEntity(input: GenericCmsEntityInput): Promise<GenericCmsEntity> {
  return createWithExecutor(defaultExecutor, input);
}

async function updateWithExecutor(executor: QueryExecutor, domain: string, publicId: string, patch: GenericCmsEntityPatch): Promise<GenericCmsEntity | null> {
  const titleProvided = hasOwn(patch, "title");
  const payloadProvided = hasOwn(patch, "payload");
  const sourceMetaProvided = hasOwn(patch, "sourceMeta");
  const statusProvided = hasOwn(patch, "status");
  const publicCodeProvided = hasOwn(patch, "publicCode");
  const sourceIdProvided = hasOwn(patch, "sourceId");
  const localeProvided = hasOwn(patch, "locale");
  const result = await executor.query<CmsRow>(
    `UPDATE cms_content_entities
     SET title = CASE WHEN $3::boolean THEN $4 ELSE title END,
         payload = CASE WHEN $5::boolean THEN $6::jsonb ELSE payload END,
         source_meta = CASE WHEN $7::boolean THEN $8::jsonb ELSE source_meta END,
         status = CASE WHEN $9::boolean THEN $10 ELSE status END,
         public_code = CASE WHEN $11::boolean THEN $12 ELSE public_code END,
         source_id = CASE WHEN $13::boolean THEN $14 ELSE source_id END,
         locale = CASE WHEN $15::boolean THEN $16 ELSE locale END,
         updated_by = $17,
         revision = revision + 1,
         updated_at = now(),
         published_at = CASE
           WHEN $9::boolean AND $10 = 'PUBLISHED' THEN COALESCE(published_at, now())
           WHEN $9::boolean THEN NULL
           ELSE published_at
         END,
         archived_at = CASE
           WHEN $9::boolean AND $10 = 'ARCHIVED' THEN COALESCE(archived_at, now())
           WHEN $9::boolean THEN NULL
           ELSE archived_at
         END
     WHERE domain = $1 AND public_id = $2
     RETURNING *`,
    [domain, publicId, titleProvided, titleProvided ? patch.title : null, payloadProvided, payloadProvided ? JSON.stringify(patch.payload ?? {}) : null, sourceMetaProvided, sourceMetaProvided ? JSON.stringify(patch.sourceMeta ?? {}) : null, statusProvided, statusProvided ? patch.status : null, publicCodeProvided, publicCodeProvided ? patch.publicCode ?? null : null, sourceIdProvided, sourceIdProvided ? patch.sourceId ?? null : null, localeProvided, localeProvided ? patch.locale ?? null : null, patch.updatedBy || "unknown-admin"],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function updateGenericCmsEntity(domain: string, publicId: string, patch: GenericCmsEntityPatch): Promise<GenericCmsEntity | null> {
  return updateWithExecutor(defaultExecutor, domain, publicId, patch);
}

export function statusForGenericCmsAction(action: GenericCmsAction): GenericCmsStatus {
  if (action === "publish") return "PUBLISHED";
  if (action === "unpublish") return "UNPUBLISHED";
  if (action === "archive") return "ARCHIVED";
  return "DRAFT";
}

export async function transitionGenericCmsEntity(domain: string, publicId: string, action: GenericCmsAction, updatedBy: string): Promise<GenericCmsEntity | null> {
  return updateGenericCmsEntity(domain, publicId, { status: statusForGenericCmsAction(action), updatedBy });
}

export async function restoreGenericCmsEntity(domain: string, publicId: string, updatedBy: string): Promise<GenericCmsEntity | null> {
  return transitionGenericCmsEntity(domain, publicId, "restore", updatedBy);
}

export async function withGenericCmsTransaction<T>(work: (executor: QueryExecutor) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the mutation error when rollback itself fails.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function lockEntities(executor: QueryExecutor, domain: string, publicIds: readonly string[]): Promise<Map<string, GenericCmsEntity>> {
  const uniqueIds = [...new Set(publicIds)];
  if (uniqueIds.length === 0) return new Map();
  const result = await executor.query<CmsRow>(
    "SELECT * FROM cms_content_entities WHERE domain = $1 AND public_id = ANY($2::text[]) ORDER BY array_position($2::text[], public_id) FOR UPDATE",
    [domain, uniqueIds],
  );
  return new Map(result.rows.map((row) => [String(row.public_id), mapRow(row)]));
}

export async function bulkUpdateGenericCmsEntities(domain: string, publicIds: readonly string[], patch: GenericCmsEntityPatch): Promise<GenericCmsEntity[]> {
  const ids = [...new Set(publicIds)];
  return withGenericCmsTransaction(async (executor) => {
    const locked = await lockEntities(executor, domain, ids);
    const missingId = ids.find((id) => !locked.has(id));
    if (missingId) {
      const error = new Error("CMS_ITEM_NOT_FOUND");
      (error as Error & { code?: string; id?: string }).code = "CMS_ITEM_NOT_FOUND";
      (error as Error & { code?: string; id?: string }).id = missingId;
      throw error;
    }
    const updated: GenericCmsEntity[] = [];
    for (const id of ids) {
      const item = await updateWithExecutor(executor, domain, id, patch);
      if (!item) {
        const error = new Error("CMS_ITEM_NOT_FOUND");
        (error as Error & { code?: string; id?: string }).code = "CMS_ITEM_NOT_FOUND";
        (error as Error & { code?: string; id?: string }).id = id;
        throw error;
      }
      updated.push(item);
    }
    return updated;
  });
}

function mapRelationshipRow(row: CmsRow): GenericCmsRelationship {
  return {
    entityId: String(row.entity_id),
    publicId: String(row.public_id),
    domain: String(row.domain),
    relationType: String(row.relation_type),
    targetDomain: String(row.target_domain),
    targetPublicId: String(row.target_public_id),
    createdAt: toIso(row.created_at),
  };
}

export async function listGenericCmsRelationships(domain: string, publicId: string, relationType?: string): Promise<GenericCmsRelationship[]> {
  const params: unknown[] = [domain, publicId];
  const relationClause = relationType ? " AND r.relation_type = $3" : "";
  if (relationType) params.push(relationType);
  const result = await defaultExecutor.query<CmsRow>(
    `SELECT r.*, e.domain, e.public_id
     FROM cms_content_relationships r
     JOIN cms_content_entities e ON e.id = r.entity_id
     WHERE e.domain = $1 AND e.public_id = $2${relationClause}
     ORDER BY r.relation_type ASC, r.target_domain ASC, r.target_public_id ASC`,
    params,
  );
  return result.rows.map(mapRelationshipRow);
}

export async function createGenericCmsRelationship(input: GenericCmsRelationshipInput): Promise<GenericCmsRelationship> {
  const result = await defaultExecutor.query<CmsRow>(
    `INSERT INTO cms_content_relationships (entity_id, relation_type, target_domain, target_public_id)
     SELECT id, $3, $4, $5 FROM cms_content_entities WHERE domain = $1 AND public_id = $2
     RETURNING entity_id, relation_type, target_domain, target_public_id, created_at`,
    [input.domain, input.publicId, input.relationType, input.targetDomain, input.targetPublicId],
  );
  if (!result.rows[0]) {
    const error = new Error("CMS_ITEM_NOT_FOUND");
    (error as Error & { code?: string }).code = "CMS_ITEM_NOT_FOUND";
    throw error;
  }
  const entity = await getGenericCmsEntity(input.domain, input.publicId);
  return mapRelationshipRow({ ...result.rows[0], domain: input.domain, public_id: input.publicId, ...(entity ? { entity_id: entity.id } : {}) });
}

export async function deleteGenericCmsRelationship(input: GenericCmsRelationshipInput): Promise<boolean> {
  const result = await defaultExecutor.query(
    `DELETE FROM cms_content_relationships r
     USING cms_content_entities e
     WHERE r.entity_id = e.id AND e.domain = $1 AND e.public_id = $2
       AND r.relation_type = $3 AND r.target_domain = $4 AND r.target_public_id = $5`,
    [input.domain, input.publicId, input.relationType, input.targetDomain, input.targetPublicId],
  );
  return result.rowCount === 1;
}

export async function replaceGenericCmsRelationships(domain: string, publicId: string, relationType: string, targets: readonly Pick<GenericCmsRelationshipInput, "targetDomain" | "targetPublicId">[]): Promise<GenericCmsRelationship[]> {
  return withGenericCmsTransaction(async (executor) => {
    const entity = await getGenericCmsEntity(domain, publicId, executor);
    if (!entity) {
      const error = new Error("CMS_ITEM_NOT_FOUND");
      (error as Error & { code?: string; id?: string }).code = "CMS_ITEM_NOT_FOUND";
      (error as Error & { code?: string; id?: string }).id = publicId;
      throw error;
    }
    await executor.query(
      "DELETE FROM cms_content_relationships WHERE entity_id = $1 AND relation_type = $2",
      [entity.id, relationType],
    );
    for (const target of targets) {
      await executor.query(
        `INSERT INTO cms_content_relationships (entity_id, relation_type, target_domain, target_public_id)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [entity.id, relationType, target.targetDomain, target.targetPublicId],
      );
    }
    const result = await executor.query<CmsRow>(
      `SELECT r.*, e.domain, e.public_id
       FROM cms_content_relationships r
       JOIN cms_content_entities e ON e.id = r.entity_id
       WHERE r.entity_id = $1 AND r.relation_type = $2
       ORDER BY r.target_domain ASC, r.target_public_id ASC`,
      [entity.id, relationType],
    );
    return result.rows.map(mapRelationshipRow);
  });
}