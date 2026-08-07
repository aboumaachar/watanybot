import type { FastifyPluginAsync } from "fastify";
import { requireRole } from "../auth/rbac.js";

interface PluginDbStatement {
  all: (...args: any[]) => Array<Record<string, unknown>>;
  get: (...args: any[]) => Record<string, unknown> | undefined;
  run: (...args: any[]) => { changes: number } | Record<string, unknown>;
}

interface PluginDb {
  prepare: (sql: string) => PluginDbStatement;
}

type DocumentExtractionStatus = "not_started" | "queued" | "processing" | "ready" | "failed";

interface DocumentItem {
  id: string;
  name: string;
  kind: "image" | "pdf" | "doc" | "file";
  status: "pending" | "verified" | "rejected";
  updatedAt: number;
  sourceFileName?: string;
  mimeType?: string;
  slug?: string;
  extractionStatus?: DocumentExtractionStatus;
  extractionError?: string;
  chunkCount?: number;
  tags: string[];
}

type DocumentMeta = Pick<DocumentItem, "sourceFileName" | "mimeType" | "slug" | "extractionStatus" | "extractionError" | "chunkCount">;

const VALID_DOC_STATUSES = new Set<DocumentItem["status"]>(["pending", "verified", "rejected"]);
const VALID_DOC_KINDS = new Set<DocumentItem["kind"]>(["image", "pdf", "doc", "file"]);
const VALID_EXTRACTION_STATUSES = new Set<DocumentExtractionStatus>(["not_started", "queued", "processing", "ready", "failed"]);

export interface DocumentsRoutesOptions {
  pluginDb: PluginDb;
  makeId: (prefix: string) => string;
}

function normalizeDocumentMeta(input: Record<string, unknown>): DocumentMeta {
  const next: DocumentMeta = {};

  if (input.sourceFileName) next.sourceFileName = String(input.sourceFileName);
  if (input.mimeType) next.mimeType = String(input.mimeType);
  if (input.slug) next.slug = String(input.slug);
  if (input.extractionError) next.extractionError = String(input.extractionError);

  if (input.extractionStatus) {
    const extractionStatus = String(input.extractionStatus) as DocumentExtractionStatus;
    if (VALID_EXTRACTION_STATUSES.has(extractionStatus)) {
      next.extractionStatus = extractionStatus;
    }
  }

  if (typeof input.chunkCount === "number" && Number.isFinite(input.chunkCount) && input.chunkCount >= 0) {
    next.chunkCount = input.chunkCount;
  }

  return next;
}

function parseDocumentMeta(row: Record<string, unknown>): DocumentMeta {
  if (!row.meta) {
    return {};
  }

  try {
    return normalizeDocumentMeta(JSON.parse(String(row.meta)) as Record<string, unknown>);
  } catch {
    return {};
  }
}

function serializeDocumentMeta(input: Partial<DocumentItem>): string | null {
  const meta = normalizeDocumentMeta(input as Record<string, unknown>);
  return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
}

function mapDocumentRow(row: Record<string, unknown>): DocumentItem {
  const meta = parseDocumentMeta(row);

  return {
    id: String(row.id),
    name: String(row.name),
    kind: String(row.kind) as DocumentItem["kind"],
    status: String(row.status) as DocumentItem["status"],
    updatedAt: Number(row.updated_at),
    ...meta,
    tags: row.tags ? (JSON.parse(String(row.tags)) as string[]) : [],
  };
}
export const documentsRoutes: FastifyPluginAsync<DocumentsRoutesOptions> = async (app, options) => {
  app.get("/api/documents", { preHandler: [requireRole("accredited")] }, async () => {
    const rows = options.pluginDb.prepare("SELECT * FROM documents ORDER BY updated_at DESC").all();
    return { items: rows.map(mapDocumentRow) } as const;
  });

  app.post<{ Body: Omit<DocumentItem, "id" | "updatedAt"> }>("/api/documents", { preHandler: [requireRole("accredited")] }, async (req, reply) => {
    const body = req.body || ({} as Omit<DocumentItem, "id" | "updatedAt">);
    if (!body.name) {
      reply.code(400);
      return { error: "name required" } as const;
    }
    const now = Date.now();
    const rawKind = body.kind || "file";
    const rawStatus = body.status || "pending";
    if (!VALID_DOC_KINDS.has(rawKind as DocumentItem["kind"])) {
      reply.code(400);
      return { error: "نوع الوثيقة غير صالح" } as const;
    }
    if (body.extractionStatus !== undefined && !VALID_EXTRACTION_STATUSES.has(body.extractionStatus)) {
      reply.code(400);
      return { error: "حالة المعالجة غير صالحة" } as const;
    }
    const metadata = normalizeDocumentMeta(body as Record<string, unknown>);
    const item: DocumentItem = {
      id: options.makeId("doc"),
      name: String(body.name),
      kind: rawKind as DocumentItem["kind"],
      status: "pending",
      updatedAt: now,
      ...metadata,
      tags: Array.isArray(body.tags) ? body.tags : [],
    };
    // Ignore any status the client provides on creation; always start as pending.
    void rawStatus;
    options.pluginDb.prepare("INSERT INTO documents (id, name, kind, status, updated_at, tags, meta) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      item.id,
      item.name,
      item.kind,
      item.status,
      item.updatedAt,
      JSON.stringify(item.tags || []),
      serializeDocumentMeta(item),
    );
    return item;
  });

  app.patch<{ Body: Partial<DocumentItem>; Params: { id: string } }>("/api/documents/:id", { preHandler: [requireRole("moderator")] }, async (req, reply) => {
    const id = req.params.id;
    const patch = req.body || {};

    // Validate status, kind, and extraction state if provided.
    if (patch.status !== undefined && !VALID_DOC_STATUSES.has(patch.status)) {
      reply.code(400);
      return { error: "حالة الوثيقة غير صالحة" } as const;
    }
    if (patch.kind !== undefined && !VALID_DOC_KINDS.has(patch.kind)) {
      reply.code(400);
      return { error: "نوع الوثيقة غير صالح" } as const;
    }
    if (patch.extractionStatus !== undefined && !VALID_EXTRACTION_STATUSES.has(patch.extractionStatus)) {
      reply.code(400);
      return { error: "حالة المعالجة غير صالحة" } as const;
    }

    const row = options.pluginDb.prepare("SELECT * FROM documents WHERE id = ?").get(id);
    if (!row) {
      reply.code(404);
      return { error: "document not found" } as const;
    }
    const metadata = normalizeDocumentMeta({
      ...(parseDocumentMeta(row) as Record<string, unknown>),
      ...(patch as Record<string, unknown>),
    });
    const updated: DocumentItem = {
      id,
      name: patch.name ? String(patch.name) : String(row.name),
      kind: (patch.kind ? String(patch.kind) : String(row.kind)) as DocumentItem["kind"],
      status: (patch.status ? String(patch.status) : String(row.status)) as DocumentItem["status"],
      updatedAt: Date.now(),
      ...metadata,
      tags: Array.isArray(patch.tags) ? patch.tags : row.tags ? (JSON.parse(String(row.tags)) as string[]) : [],
    };
    options.pluginDb.prepare("UPDATE documents SET name = ?, kind = ?, status = ?, updated_at = ?, tags = ?, meta = ? WHERE id = ?").run(
      updated.name,
      updated.kind,
      updated.status,
      updated.updatedAt,
      JSON.stringify(updated.tags || []),
      serializeDocumentMeta(updated),
      id,
    );
    return updated;
  });
};