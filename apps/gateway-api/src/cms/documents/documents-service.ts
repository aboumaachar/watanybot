import { randomUUID } from "node:crypto";
import {
  DOCUMENT_KINDS,
  DOCUMENT_STORAGE_STATUSES,
  type DocumentKind,
  type DocumentListFilters,
  type DocumentRepository,
  type DocumentRow,
  type DocumentStorageStatus,
  type DocumentWriteRow,
} from "./documents-repository.js";

export const CMS_DOCUMENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type CmsDocumentStatus = typeof CMS_DOCUMENT_STATUSES[number];
export type CmsDocumentAction = "publish" | "unpublish" | "archive";

export type DocumentView = {
  id: string;
  userId: string | null;
  name: string;
  kind: DocumentKind;
  status: DocumentStorageStatus;
  tags: string[];
  filePath: string | null;
  updatedAt: string;
};

export type CmsDocumentItem = {
  id: string;
  title: string;
  status: CmsDocumentStatus;
  version: string;
  updatedAt: string;
  record: {
    id: string;
    user_id: string | null;
    name: string;
    kind: DocumentKind;
    status: DocumentStorageStatus;
    tags: string[];
    file_path: string | null;
    updated_at: string;
  };
  document: DocumentView;
};

export type DocumentListInput = {
  q?: unknown;
  status?: unknown;
  kind?: unknown;
  tag?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

export type DocumentWriteInput = Record<string, unknown>;

export class DocumentServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: 400 | 404 | 409,
    message = code,
  ) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

const STATUS_TO_CMS: Record<DocumentStorageStatus, CmsDocumentStatus> = {
  pending: "DRAFT",
  verified: "PUBLISHED",
  rejected: "ARCHIVED",
};

const CMS_TO_STORAGE: Record<CmsDocumentStatus, DocumentStorageStatus> = {
  DRAFT: "pending",
  PUBLISHED: "verified",
  ARCHIVED: "rejected",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREVIEW_PATH_PATTERN = /^\/runtime\/uploads\/[0-9]+-[a-f0-9]{24}\.(jpg|png|webp)$/i;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function asRecord(input: unknown): DocumentWriteInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DocumentServiceError("VALIDATION_FAILED", 400, "Document payload must be an object");
  }
  return input as DocumentWriteInput;
}

function readString(input: DocumentWriteInput, keys: string[], label: string): string | undefined {
  const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(input, candidate));
  if (!key) return undefined;
  const value = input[key];
  if (typeof value !== "string") {
    throw new DocumentServiceError("VALIDATION_FAILED", 400, `${label} must be a string`);
  }
  return value.trim();
}

function normalizeName(input: DocumentWriteInput, existing?: DocumentView): string {
  const value = readString(input, ["name", "title"], "name");
  const name = value === undefined ? existing?.name || "" : value;
  if (!name) {
    throw new DocumentServiceError("NAME_REQUIRED", 400, "name is required");
  }
  if (name.length > 500) {
    throw new DocumentServiceError("NAME_TOO_LONG", 400, "name exceeds the supported length");
  }
  return name;
}

function normalizeKind(input: DocumentWriteInput, existing?: DocumentView): DocumentKind {
  const value = readString(input, ["kind"], "kind") || existing?.kind || "file";
  if (!(DOCUMENT_KINDS as readonly string[]).includes(value)) {
    throw new DocumentServiceError("INVALID_KIND", 400, "kind is not supported by public.documents");
  }
  return value as DocumentKind;
}

function normalizeStorageStatus(value: unknown, fallback: DocumentStorageStatus): DocumentStorageStatus {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !(DOCUMENT_STORAGE_STATUSES as readonly string[]).includes(value)) {
    throw new DocumentServiceError("INVALID_STATUS", 400, "status is not supported by public.documents");
  }
  return value as DocumentStorageStatus;
}

function normalizeTags(value: unknown, fallback: string[] = []): string[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value)) {
    throw new DocumentServiceError("INVALID_TAGS", 400, "tags must be an array of strings");
  }
  const tags = value.map((tag) => {
    if (typeof tag !== "string") {
      throw new DocumentServiceError("INVALID_TAGS", 400, "tags must be an array of strings");
    }
    return tag.trim();
  }).filter(Boolean);
  if (tags.some((tag) => tag.length > 100) || tags.length > 50) {
    throw new DocumentServiceError("INVALID_TAGS", 400, "tags exceed the supported limits");
  }
  return [...new Set(tags)];
}

function normalizeFilePath(input: DocumentWriteInput, existing?: DocumentView): string | null {
  const key = ["file_path", "filePath"].find((candidate) => Object.prototype.hasOwnProperty.call(input, candidate));
  if (!key) return existing?.filePath || null;
  const value = input[key];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new DocumentServiceError("VALIDATION_FAILED", 400, "file_path must be a string or null");
  }
  return value.trim() || null;
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
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

function normalizeTimestamp(value: string | Date): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? String(value) : timestamp.toISOString();
}

function parseRowTags(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeTags(value);
  if (typeof value === "string") {
    try { return normalizeTags(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

function toDocumentView(row: DocumentRow): DocumentView {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    name: String(row.name),
    kind: row.kind,
    status: row.status,
    tags: parseRowTags(row.tags),
    filePath: row.file_path ? String(row.file_path) : null,
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

export function toCmsDocumentItem(row: DocumentRow): CmsDocumentItem {
  const document = toDocumentView(row);
  return {
    id: document.id,
    title: document.name,
    status: STATUS_TO_CMS[document.status],
    version: document.updatedAt,
    updatedAt: document.updatedAt,
    record: {
      id: document.id,
      user_id: document.userId,
      name: document.name,
      kind: document.kind,
      status: document.status,
      tags: document.tags,
      file_path: document.filePath,
      updated_at: document.updatedAt,
    },
    document,
  };
}

function toStorageFilterStatus(value: unknown): DocumentStorageStatus | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") {
    throw new DocumentServiceError("INVALID_STATUS_FILTER", 400);
  }
  if ((DOCUMENT_STORAGE_STATUSES as readonly string[]).includes(value)) return value as DocumentStorageStatus;
  if ((CMS_DOCUMENT_STATUSES as readonly string[]).includes(value)) return CMS_TO_STORAGE[value as CmsDocumentStatus];
  throw new DocumentServiceError("INVALID_STATUS_FILTER", 400, "status filter is not supported");
}

function toKindFilter(value: unknown): DocumentKind | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !(DOCUMENT_KINDS as readonly string[]).includes(value)) {
    throw new DocumentServiceError("INVALID_KIND_FILTER", 400, "kind filter is not supported");
  }
  return value as DocumentKind;
}

function toTagFilter(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 100) {
    throw new DocumentServiceError("INVALID_TAG_FILTER", 400, "tag filter is not supported");
  }
  return value.trim();
}

function toWriteRow(input: DocumentWriteInput, existing: DocumentView | undefined, fixedStatus?: DocumentStorageStatus): DocumentWriteRow {
  const statusValue = input.status;
  const status = fixedStatus || normalizeStorageStatus(statusValue, existing?.status || "pending");
  return {
    id: existing?.id || randomUUID(),
    userId: existing?.userId || null,
    name: normalizeName(input, existing),
    kind: normalizeKind(input, existing),
    status,
    tags: normalizeTags(input.tags, existing?.tags),
    filePath: normalizeFilePath(input, existing),
  };
}

export class DocumentService {
  constructor(private readonly repository: DocumentRepository) {}

  async list(input: DocumentListInput = {}) {
    const page = normalizePage(input.page, 1);
    const pageSize = normalizePageSize(input.pageSize);
    const search = typeof input.q === "string" ? input.q.trim() : "";
    const filters: DocumentListFilters = {
      search: search || undefined,
      status: toStorageFilterStatus(input.status),
      kind: toKindFilter(input.kind),
      tag: toTagFilter(input.tag),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    const result = await this.repository.list(filters);
    const statusCounts: Partial<Record<CmsDocumentStatus, number>> = {
      DRAFT: result.statusCounts.pending || 0,
      PUBLISHED: result.statusCounts.verified || 0,
      ARCHIVED: result.statusCounts.rejected || 0,
    };
    return {
      items: result.rows.map(toCmsDocumentItem),
      total: result.total,
      page,
      pageSize,
      statusCounts,
    };
  }

  async get(id: string): Promise<CmsDocumentItem | null> {
    if (!isUuid(id)) throw new DocumentServiceError("INVALID_DOCUMENT_ID", 400);
    const row = await this.repository.findById(id);
    return row ? toCmsDocumentItem(row) : null;
  }

  async create(input: unknown): Promise<CmsDocumentItem> {
    const writeRow = toWriteRow(asRecord(input), undefined, "pending");
    const row = await this.repository.create(writeRow);
    return toCmsDocumentItem(row);
  }

  async update(id: string, input: unknown): Promise<CmsDocumentItem | null> {
    if (!isUuid(id)) throw new DocumentServiceError("INVALID_DOCUMENT_ID", 400);
    const currentRow = await this.repository.findById(id);
    if (!currentRow) return null;
    const current = toDocumentView(currentRow);
    const writeRow = toWriteRow(asRecord(input), current);
    const row = await this.repository.update(writeRow);
    return row ? toCmsDocumentItem(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!isUuid(id)) throw new DocumentServiceError("INVALID_DOCUMENT_ID", 400);
    return this.repository.delete(id);
  }

  async transition(id: string, action: CmsDocumentAction): Promise<CmsDocumentItem | null> {
    const current = await this.get(id);
    if (!current) return null;
    const storageStatus: DocumentStorageStatus = action === "publish"
      ? "verified"
      : action === "archive"
        ? "rejected"
        : "pending";
    return this.update(id, { status: storageStatus });
  }

  async rollback(id: string, snapshot: unknown): Promise<CmsDocumentItem | null> {
    const record = asRecord(snapshot);
    const nested = record.record;
    const source = nested && typeof nested === "object" && !Array.isArray(nested)
      ? nested as DocumentWriteInput
      : record;
    return this.update(id, {
      name: source.name || source.title,
      kind: source.kind,
      status: source.status,
      tags: source.tags,
      file_path: source.file_path || source.filePath,
    });
  }

  preview(item: CmsDocumentItem): { supported: boolean; url?: string; reason?: string } {
    const filePath = item.document.filePath;
    if (!filePath) return { supported: false, reason: "NO_FILE_PATH" };
    if (!PREVIEW_PATH_PATTERN.test(filePath)) return { supported: false, reason: "FILE_PREVIEW_NOT_PROVEN" };
    return { supported: true, url: filePath };
  }
}
