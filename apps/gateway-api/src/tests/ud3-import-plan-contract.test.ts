import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../db/migrations/038_ud3_import_plans.sql", import.meta.url), "utf8");
const store = readFileSync(new URL("../admin-authority/adminAuthorityStore.ts", import.meta.url), "utf8");

describe("UD-3 import-plan control-plane contract", () => {
  it("owns schema creation in the canonical migration", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS admin_import_plans");
    expect(migration).toContain("APPLYING");
    expect(migration).toContain("RECOVERY_REQUIRED");
    expect(store).not.toContain("CREATE TABLE IF NOT EXISTS admin_import_plans");
  });

  it("uses one conditional VALIDATED-to-APPLYING claim", () => {
    expect(store).toContain("SET status = 'APPLYING'");
    expect(store).toContain("status = 'VALIDATED'");
    expect(store).toContain("expires_at > $3::timestamptz");
    expect(store).toContain("RETURNING plan_id AS \"planId\"");
    expect(store).toContain("markImportPlanRecoveryRequired");
  });
});
