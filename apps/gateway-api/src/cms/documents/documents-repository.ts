import { query } from "../../lib/db.js";

export const DOCUMENT_KINDS = ["image", "pdf", "doc", "file"] as const;
export type DocumentKind = typeof DOCUMENT_KINDS[number];

export const DOCUMENT_STORAGE_STATUSES = ["pending", "verified", "rejected"] as const;
export type DocumentStorageStatus = typeof DOCUMENT_STORAGE_STATUSES[number];

export type DocumentRow = {
  id: string;
  user_id: string | null;
  name: string;
  kind: DocumentKind;
  status: DocumentStorageStatus;
  tags: unknown;
  file_path: string | null;
  updated_at: string | Date;
};

export type DocumentWriteRow = {
  id: string;
  userId: string | null;
  name: string;
  kind: DocumentKind;
  status: DocumentStorageStatus;
  tags: string[];
  filePath: string | null;
};

export type DocumentListFilters = {
  search?: string;
  status?: DocumentStorageStatus;
  kind?: DocumentKind;
  tag?: string;
  limit: number;
  offset: number;
};

export type DocumentListResult = {
  rows: DocumentRow[];
  total: number;
  statusCounts: Partial<Record<DocumentStorageStatus, number>>;
};

export interface DocumentRepository {
  list(filters: DocumentListFilters): Promise<DocumentListResult>;
  findById(id: string): Promise<DocumentRow | null>;
  create(input: DocumentWriteRow): Promise<DocumentRow>;
  update(input: DocumentWriteRow): Promise<DocumentRow | null>;
  delete(id: string): Promise<boolean>;
}

const DOCUMENT_COLUMNS = "id, user_id, name, kind, status, tags, file_path, updated_at";

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function buildWhere(filters: DocumentListFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    const parameter = `$${params.length + 1}`;
    params.push(`%${escapeLike(filters.search)}%`);
    clauses.push(`(
      name ILIKE ${parameter} ESCAPE '\\'
      OR kind ILIKE ${parameter} ESCAPE '\\'
      OR status ILIKE ${parameter} ESCAPE '\\'
      OR COALESCE(file_path, '') ILIKE ${parameter} ESCAPE '\\'
      OR tags::text ILIKE ${parameter} ESCAPE '\\'
    )`);
  }

  if (filters.status) {
    const parameter = `$${params.length + 1}`;
    params.push(filters.status);
    clauses.push(`status = ${parameter}`);
  }

  if (filters.kind) {
    const parameter = `$${params.length + 1}`;
    params.push(filters.kind);
    clauses.push(`kind = ${parameter}`);
  }

  if (filters.tag) {
    const parameter = `$${params.length + 1}`;
    params.push(JSON.stringify([filters.tag]));
    clauses.push(`tags @> ${parameter}::jsonb`);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export class PostgresDocumentRepository implements DocumentRepository {
  async list(filters: DocumentListFilters): Promise<DocumentListResult> {
    const where = buildWhere(filters);
    const countResult = await query<{ count: number | string }>(
      `SELECT COUNT(*)::int AS count FROM public.documents ${where.sql}`,
      where.params,
    );
    const statusResult = await query<{ status: DocumentStorageStatus; count: number | string }>(
      `SELECT status, COUNT(*)::int AS count FROM public.documents ${where.sql} GROUP BY status`,
      where.params,
    );
    const pageParams = [...where.params, filters.limit, filters.offset];
    const rowsResult = await query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS}
       FROM public.documents
       ${where.sql}
       ORDER BY updated_at DESC, id ASC
       LIMIT $${pageParams.length - 1}
       OFFSET $${pageParams.length}`,
      pageParams,
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.count || 0),
      statusCounts: Object.fromEntries(
        statusResult.rows.map((row) => [row.status, Number(row.count || 0)]),
      ) as Partial<Record<DocumentStorageStatus, number>>,
    };
  }

  async findById(id: string): Promise<DocumentRow | null> {
    const result = await query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} FROM public.documents WHERE id = $1::uuid`,
      [id],
    );
    return result.rows[0] || null;
  }

  async create(input: DocumentWriteRow): Promise<DocumentRow> {
    const result = await query<DocumentRow>(
      `INSERT INTO public.documents (
        id, user_id, name, kind, status, tags, file_path
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7)
      RETURNING ${DOCUMENT_COLUMNS}`,
      [
        input.id,
        input.userId,
        input.name,
        input.kind,
        input.status,
        JSON.stringify(input.tags),
        input.filePath,
      ],
    );
    return result.rows[0];
  }

  async update(input: DocumentWriteRow): Promise<DocumentRow | null> {
    const result = await query<DocumentRow>(
      `UPDATE public.documents
       SET user_id = $2::uuid,
           name = $3,
           kind = $4,
           status = $5,
           tags = $6::jsonb,
           file_path = $7,
           updated_at = now()
       WHERE id = $1::uuid
       RETURNING ${DOCUMENT_COLUMNS}`,
      [
        input.id,
        input.userId,
        input.name,
        input.kind,
        input.status,
        JSON.stringify(input.tags),
        input.filePath,
      ],
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(
      "DELETE FROM public.documents WHERE id = $1::uuid",
      [id],
    );
    return result.rowCount === 1;
  }
}
