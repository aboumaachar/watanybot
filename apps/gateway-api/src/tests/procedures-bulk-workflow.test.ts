import { describe, expect, it } from "vitest";
import {
  UD3_EXPORT_SCHEMA_VERSION,
  canonicalProcedureHash,
  diffProcedure,
  renderProcedureReviewHtml,
  summarizeBulkOperation,
  validateProcedureExport,
  type BulkProcedure,
} from "../cms/proceduresBulkWorkflow.js";

const procedure: BulkProcedure = {
  procedureCode: "proc-ud3reference",
  title: { ar: "إجراء اختباري", en: "Reference procedure" },
  summary: { ar: "ملخص اختباري", en: "Reference summary" },
  eligibility: ["مستخدم اختبار"],
  requirements: [],
  steps: ["تنفيذ الخطوة"],
  category: "acceptance",
  sourceAuthority: "procedures",
  publicationState: "PUBLISHED",
  workflowStatus: "PUBLISHED",
};

describe("UD-3 Procedures bulk workflow", () => {
  it("validates deterministic export and semantic diff", () => {
    const exported = { schemaVersion: UD3_EXPORT_SCHEMA_VERSION, records: [procedure] } as const;
    expect(validateProcedureExport(exported).valid).toBe(true);
    expect(canonicalProcedureHash(procedure)).toBe(canonicalProcedureHash({ ...procedure }));
    const changed = { ...procedure, summary: { ...procedure.summary, en: "Changed summary" } };
    const diff = diffProcedure(procedure, changed);
    expect(diff.materialChange).toBe(true);
    expect(diff.changedFields).toContain("summary");
  });

  it("rejects duplicate and invalid identities without mutation", () => {
    const invalid = { schemaVersion: UD3_EXPORT_SCHEMA_VERSION, records: [procedure, { ...procedure, procedureCode: "bad-id" }, { ...procedure }] };
    const result = validateProcedureExport(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("ROW_2_PROC_ID_INVALID");
    expect(result.errors).toContain("ROW_3_DUPLICATE_PROC_ID");
  });

  it("reports missing English localization without copying Arabic into English", () => {
    const incomplete = { ...procedure, title: { ar: procedure.title.ar, en: "" } };
    const result = validateProcedureExport({ schemaVersion: UD3_EXPORT_SCHEMA_VERSION, records: [incomplete] });
    expect(result.valid).toBe(true);
    expect(result.invalidRows).toBe(0);
    expect(result.localizationDefects).toEqual(["ROW_1_LOCALIZATION_REQUIRED"]);
    expect(result.migrationEligibility).toBe("VALID");
    expect(result.localizationStatus).toBe("NOT_AVAILABLE");
    expect(incomplete.title.en).not.toBe(incomplete.title.ar);
  });

  it("renders escaped review HTML", () => {
    const html = renderProcedureReviewHtml({ schemaVersion: UD3_EXPORT_SCHEMA_VERSION, records: [procedure] }, validateProcedureExport({ schemaVersion: UD3_EXPORT_SCHEMA_VERSION, records: [procedure] }));
    expect(html).toContain("proc-ud3reference");
    expect(html).not.toContain("<script");
  });

  it("returns an explicit partial-failure result contract", () => {
    expect(summarizeBulkOperation(4, 4, ["proc-a", "proc-b"], [{ id: "proc-c", reason: "PAYLOAD_TIMEOUT" }])).toEqual({
      requested_count: 4,
      validated_count: 4,
      success_count: 2,
      failed_count: 1,
      skipped_count: 1,
      errors: [{ id: "proc-c", reason: "PAYLOAD_TIMEOUT" }],
    });
  });
});
