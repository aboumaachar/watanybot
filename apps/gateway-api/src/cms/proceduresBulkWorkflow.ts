import { createHash } from "node:crypto";

export const UD3_EXPORT_SCHEMA_VERSION = "ud3-procedure-v1";

export type BulkProcedure = {
  procedureCode: string;
  title: { ar: string; en: string };
  summary: { ar: string; en: string };
  eligibility: string[];
  requirements: string[];
  steps: string[];
  category: string;
  sourceAuthority: string;
  publicationState: "DRAFT" | "PUBLISHED";
  workflowStatus: "DRAFT" | "PUBLISHED";
};

export type ProcedureExport = {
  schemaVersion: typeof UD3_EXPORT_SCHEMA_VERSION;
  records: BulkProcedure[];
};

export type BulkValidation = {
  valid: boolean;
  rowsRead: number;
  validRows: number;
  invalidRows: number;
  duplicateIds: string[];
  localizationDefects: string[];
  structuralDefects: string[];
  migrationEligibility: "VALID" | "INVALID";
  localizationStatus: "COMPLETE" | "NOT_AVAILABLE";
  errors: string[];
};

export type ProcedureDiff = {
  procedureCode: string;
  beforeCanonicalHash: string;
  afterCanonicalHash: string;
  materialChange: boolean;
  changedFields: string[];
};

export type BulkOperationFailure = { id: string; reason: string };
export type BulkOperationResult = {
  requested_count: number;
  validated_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  errors: BulkOperationFailure[];
};

export function summarizeBulkOperation(requestedCount: number, validatedCount: number, successes: readonly string[], failures: readonly BulkOperationFailure[]): BulkOperationResult {
  const successCount = successes.length;
  const failedCount = failures.length;
  return {
    requested_count: requestedCount,
    validated_count: validatedCount,
    success_count: successCount,
    failed_count: failedCount,
    skipped_count: Math.max(0, requestedCount - successCount - failedCount),
    errors: [...failures],
  };
}

function canonical(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort((left, right) => left.localeCompare(right)));
}

export function canonicalProcedureHash(procedure: BulkProcedure): string {
  return createHash("sha256").update(canonical(procedure)).digest("hex");
}

export function canonicalExportHash(exported: ProcedureExport): string {
  return createHash("sha256").update(canonical(exported)).digest("hex");
}

export function semanticDiffHash(diffs: ProcedureDiff[]): string {
  return createHash("sha256").update(canonical(diffs)).digest("hex");
}

export function validateProcedureExport(input: unknown): BulkValidation {
  const errors: string[] = [];
  const localizationDefects: string[] = [];
  const structuralDefects: string[] = [];
  const records = input && typeof input === "object" && Array.isArray((input as ProcedureExport).records)
    ? (input as ProcedureExport).records
    : [];
  if (!input || typeof input !== "object" || (input as ProcedureExport).schemaVersion !== UD3_EXPORT_SCHEMA_VERSION) {
    errors.push("SCHEMA_VERSION_INVALID");
  }
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const id = String(record?.procedureCode || "");
    if (!/^proc-[a-z0-9]+$/i.test(id)) errors.push(`ROW_${index + 1}_PROC_ID_INVALID`);
    if (seen.has(id.toLowerCase())) errors.push(`ROW_${index + 1}_DUPLICATE_PROC_ID`);
    seen.add(id.toLowerCase());
    if (!record?.title?.ar || !record?.title?.en) {
      const defect = `ROW_${index + 1}_LOCALIZATION_REQUIRED`;
      localizationDefects.push(defect);
    }
    if (!Array.isArray(record?.steps) || record.steps.length === 0) {
      const defect = `ROW_${index + 1}_RENDERABLE_STRUCTURE_REQUIRED`;
      structuralDefects.push(defect);
      errors.push(defect);
    }
  });
  const invalidRowIndexes = new Set(errors
    .filter((error) => error.startsWith("ROW_"))
    .map((error) => error.split("_").slice(0, 2).join("_")));
  return {
    valid: errors.length === 0,
    rowsRead: records.length,
    validRows: Math.max(0, records.length - invalidRowIndexes.size),
    invalidRows: invalidRowIndexes.size,
    duplicateIds: errors.filter((error) => error.endsWith("DUPLICATE_PROC_ID")),
    localizationDefects,
    structuralDefects,
    migrationEligibility: errors.length === 0 ? "VALID" : "INVALID",
    localizationStatus: localizationDefects.length === 0 ? "COMPLETE" : "NOT_AVAILABLE",
    errors,
  };
}

export function diffProcedure(before: BulkProcedure, after: BulkProcedure): ProcedureDiff {
  const changedFields = (Object.keys(after) as Array<keyof BulkProcedure>).filter((field) => canonical(before[field]) !== canonical(after[field]));
  return {
    procedureCode: after.procedureCode,
    beforeCanonicalHash: canonicalProcedureHash(before),
    afterCanonicalHash: canonicalProcedureHash(after),
    materialChange: changedFields.length > 0,
    changedFields: changedFields.map(String),
  };
}

export function renderProcedureReviewHtml(exported: ProcedureExport, validation: BulkValidation): string {
  const escape = (value: string) => value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] || character));
  const rows = exported.records.map((record) => {
    const steps = record.steps.map((step) => `<li>${escape(step)}</li>`).join("");
    return ["<article><h2>", escape(record.procedureCode), "</h2><p>", escape(record.title.ar), " / ", escape(record.title.en), "</p><p>", escape(record.summary.ar), " / ", escape(record.summary.en), "</p><ol>", steps, "</ol></article>"].join("");
  }).join("");
  return `<!doctype html><meta charset="utf-8"><title>UD3 Procedure Review</title><p>Schema: ${escape(exported.schemaVersion)}; Valid: ${validation.valid ? "YES" : "NO"}</p>${rows}`;
}
