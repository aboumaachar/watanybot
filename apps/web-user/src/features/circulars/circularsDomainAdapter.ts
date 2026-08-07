import { CIRCULAR_TAXONOMY, type CircularTaxonomyKey } from "./circularsTaxonomy";

export type CircularSourceRecord = Record<string, unknown>;

export type NormalizedCircularRecord = Readonly<{
  id: string;
  title: string;
  issuer: string;
  summary: string;
  date?: string;
  documentType?: string;
  category: CircularTaxonomyKey;
  needsReview: boolean;
  source: CircularSourceRecord;
}>;

const SECURITY_TERMS = ["laf", "army", "isf", "security", "customs", "parliament police", "general security", "state security"];
const RABITA_TERMS = ["rabita", "league"];
const VETERAN_TERMS = ["veteran", "retired", "retirement"];
const BDL_TERMS = ["banque du liban", "bdl", "bank of lebanon", "central bank"];
const ADMIN_TERMS = ["memo", "memorandum", "administrative", "notice"];
const DECREE_TERMS = ["decree"];
const LAW_TERMS = ["law", "legal"];

function pickString(record: CircularSourceRecord, keys: readonly string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function includesAny(text: string, terms: readonly string[]): boolean {
  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

export function classifyCircularRecord(record: CircularSourceRecord): CircularTaxonomyKey {
  const text = [
    pickString(record, ["category", "type", "documentType", "issuer", "source", "authority", "title", "titleAr", "summary", "description"]),
    JSON.stringify(record),
  ].join(" ");

  if (includesAny(text, SECURITY_TERMS)) return "security_institutions";
  if (includesAny(text, RABITA_TERMS)) return "rabita";
  if (includesAny(text, VETERAN_TERMS)) return "veterans";
  if (includesAny(text, BDL_TERMS)) return "banque_du_liban";
  if (includesAny(text, ADMIN_TERMS)) return "administrative_memos";
  if (includesAny(text, DECREE_TERMS)) return "decrees";
  if (includesAny(text, LAW_TERMS)) return "laws";
  return "other";
}

export function normalizeCircularRecord(record: CircularSourceRecord, index = 0): NormalizedCircularRecord {
  const category = classifyCircularRecord(record);
  const title = pickString(record, ["titleAr", "title_ar", "arabicTitle", "title", "label", "name"], "Circular");
  const issuer = pickString(record, ["issuer", "authority", "source", "organization", "owner"], "WatanyBot");
  const summary = pickString(record, ["summary", "description", "body", "details"], "");
  const id = pickString(record, ["id", "key", "slug", "code"], `circular-${index + 1}`);
  const date = pickString(record, ["date", "publishedAt", "createdAt", "updatedAt"], "");
  const documentType = pickString(record, ["documentType", "type", "category"], "");

  return {
    id,
    title,
    issuer,
    summary,
    date: date || undefined,
    documentType: documentType || undefined,
    category,
    needsReview: category === "other",
    source: record,
  };
}

export function normalizeCircularRecords(records: readonly CircularSourceRecord[]): NormalizedCircularRecord[] {
  return records.map((record, index) => normalizeCircularRecord(record, index));
}

export function getCircularTaxonomyOptions() {
  return CIRCULAR_TAXONOMY;
}

// APEX_CIRCULARS_LEGACY_COMPAT_START
export type CircularRecord = Record<string, unknown>;

export function classifyCircularCategory(record: unknown) {
  return classifyCircularCategory(record as never);
}

export function toCircularRecord(record: unknown): CircularRecord {
  if (record && typeof record === 'object') {
    return record as CircularRecord;
  }

  return { value: record } as CircularRecord;
}

export function toCircularRecords(records: unknown): CircularRecord[] {
  if (Array.isArray(records)) {
    return records.map((record) => toCircularRecord(record));
  }

  if (records == null) {
    return [];
  }

  return [toCircularRecord(records)];
}
// APEX_CIRCULARS_LEGACY_COMPAT_END
