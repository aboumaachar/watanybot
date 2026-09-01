import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { appendAdminAuditEvent, createAdminAuditEvent, type AdminAuditEvent } from "../admin-authority/adminAuthorityAudit.js";
import { getPayloadSyncRuntimeRoot } from "../procedures/config.js";
import { reloadIndex } from "../procedures/indexer.js";
import type { Procedure, ProcToDocs, SourceRef, StoredDocAsset } from "../procedures/types.js";

type PayloadRecord = Record<string, unknown>;

type PayloadPage = {
  docs?: unknown;
  totalPages?: unknown;
  hasNextPage?: unknown;
  nextPage?: unknown;
};

export type PayloadHttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type PayloadHttpClient = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<PayloadHttpResponse>;

export type PayloadSyncCounts = {
  proceduresFetched: number;
  proceduresPublished: number;
  documentsFetched: number;
  documentsPublished: number;
  mappings: number;
};

export type PayloadSyncStatus = {
  configured: boolean;
  running: boolean;
  lastRun: {
    state: "RUNNING" | "COMPLETED" | "FAILED";
    runId: string;
    startedAt: string;
    finishedAt?: string;
    counts?: PayloadSyncCounts;
    contentHash?: string;
    errorCode?: PayloadSyncErrorCode;
  } | null;
  active: {
    runId: string;
    activatedAt: string;
    counts: PayloadSyncCounts;
    contentHash: string;
  } | null;
};

export type PayloadSyncResult = {
  ok: true;
  code: "SYNCED";
  runId: string;
  activatedAt: string;
  counts: PayloadSyncCounts;
  contentHash: string;
};

export type PayloadSyncErrorCode =
  | "NOT_CONFIGURED"
  | "UNAVAILABLE"
  | "PAYLOAD_SYNC_ALREADY_RUNNING"
  | "PAYLOAD_SYNC_INVALID_DATASET"
  | "PAYLOAD_SYNC_ACTIVATION_FAILED";

export class PayloadSyncError extends Error {
  readonly code: PayloadSyncErrorCode;
  readonly statusCode: number;

  constructor(code: PayloadSyncErrorCode, message: string, statusCode = 502) {
    super(message);
    this.name = "PayloadSyncError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export type PayloadSyncOptions = {
  fetcher?: PayloadHttpClient;
  runtimeRoot?: string;
  reload?: () => Promise<unknown>;
  audit?: (event: AdminAuditEvent) => Promise<unknown>;
  now?: () => Date;
};

export type PayloadSyncContext = {
  actorId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

type Candidate = {
  procedures: Procedure[];
  documents: StoredDocAsset[];
  mappings: ProcToDocs[];
  counts: PayloadSyncCounts;
  contentHash: string;
};

type ActivePointer = {
  version: 1;
  activeDirectory: string;
  runId: string;
  activatedAt: string;
  counts: PayloadSyncCounts;
  contentHash: string;
};

const PAGE_SIZE = 100;
const MAX_PAGES = 10_000;

function defaultFetcher(url: string, init: { headers: Record<string, string> }): Promise<PayloadHttpResponse> {
  return fetch(url, init);
}

function configuredBaseUrl(): string | null {
  const value = String(process.env.PAYLOAD_CMS_BASE_URL || "").trim().replace(/\/+$/, "");
  return value || null;
}

function configuredToken(): string | null {
  const value = String(process.env.PAYLOAD_CMS_API_TOKEN || "").trim();
  return value || null;
}

function asRecord(value: unknown): PayloadRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PayloadRecord : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function firstString(record: PayloadRecord, keys: string[]): string {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return "";
}

function relationValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function relationReference(value: unknown): string {
  const record = asRecord(value);
  if (!record) return stringValue(value);
  return firstString(record, ["businessIdentifier", "canonicalId", "id"]);
}

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function textList(value: unknown, objectKeys: string[] = ["item", "text", "value", "title", "details"]): string[] {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const result: string[] = [];
  for (const item of values) {
    const record = asRecord(item);
    const text = record
      ? objectKeys.map((key) => stringValue(record[key])).filter(Boolean).join(" - ")
      : stringValue(item);
    if (text) result.push(text);
  }
  return Array.from(new Set(result));
}

function relationLabels(value: unknown): string[] {
  return Array.from(new Set(relationValues(value).map((item) => {
    const record = asRecord(item);
    return record ? firstString(record, ["name", "label", "title", "value", "businessIdentifier", "canonicalId", "id"]) : stringValue(item);
  }).filter(Boolean)));
}

function mapSourceRefs(value: unknown): SourceRef[] {
  return relationValues(value).map((item) => {
    const record = asRecord(item);
    if (!record) return { source_id: stringValue(item) };
    return {
      source_id: firstString(record, ["businessIdentifier", "canonicalId", "slug", "id"]),
      source_path: firstString(record, ["path", "sourcePath", "url"]),
      anchor: firstString(record, ["anchor", "sourceAnchor"]),
    };
  }).filter((ref) => Boolean(ref.source_id || ref.source_path || ref.anchor));
}

function requireCanonicalId(record: PayloadRecord, kind: string): string {
  const id = firstString(record, ["businessIdentifier", "canonicalId"]);
  if (!id) {
    throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", `Payload ${kind} is missing businessIdentifier`, 422);
  }
  return id;
}

function isPublished(record: PayloadRecord): boolean {
  const payloadStatus = stringValue(record._status).toLocaleLowerCase();
  const publicationState = stringValue(record.publicationState).toLocaleLowerCase();
  const workflowStatus = stringValue(record.workflowStatus).toLocaleUpperCase();
  return payloadStatus === "published"
    && publicationState === "published"
    && workflowStatus === "PUBLISHED";
}

export function mapPayloadProcedure(record: PayloadRecord): Procedure {
  const id = requireCanonicalId(record, "procedure");
  const title = firstString(record, ["titleAr", "title", "name"]);
  if (!title) {
    throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", `Payload procedure ${id} is missing titleAr`, 422);
  }

  const updatedAt = firstString(record, ["updatedAt", "publishedAt", "createdAt"]);
  return {
    id,
    source: firstString(record, ["sourceSystem", "source"]) || undefined,
    source_label: firstString(record, ["category"]),
    title_ar: title,
    title_en: firstString(record, ["titleEn"]),
    summary_lb: firstString(record, ["summaryAr", "summaryLb", "summaryEn"]),
    section_path: [firstString(record, ["category"]), firstString(record, ["subcategory"])].filter(Boolean),
    eligibility: textList(record.eligibility),
    requirements: textList(record.requirements),
    steps: textList(record.steps, ["title", "details", "item", "text"]),
    fees: textList(record.fees),
    timelines: textList(record.processingTime),
    tags: relationLabels(record.tags),
    source_refs: mapSourceRefs(record.sources),
    version: firstString(record, ["revisionNumber", "sourceRevision", "updatedAt"]) || "1",
    status: "PUBLISHED",
    last_updated: updatedAt || undefined,
  };
}

export function mapPayloadDocument(record: PayloadRecord, linkedProcedures: string[] = []): StoredDocAsset {
  const id = requireCanonicalId(record, "document");
  const title = firstString(record, ["titleAr", "title", "name"]);
  if (!title) {
    throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", `Payload document ${id} is missing titleAr`, 422);
  }

  const publicUrl = firstString(record, ["publicUrl", "legacyPublicUrl"]);
  const storagePath = firstString(record, ["storagePath"]);
  return {
    id,
    title,
    url: publicUrl || undefined,
    asset_type: firstString(record, ["assetType", "documentType"]) || undefined,
    file_format: firstString(record, ["fileFormat", "mimeType"]) || undefined,
    file_name: firstString(record, ["originalFilename"]) || null,
    file_path: storagePath || null,
    public_url: publicUrl || null,
    preview_enabled: true,
    download_enabled: true,
    share_enabled: true,
    description_lb: firstString(record, ["descriptionAr", "summaryAr", "officialReference"]) || undefined,
    tags: relationLabels(record.tags),
    linked_procedures: linkedProcedures,
    source_refs: mapSourceRefs(record.sources),
    asset_delivery_kind: "payload",
  };
}

function indexRecords(records: PayloadRecord[], kind: string): Map<string, PayloadRecord> {
  const index = new Map<string, PayloadRecord>();
  for (const record of records) {
    const canonicalId = requireCanonicalId(record, kind);
    const canonicalKey = normalizedKey(canonicalId);
    if (index.has(canonicalKey)) {
      throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", `Duplicate Payload ${kind} businessIdentifier: ${canonicalId}`, 422);
    }
    index.set(canonicalKey, record);

    const internalId = stringValue(record.id);
    if (internalId) {
      const internalKey = normalizedKey(internalId);
      const existing = index.get(internalKey);
      if (existing && existing !== record) {
        throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", `Duplicate Payload ${kind} relationship identifier: ${internalId}`, 422);
      }
      index.set(internalKey, record);
    }
  }
  return index;
}

function resolveRelationship(reference: string, index: Map<string, PayloadRecord>, kind: string, ownerId: string): PayloadRecord | null {
  if (!reference) return null;
  const target = index.get(normalizedKey(reference));
  if (!target) {
    throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", `Broken Payload ${kind} relationship from ${ownerId}: ${reference}`, 422);
  }
  return target;
}

export function buildPayloadRuntimeCandidate(
  procedureRecords: PayloadRecord[],
  documentRecords: PayloadRecord[],
): {
  procedures: Procedure[];
  documents: StoredDocAsset[];
  mappings: ProcToDocs[];
  counts: PayloadSyncCounts;
  contentHash: string;
} {
  const proceduresByReference = indexRecords(procedureRecords, "procedure");
  const documentsByReference = indexRecords(documentRecords, "document");
  const publishedProcedures = procedureRecords.filter(isPublished);
  const publishedDocuments = documentRecords.filter(isPublished);
  const mappedDocumentsByProcedure = new Map<string, Set<string>>();

  for (const procedure of publishedProcedures) {
    mappedDocumentsByProcedure.set(requireCanonicalId(procedure, "procedure"), new Set());
  }

  for (const procedure of publishedProcedures) {
    const procedureId = requireCanonicalId(procedure, "procedure");
    for (const value of relationValues(procedure.documentRelations)) {
      const target = resolveRelationship(relationReference(value), documentsByReference, "document", procedureId);
      if (!target || !isPublished(target)) continue;
      mappedDocumentsByProcedure.get(procedureId)?.add(requireCanonicalId(target, "document"));
    }
  }

  for (const document of publishedDocuments) {
    const documentId = requireCanonicalId(document, "document");
    for (const value of relationValues(document.procedureRelations)) {
      const target = resolveRelationship(relationReference(value), proceduresByReference, "procedure", documentId);
      if (!target || !isPublished(target)) continue;
      const procedureId = requireCanonicalId(target, "procedure");
      mappedDocumentsByProcedure.get(procedureId)?.add(documentId);
    }
  }

  const procedures = publishedProcedures.map(mapPayloadProcedure);
  const documents = publishedDocuments.map((record) => {
    const documentId = requireCanonicalId(record, "document");
    const linkedProcedures = Array.from(mappedDocumentsByProcedure.entries())
      .filter(([, documentSet]) => documentSet.has(documentId))
      .map(([procedureId]) => procedureId)
      .sort();
    return mapPayloadDocument(record, linkedProcedures);
  });
  const mappings = procedures.map((procedure) => ({
    procedure_id: procedure.id,
    doc_ids: Array.from(mappedDocumentsByProcedure.get(procedure.id) || []).sort(),
    confidence: 1,
    reason: "payload_canonical_relation",
  }));
  const serializable = { procedures, documents, mappings };
  const contentHash = createHash("sha256").update(JSON.stringify(serializable)).digest("hex");

  return {
    procedures,
    documents,
    mappings,
    counts: {
      proceduresFetched: procedureRecords.length,
      proceduresPublished: procedures.length,
      documentsFetched: documentRecords.length,
      documentsPublished: documents.length,
      mappings: mappings.length,
    },
    contentHash,
  };
}

function pageDocs(value: unknown): PayloadRecord[] {
  const page = asRecord(value) as PayloadPage | null;
  if (!page || !Array.isArray(page.docs)) {
    throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", "Payload collection response is missing docs", 502);
  }
  return page.docs.map((item) => {
    const record = asRecord(item);
    if (!record) throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", "Payload collection contains a non-object record", 502);
    return record;
  });
}

async function fetchCollection(
  collection: "procedures" | "documents",
  baseUrl: string,
  fetcher: PayloadHttpClient,
): Promise<PayloadRecord[]> {
  const token = configuredToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const records: PayloadRecord[] = [];
  let pageNumber = 1;
  let complete = false;

  for (let pageCount = 0; pageCount < MAX_PAGES; pageCount += 1) {
    const url = `${baseUrl}/api/${collection}?limit=${PAGE_SIZE}&page=${pageNumber}&depth=1`;
    let response: PayloadHttpResponse;
    try {
      response = await fetcher(url, { headers });
    } catch {
      throw new PayloadSyncError("UNAVAILABLE", `Payload ${collection} endpoint is unavailable`, 503);
    }
    if (!response.ok) {
      throw new PayloadSyncError("UNAVAILABLE", `Payload ${collection} endpoint returned ${response.status}`, 503);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", `Payload ${collection} response is not JSON`, 502);
    }
    const page = asRecord(body) as PayloadPage | null;
    const currentDocs = pageDocs(body);
    records.push(...currentDocs);
    const totalPages = Number(page?.totalPages || 0);
    const hasNextPage = page?.hasNextPage === true || Number(page?.nextPage || 0) > pageNumber;
    if (currentDocs.length === 0 || (!hasNextPage && (!totalPages || pageNumber >= totalPages) && currentDocs.length < PAGE_SIZE)) {
      complete = true;
      break;
    }

    const nextPage = Number(page?.nextPage || pageNumber + 1);
    pageNumber = Number.isInteger(nextPage) && nextPage > pageNumber ? nextPage : pageNumber + 1;
  }

  if (!complete) {
    throw new PayloadSyncError("PAYLOAD_SYNC_INVALID_DATASET", `Payload ${collection} pagination exceeded limit`, 502);
  }
  return records;
}

function jsonl(rows: unknown[]): string {
  return rows.length ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
}

function pointerPath(runtimeRoot: string): string {
  return path.join(runtimeRoot, "active.json");
}

async function readPointer(runtimeRoot: string): Promise<{ raw: string | null; value: ActivePointer | null }> {
  try {
    const raw = await readFile(pointerPath(runtimeRoot), "utf8");
    return { raw, value: JSON.parse(raw) as ActivePointer };
  } catch {
    return { raw: null, value: null };
  }
}

async function replacePointer(runtimeRoot: string, pointer: ActivePointer | null, runId: string): Promise<void> {
  const target = pointerPath(runtimeRoot);
  if (!pointer) {
    await rm(target, { force: true });
    return;
  }

  const temporary = `${target}.next-${runId}`;
  await writeFile(temporary, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  try {
    await rename(temporary, target);
    return;
  } catch (firstError) {
    const backup = `${target}.backup-${runId}`;
    try {
      await rename(target, backup);
      await rename(temporary, target);
      await rm(backup, { force: true });
    } catch (secondError) {
      await rm(temporary, { force: true });
      if (existsSync(backup)) {
        try {
          await rename(backup, target);
        } catch {
          throw secondError;
        }
      }
      throw firstError;
    }
  }
}

async function readActivePointer(runtimeRoot: string): Promise<ActivePointer | null> {
  return (await readPointer(runtimeRoot)).value;
}

async function writeCandidate(runtimeRoot: string, candidate: Candidate, runId: string, activatedAt: string): Promise<string> {
  const directoryName = `.candidate-${runId}`;
  const directory = path.join(runtimeRoot, directoryName);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(path.join(directory, "procedures.jsonl"), jsonl(candidate.procedures), "utf8");
    await writeFile(path.join(directory, "documents.jsonl"), jsonl(candidate.documents), "utf8");
    await writeFile(path.join(directory, "procedure_to_docs.jsonl"), jsonl(candidate.mappings), "utf8");
    await writeFile(path.join(directory, "tags_lexicon.json"), "{}\n", "utf8");
    await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify({
      version: 1,
      source: "PAYLOAD_CMS",
      runId,
      activatedAt,
      counts: candidate.counts,
      contentHash: candidate.contentHash,
    }, null, 2)}\n`, "utf8");
    return directoryName;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

function statusFromError(error: unknown): { code: PayloadSyncErrorCode; statusCode: number } {
  if (error instanceof PayloadSyncError) return { code: error.code, statusCode: error.statusCode };
  return { code: "PAYLOAD_SYNC_ACTIVATION_FAILED", statusCode: 500 };
}

export class PayloadCanonicalSyncService {
  private readonly fetcher: PayloadHttpClient;
  private readonly runtimeRoot: string;
  private readonly reload: () => Promise<unknown>;
  private readonly audit: (event: AdminAuditEvent) => Promise<unknown>;
  private readonly now: () => Date;
  private running = false;
  private lastRun: PayloadSyncStatus["lastRun"] = null;

  constructor(options: PayloadSyncOptions = {}) {
    this.fetcher = options.fetcher || defaultFetcher;
    this.runtimeRoot = options.runtimeRoot || getPayloadSyncRuntimeRoot();
    this.reload = options.reload || reloadIndex;
    this.audit = options.audit || appendAdminAuditEvent;
    this.now = options.now || (() => new Date());
  }

  getStatus(): PayloadSyncStatus {
    const activePointerPath = pointerPath(this.runtimeRoot);
    let active: PayloadSyncStatus["active"] = null;
    if (existsSync(activePointerPath)) {
      try {
        const pointer = JSON.parse(readFileSync(activePointerPath, "utf8")) as ActivePointer;
        if (pointer?.runId && pointer?.activatedAt && pointer?.counts && pointer?.contentHash) {
          active = {
            runId: pointer.runId,
            activatedAt: pointer.activatedAt,
            counts: pointer.counts,
            contentHash: pointer.contentHash,
          };
        }
      } catch {
        active = null;
      }
    }
    return {
      configured: Boolean(configuredBaseUrl()),
      running: this.running,
      lastRun: this.lastRun,
      active,
    };
  }

  async sync(context: PayloadSyncContext = {}): Promise<PayloadSyncResult> {
    if (this.running) {
      throw new PayloadSyncError("PAYLOAD_SYNC_ALREADY_RUNNING", "A Payload sync is already running", 409);
    }
    const baseUrl = configuredBaseUrl();
    if (!baseUrl) {
      throw new PayloadSyncError("NOT_CONFIGURED", "PAYLOAD_CMS_BASE_URL is not configured", 503);
    }

    this.running = true;
    const runId = randomUUID();
    const startedAt = this.now().toISOString();
    this.lastRun = { state: "RUNNING", runId, startedAt };
    const actorId = context.actorId || "unknown-admin";
    const auditInput = (eventType: string, after?: unknown, reason?: string) => createAdminAuditEvent({
      eventType,
      actorId,
      entityType: "payload_gateway_sync",
      entityId: "procedures-documents",
      after,
      reason,
      requestId: context.requestId,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    let previousPointer: { raw: string | null; value: ActivePointer | null } = { raw: null, value: null };
    let activated = false;
    try {
      await this.audit(auditInput("cms.payload_sync.started", { runId, source: "PAYLOAD_CMS" }, "payload_sync_started"));
      const [procedureRecords, documentRecords] = await Promise.all([
        fetchCollection("procedures", baseUrl, this.fetcher),
        fetchCollection("documents", baseUrl, this.fetcher),
      ]);
      const candidate = buildPayloadRuntimeCandidate(procedureRecords, documentRecords);
      const activatedAt = this.now().toISOString();
      const directoryName = await writeCandidate(this.runtimeRoot, candidate, runId, activatedAt);
      previousPointer = await readPointer(this.runtimeRoot);
      await replacePointer(this.runtimeRoot, {
        version: 1,
        activeDirectory: directoryName,
        runId,
        activatedAt,
        counts: candidate.counts,
        contentHash: candidate.contentHash,
      }, runId);
      activated = true;
      await this.reload();
      await this.audit(auditInput("cms.payload_sync.completed", {
        runId,
        source: "PAYLOAD_CMS",
        counts: candidate.counts,
        contentHash: candidate.contentHash,
      }, "payload_sync_completed"));
      this.lastRun = {
        state: "COMPLETED",
        runId,
        startedAt,
        finishedAt: this.now().toISOString(),
        counts: candidate.counts,
        contentHash: candidate.contentHash,
      };
      return { ok: true, code: "SYNCED", runId, activatedAt, counts: candidate.counts, contentHash: candidate.contentHash };
    } catch (error) {
      if (activated) {
        try {
          await replacePointer(this.runtimeRoot, previousPointer.value, runId);
          await this.reload();
        } catch {
          // The original sync failure remains the result when rollback cannot complete.
        }
      }
      const failure = statusFromError(error);
      this.lastRun = {
        state: "FAILED",
        runId,
        startedAt,
        finishedAt: this.now().toISOString(),
        errorCode: failure.code,
      };
      try {
        await this.audit(auditInput("cms.payload_sync.failed", { runId, errorCode: failure.code }, "payload_sync_failed"));
      } catch {
        // Audit availability must not hide the original sync result.
      }
      if (error instanceof PayloadSyncError) throw error;
      throw new PayloadSyncError(failure.code, "Payload sync failed", failure.statusCode);
    } finally {
      this.running = false;
    }
  }
}

export const payloadCanonicalSync = new PayloadCanonicalSyncService();

export async function readPayloadSyncActivePointer(runtimeRoot = getPayloadSyncRuntimeRoot()): Promise<PayloadSyncStatus["active"]> {
  const pointer = await readActivePointer(runtimeRoot);
  if (!pointer) return null;
  return {
    runId: pointer.runId,
    activatedAt: pointer.activatedAt,
    counts: pointer.counts,
    contentHash: pointer.contentHash,
  };
}