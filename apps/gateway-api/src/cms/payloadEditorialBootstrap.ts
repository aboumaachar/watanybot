import type { ProcToDocs, StoredDocAsset } from "../procedures/types.js";

type PayloadRecord = Record<string, unknown>;
type PayloadPage = { docs?: unknown; hasNextPage?: unknown; nextPage?: unknown; totalPages?: unknown };

export type PayloadBootstrapStatus = {
  procedureCount: number;
  publishedProcedureCount: number;
  documentCount: number;
  publishedDocumentCount: number;
  missingProcedureIds: number;
  extraProcedureIds: number;
  missingDocumentIds: number;
  extraDocumentIds: number;
  missingMappingPairs: number;
  extraMappingPairs: number;
  brokenRelationships: number;
  parity: boolean;
};

function payloadBaseUrl(): string {
  const value = String(process.env.PAYLOAD_CMS_BASE_URL || "").trim().replace(/\/+$/u, "");
  if (!value) throw new Error("PAYLOAD_CMS_BASE_URL_REQUIRED");
  return value;
}

function canonicalId(record: PayloadRecord): string {
  return String(record.canonicalId || record.businessIdentifier || "").trim();
}

function isPublished(record: PayloadRecord): boolean {
  return String(record._status || "").toLowerCase() === "published"
    && String(record.publicationState || "").toLowerCase() === "published"
    && String(record.workflowStatus || "").toUpperCase() === "PUBLISHED";
}

async function payloadRequest(pathname: string, assertion: string, init: RequestInit = {}): Promise<{ status: number; body: PayloadRecord }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${assertion}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${payloadBaseUrl()}${pathname}`, { ...init, headers });
  const text = await response.text();
  let body: PayloadRecord = {};
  try { body = text ? JSON.parse(text) as PayloadRecord : {}; } catch { body = { error: "PAYLOAD_NON_JSON_RESPONSE" }; }
  return { status: response.status, body };
}

async function listPayload(collection: "procedures" | "documents", assertion: string, includeDrafts = false): Promise<PayloadRecord[]> {
  const rows: PayloadRecord[] = [];
  let page = 1;
  for (let count = 0; count < 10_000; count += 1) {
    const locale = collection === "procedures" ? "&locale=all" : "";
    const draft = includeDrafts ? "&draft=true" : "";
    const response = await payloadRequest(`/api/${collection}?limit=100&page=${page}&depth=1${locale}${draft}`, assertion);
    if (response.status !== 200) throw new Error(`PAYLOAD_${collection.toUpperCase()}_LIST_FAILED_${response.status}`);
    const body = response.body as PayloadPage;
    if (!Array.isArray(body.docs)) throw new Error(`PAYLOAD_${collection.toUpperCase()}_DOCS_MISSING`);
    rows.push(...body.docs.filter((item): item is PayloadRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))));
    const totalPages = Number(body.totalPages || 0);
    const hasNext = body.hasNextPage === true || Number(body.nextPage || 0) > page;
    if (!hasNext && (!totalPages || page >= totalPages)) return rows;
    const nextPage = Number(body.nextPage || page + 1);
    page = Number.isInteger(nextPage) && nextPage > page ? nextPage : page + 1;
  }
  throw new Error(`PAYLOAD_${collection.toUpperCase()}_PAGINATION_EXCEEDED`);
}

function setDiff(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return Array.from(new Set(left)).filter((value) => !rightSet.has(value.toLowerCase()));
}

function runtimePairs(mappings: ProcToDocs[]): string[] {
  return Array.from(new Set(mappings.flatMap((mapping) =>
    (mapping.doc_ids || []).map((documentId) => `${mapping.procedure_id}\u0000${documentId}`),
  ))).sort();
}

function relationValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === "" ? [] : [value];
}

function relationId(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as PayloadRecord;
    return String(record.id || record.canonicalId || record.businessIdentifier || "").trim();
  }
  return String(value || "").trim();
}

function payloadPairs(procedures: PayloadRecord[], documents: PayloadRecord[]): { pairs: string[]; broken: number } {
  const publishedProcedures = procedures.filter(isPublished);
  const publishedDocuments = documents.filter(isPublished);
  const procedureByInternal = new Map<string, string>();
  for (const procedure of publishedProcedures) {
    const canonical = canonicalId(procedure);
    const internal = String(procedure.id || "").trim();
    if (canonical && internal) procedureByInternal.set(internal, canonical);
  }
  const pairs: string[] = [];
  let broken = 0;
  for (const document of publishedDocuments) {
    const documentId = canonicalId(document);
    for (const relation of relationValues(document.procedureRelations)) {
      const procedureId = procedureByInternal.get(relationId(relation));
      if (!procedureId || !documentId) { broken += 1; continue; }
      pairs.push(`${procedureId}\u0000${documentId}`);
    }
  }
  return { pairs: Array.from(new Set(pairs)).sort(), broken };
}

export async function getPayloadBootstrapStatus(
  assertion: string,
  runtimeProcedureIds: string[],
  runtimeDocuments: StoredDocAsset[],
  runtimeMappings: ProcToDocs[],
): Promise<PayloadBootstrapStatus> {
  const [procedures, documents] = await Promise.all([listPayload("procedures", assertion), listPayload("documents", assertion)]);
  const publishedProcedures = procedures.filter(isPublished);
  const publishedDocuments = documents.filter(isPublished);
  const procedureIds = publishedProcedures.map(canonicalId).filter(Boolean);
  const documentIds = publishedDocuments.map(canonicalId).filter(Boolean);
  const expectedDocumentIds = runtimeDocuments.map((document) => document.id);
  const expectedPairs = runtimePairs(runtimeMappings);
  const observedPairs = payloadPairs(procedures, documents);
  const missingProcedureIds = setDiff(runtimeProcedureIds, procedureIds).length;
  const extraProcedureIds = setDiff(procedureIds, runtimeProcedureIds).length;
  const missingDocumentIds = setDiff(expectedDocumentIds, documentIds).length;
  const extraDocumentIds = setDiff(documentIds, expectedDocumentIds).length;
  const missingMappingPairs = setDiff(expectedPairs, observedPairs.pairs).length;
  const extraMappingPairs = setDiff(observedPairs.pairs, expectedPairs).length;
  return {
    procedureCount: procedures.length,
    publishedProcedureCount: publishedProcedures.length,
    documentCount: documents.length,
    publishedDocumentCount: publishedDocuments.length,
    missingProcedureIds,
    extraProcedureIds,
    missingDocumentIds,
    extraDocumentIds,
    missingMappingPairs,
    extraMappingPairs,
    brokenRelationships: observedPairs.broken,
    parity: missingProcedureIds === 0 && extraProcedureIds === 0
      && missingDocumentIds === 0 && extraDocumentIds === 0
      && missingMappingPairs === 0 && extraMappingPairs === 0 && observedPairs.broken === 0,
  };
}

function currentDocValue(document: StoredDocAsset, legacyKey: string): string {
  const record = document as StoredDocAsset & Record<string, unknown>;
  return String(record[legacyKey] || "").trim();
}
function documentDraftData(document: StoredDocAsset, procedureInternalIds: Array<string | number>, published: boolean): PayloadRecord {
  const status = published ? "PUBLISHED" : "DRAFT";
  return {
    canonicalId: document.id,
    businessIdentifier: document.id,
    titleAr: document.title,
    descriptionAr: document.description_lb || undefined,
    assetType: document.asset_type || currentDocValue(document, "kind") || undefined,
    fileFormat: document.file_format || undefined,
    originalFilename: document.file_name || undefined,
    storagePath: document.file_path || undefined,
    publicUrl: document.public_url || document.url || undefined,
    sourceAuthority: currentDocValue(document, "source") || document.source_refs?.[0]?.source_id || undefined,
    publicationState: status,
    workflowStatus: status,
    sourceSystem: "PAYLOAD_CMS",
    tags: (document.tags || []).map((item) => ({ item })),
    procedureRelations: procedureInternalIds,
    sources: (document.source_refs || []).map((source) => ({
      sourceId: source.source_id || "",
      sourcePath: source.source_path || "",
      anchor: source.anchor || "",
    })),
    _status: published ? "published" : "draft",
  };
}

function mappingByDocument(mappings: ProcToDocs[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const mapping of mappings) {
    for (const documentId of mapping.doc_ids || []) {
      const values = result.get(documentId) || [];
      if (!values.includes(mapping.procedure_id)) values.push(mapping.procedure_id);
      result.set(documentId, values);
    }
  }
  return result;
}

function publishedProcedureIndex(procedures: PayloadRecord[], expectedProcedureIds: string[]): Map<string, string | number> {
  const index = new Map<string, string | number>();
  for (const procedure of procedures.filter(isPublished)) {
    const canonical = canonicalId(procedure);
    const internal = procedure.id;
    const validInternal = (typeof internal === "number" && Number.isInteger(internal))
      || (typeof internal === "string" && internal.trim().length > 0);
    if (canonical && validInternal) index.set(canonical.toLowerCase(), internal as string | number);
  }
  const missing = expectedProcedureIds.filter((id) => !index.has(id.toLowerCase()));
  const extra = Array.from(index.keys()).filter((id) => !expectedProcedureIds.some((expected) => expected.toLowerCase() === id));
  if (missing.length || extra.length) throw new Error(`PAYLOAD_PROCEDURE_PARITY_REQUIRED_MISSING_${missing.length}_EXTRA_${extra.length}`);
  return index;
}

export async function applyPayloadDocumentDrafts(
  assertion: string,
  runtimeProcedureIds: string[],
  runtimeDocuments: StoredDocAsset[],
  runtimeMappings: ProcToDocs[],
): Promise<{ requested: number; applied: number }> {
  const [procedures, existingDocuments] = await Promise.all([listPayload("procedures", assertion), listPayload("documents", assertion, true)]);
  const procedureIndex = publishedProcedureIndex(procedures, runtimeProcedureIds);
  const existingByCanonical = new Map(existingDocuments.map((document) => [canonicalId(document).toLowerCase(), document]));
  const relations = mappingByDocument(runtimeMappings);
  let applied = 0;
  for (const document of runtimeDocuments) {
    const procedureInternalIds = (relations.get(document.id) || []).map((procedureId) => {
      const internalId = procedureIndex.get(procedureId.toLowerCase());
      if (!internalId) throw new Error(`PAYLOAD_DOCUMENT_RELATION_TARGET_MISSING_${procedureId}`);
      return internalId;
    });
    const existing = existingByCanonical.get(document.id.toLowerCase());
    const pathname = existing?.id
      ? `/api/documents/${encodeURIComponent(String(existing.id))}?draft=true`
      : "/api/documents?draft=true";
    const response = await payloadRequest(pathname, assertion, {
      method: existing?.id ? "PATCH" : "POST",
      body: JSON.stringify(documentDraftData(document, procedureInternalIds, false)),
    });
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`PAYLOAD_DOCUMENT_DRAFT_APPLY_FAILED_${response.status}`);
    }
    applied += 1;
  }
  return { requested: runtimeDocuments.length, applied };
}

export async function publishPayloadDocuments(
  assertion: string,
  runtimeProcedureIds: string[],
  runtimeDocuments: StoredDocAsset[],
  runtimeMappings: ProcToDocs[],
): Promise<{ requested: number; published: number; status: PayloadBootstrapStatus }> {
  const [procedures, documents] = await Promise.all([listPayload("procedures", assertion), listPayload("documents", assertion, true)]);
  const procedureIndex = publishedProcedureIndex(procedures, runtimeProcedureIds);
  const relations = mappingByDocument(runtimeMappings);
  const documentByCanonical = new Map(documents.map((document) => [canonicalId(document).toLowerCase(), document]));
  const missingDrafts = runtimeDocuments.filter((document) => !documentByCanonical.has(document.id.toLowerCase()));
  const extras = Array.from(documentByCanonical.keys()).filter((id) => !runtimeDocuments.some((document) => document.id.toLowerCase() === id));
  if (missingDrafts.length || extras.length) throw new Error(`PAYLOAD_DOCUMENT_DRAFT_PARITY_REQUIRED_MISSING_${missingDrafts.length}_EXTRA_${extras.length}`);
  let published = 0;
  for (const document of runtimeDocuments) {
    const existing = documentByCanonical.get(document.id.toLowerCase());
    const internalId = String(existing?.id || "").trim();
    if (!internalId) throw new Error("PAYLOAD_DOCUMENT_INTERNAL_ID_MISSING");
    const procedureInternalIds = (relations.get(document.id) || []).map((procedureId) => {
      const relationId = procedureIndex.get(procedureId.toLowerCase());
      if (!relationId) throw new Error(`PAYLOAD_DOCUMENT_RELATION_TARGET_MISSING_${procedureId}`);
      return relationId;
    });
    const response = await payloadRequest(`/api/documents/${encodeURIComponent(internalId)}?draft=false`, assertion, {
      method: "PATCH",
      body: JSON.stringify(documentDraftData(document, procedureInternalIds, true)),
    });
    if (response.status !== 200) throw new Error(`PAYLOAD_DOCUMENT_PUBLISH_FAILED_${response.status}`);
    published += 1;
  }
  const status = await getPayloadBootstrapStatus(assertion, runtimeProcedureIds, runtimeDocuments, runtimeMappings);
  if (!status.parity) {
    throw new Error(`PAYLOAD_DOCUMENT_PUBLISH_PARITY_FAILED_MISSING_DOCS_${status.missingDocumentIds}_MISSING_PAIRS_${status.missingMappingPairs}`);
  }
  return { requested: runtimeDocuments.length, published, status };
}
