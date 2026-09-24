import { describe, expect, it } from "vitest";
import pg from "pg";

function safeTestUrl(): string | undefined {
  const value = process.env.APEX_V119_TEST_DATABASE_URL;
  if (!value) return undefined;
  const parsed = new URL(value);
  if (!(parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1")) throw new Error("migration test requires loopback");
  if (!/(test|apex_v119|ud3)/i.test(decodeURIComponent(parsed.pathname))) throw new Error("migration test requires disposable database");
  return value;
}

describe("UD-3 import-plan migration authority", () => {
  it.runIf(Boolean(process.env.APEX_V119_TEST_DATABASE_URL))("applies 038 through the canonical runner and proves metadata", async () => {
    const connectionString = safeTestUrl();
    if (!connectionString) return;
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const { runMigrations } = await import("../migrate");
    const pool = new pg.Pool({ connectionString });
    try {
      await runMigrations();
      const migration = await pool.query("SELECT 1 FROM _migrations WHERE name = '038_ud3_import_plans.sql'");
      const columns = await pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_import_plans' ORDER BY ordinal_position");
      const constraint = await pool.query<{ definition: string }>("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'admin_import_plans_status_check'");
      expect(migration.rowCount).toBe(1);
      expect(columns.rows.map((row) => row.column_name)).toEqual(expect.arrayContaining(["input_payload", "status", "target_semantic_hash", "resulting_payload_version_id", "applied_at"]));
      expect(constraint.rows[0]?.definition).toContain("RECOVERY_REQUIRED");
    } finally {
      await pool.end();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
