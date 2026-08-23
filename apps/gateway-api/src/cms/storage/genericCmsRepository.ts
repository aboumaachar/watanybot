import { query } from "../../lib/db.js";

export type GenericCmsStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";

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

type CmsRow = Record<string, unknown>;

function mapRow(row: CmsRow): GenericCmsEntity {
  return {
    id: String(row.id), domain: String(row.domain), publicId: String(row.public_id),
    publicCode: row.public_code ? String(row.public_code) : null, sourceId: row.source_id ? String(row.source_id) : null,
    status: String(row.status) as GenericCmsStatus, locale: row.locale ? String(row.locale) : null,
    title: String(row.title), payload: (row.payload || {}) as Record<string, unknown>, sourceMeta: (row.source_meta || {}) as Record<string, unknown>,
    revision: Number(row.revision), createdBy: String(row.created_by), updatedBy: String(row.updated_by),
    createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString(),
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    archivedAt: row.archived_at ? new Date(String(row.archived_at)).toISOString() : null,
  };
}

export async function listGenericCmsEntities(domain: string, search?: string, status?: GenericCmsStatus): Promise<GenericCmsEntity[]> {
  const result = await query<CmsRow>(
    `SELECT * FROM cms_content_entities WHERE domain = $1 AND ($2 = '' OR status = $2) AND ($3 = '' OR title ILIKE '%' || $3 || '%' OR public_id ILIKE '%' || $3 || '%') ORDER BY updated_at DESC`,
    [domain, status || "", search?.trim() || ""],
  );
  return result.rows.map(mapRow);
}

export async function getGenericCmsEntity(domain: string, publicId: string): Promise<GenericCmsEntity | null> {
  const result = await query<CmsRow>("SELECT * FROM cms_content_entities WHERE domain = $1 AND public_id = $2", [domain, publicId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function createGenericCmsEntity(input: Omit<GenericCmsEntity, "id" | "revision" | "createdAt" | "updatedAt" | "publishedAt" | "archivedAt">): Promise<GenericCmsEntity> {
  const result = await query<CmsRow>(`INSERT INTO cms_content_entities (domain, public_id, public_code, source_id, status, locale, title, payload, source_meta, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$10) RETURNING *`, [input.domain, input.publicId, input.publicCode, input.sourceId, input.status, input.locale, input.title, JSON.stringify(input.payload), JSON.stringify(input.sourceMeta), input.createdBy]);
  return mapRow(result.rows[0]);
}

export async function updateGenericCmsEntity(domain: string, publicId: string, patch: Partial<Pick<GenericCmsEntity, "title" | "payload" | "sourceMeta" | "status" | "updatedBy">>): Promise<GenericCmsEntity | null> {
  const result = await query<CmsRow>(`UPDATE cms_content_entities SET title = COALESCE($3, title), payload = COALESCE($4::jsonb, payload), source_meta = COALESCE($5::jsonb, source_meta), status = COALESCE($6, status), updated_by = $7, revision = revision + 1, updated_at = now(), published_at = CASE WHEN $6 = 'PUBLISHED' THEN now() ELSE published_at END, archived_at = CASE WHEN $6 = 'ARCHIVED' THEN now() ELSE archived_at END WHERE domain = $1 AND public_id = $2 RETURNING *`, [domain, publicId, patch.title || null, patch.payload ? JSON.stringify(patch.payload) : null, patch.sourceMeta ? JSON.stringify(patch.sourceMeta) : null, patch.status || null, patch.updatedBy]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}