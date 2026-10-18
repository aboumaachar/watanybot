/**
 * Gate 2 local-only migration runner acceptance.
 * Requires explicit GATE2_SYNTHETIC_MIGRATION_ACCEPTANCE=YES and a fresh,
 * empty database gate2_runner_acceptance_20261011, never canonical watany.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { applyMigrationDirectory } from "../src/db/migrate.js";

const TEST_DB = process.env.GATE2_TEST_DATABASE || "gate2_runner_acceptance_20261011";
if (!/^gate2_runner_acceptance_(?:v[0-9]+_)?20261011$/.test(TEST_DB)) {
  throw new Error("GATE2_TEST_DATABASE_NAME_REJECTED");
}
const rawUrl = process.env.DATABASE_URL;
if (process.env.GATE2_SYNTHETIC_MIGRATION_ACCEPTANCE !== "YES" || !rawUrl) {
  throw new Error("GATE2_EXPLICIT_LOCAL_SYNTHETIC_ACCEPTANCE_REQUIRED");
}
const dbUrl = new URL(rawUrl);
if (!["localhost", "127.0.0.1", "[::1]"].includes(dbUrl.hostname)) {
  throw new Error("GATE2_REMOTE_DATABASE_REJECTED");
}
dbUrl.pathname = "/" + TEST_DB;

const pool = new pg.Pool({
  connectionString: dbUrl.toString(),
  max: 1,
  connectionTimeoutMillis: 4000,
});
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate2-migration-fixtures-"));
const fixture = (name: string, sql: string) =>
  fs.writeFileSync(path.join(dir, name), sql, { encoding: "utf8", flag: "wx" });
const replaceFixture = (name: string, sql: string) =>
  fs.writeFileSync(path.join(dir, name), sql, { encoding: "utf8" });

let client: pg.PoolClient | undefined;
let passed = false;
try {
  client = await pool.connect();
  const identity = await client.query("SELECT current_database() AS name");
  assert.equal(identity.rows[0].name, TEST_DB, "Wrong database selected");

  const originalLedger = await client.query(
    "SELECT to_regclass('public._migrations') AS name",
  );
  assert.equal(originalLedger.rows[0].name, null, "Acceptance database must be pristine");

  fixture(
    "001_synthetic_wrapped.sql",
    "BEGIN;\nCREATE TABLE gate2_fixture_initial (id INTEGER PRIMARY KEY);\nCOMMIT;\n",
  );
  const first = await applyMigrationDirectory(client, dir);
  assert.deepEqual(first.applied, ["001_synthetic_wrapped.sql"]);
  const rerun = await applyMigrationDirectory(client, dir);
  assert.equal(rerun.applied.length, 0);
  assert.equal(rerun.alreadyApplied, 1);
  console.log("GATE2_MIGRATION_WRAPPER_IDEMPOTENCE_PASS");

  fixture("002_synthetic_valid.sql", "CREATE TABLE gate2_fixture_would_commit (id INTEGER PRIMARY KEY);");
  fixture(
    "003_synthetic_failure.sql",
    "CREATE TABLE gate2_fixture_must_rollback (id INTEGER PRIMARY KEY);\nSELECT 1 / 0;",
  );
  await assert.rejects(
    () => applyMigrationDirectory(client!, dir),
    /division by zero/i,
  );
  for (const name of ["gate2_fixture_would_commit", "gate2_fixture_must_rollback"]) {
    const result = await client.query("SELECT to_regclass($1) AS name", ["public." + name]);
    assert.equal(result.rows[0].name, null, "DDL leaked past rollback: " + name);
  }
  const afterFailure = await client.query("SELECT name FROM _migrations ORDER BY name");
  assert.deepEqual(afterFailure.rows.map(r => r.name), ["001_synthetic_wrapped.sql"]);
  console.log("GATE2_MIGRATION_BATCH_ROLLBACK_PASS");

  replaceFixture(
    "003_synthetic_failure.sql",
    "CREATE TABLE gate2_fixture_recovered (id INTEGER PRIMARY KEY);",
  );
  const recovered = await applyMigrationDirectory(client, dir);
  assert.deepEqual(recovered.applied, ["002_synthetic_valid.sql", "003_synthetic_failure.sql"]);
  const checkRecovery = await client.query(
    "SELECT to_regclass('public.gate2_fixture_recovered') AS name",
  );
  assert.equal(checkRecovery.rows[0].name, "gate2_fixture_recovered");
  console.log("GATE2_MIGRATION_RECOVERY_COMMIT_PASS");

  fixture(
    "004_synthetic_pending.sql",
    "CREATE TABLE gate2_fixture_ledger_guard (id INTEGER PRIMARY KEY);",
  );
  await client.query(
    "INSERT INTO _migrations(name) VALUES ($1)",
    ["000_synthetic_missing_historical_source.sql"],
  );
  await assert.rejects(
    () => applyMigrationDirectory(client!, dir),
    /MIGRATION_LEDGER_SOURCE_MISSING/,
  );
  const blocked = await client.query(
    "SELECT to_regclass('public.gate2_fixture_ledger_guard') AS name",
  );
  assert.equal(blocked.rows[0].name, null);
  console.log("GATE2_MIGRATION_LEDGER_DRIFT_FAIL_CLOSED_PASS");

  // Remove only the synthetic deliberate conflict from this isolated database.
  await client.query(
    "DELETE FROM _migrations WHERE name = $1",
    ["000_synthetic_missing_historical_source.sql"],
  );
  const resumed = await applyMigrationDirectory(client, dir);
  assert.deepEqual(resumed.applied, ["004_synthetic_pending.sql"]);

  fixture(
    "005_synthetic_mismatched_wrapper.sql",
    "BEGIN;\nCREATE TABLE gate2_never_created (id INTEGER PRIMARY KEY);",
  );
  await assert.rejects(
    () => applyMigrationDirectory(client!, dir),
    /MIGRATION_UNBALANCED_TRANSACTION_WRAPPER/,
  );
  const noDdl = await client.query(
    "SELECT to_regclass('public.gate2_never_created') AS name",
  );
  assert.equal(noDdl.rows[0].name, null);
  console.log("GATE2_MIGRATION_UNSAFE_WRAPPER_FAIL_CLOSED_PASS");

  // Inject a double failure without touching PostgreSQL: SQL fails and then
  // ROLLBACK fails. The runner must preserve evidence of both failures.
  const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), "gate2-rollback-mock-"));
  try {
    fs.writeFileSync(
      path.join(mockDir, "001_mock_failure.sql"),
      "CREATE TABLE gate2_mock_error (id INTEGER PRIMARY KEY);",
    );
    const mockClient = {
      query: async (sql: string) => {
        if (sql === "ROLLBACK") throw new Error("GATE2_SYNTHETIC_ROLLBACK_FAILURE");
        if (sql === "SELECT name FROM _migrations ORDER BY name") return { rows: [] };
        if (sql.includes("CREATE TABLE gate2_mock_error")) {
          throw new Error("GATE2_SYNTHETIC_SQL_FAILURE");
        }
        return { rows: [] };
      },
    } as unknown as pg.PoolClient;
    let sawBoth = false;
    try {
      await applyMigrationDirectory(mockClient, mockDir);
    } catch (err) {
      const combined = err as Error & {
        primaryFailure?: Error;
        rollbackFailure?: Error;
      };
      assert.equal(combined.message, "MIGRATION_FAILED_AND_ROLLBACK_UNVERIFIED");
      assert.equal(combined.primaryFailure?.message, "GATE2_SYNTHETIC_SQL_FAILURE");
      assert.equal(combined.rollbackFailure?.message, "GATE2_SYNTHETIC_ROLLBACK_FAILURE");
      sawBoth = true;
    }
    assert.equal(sawBoth, true);
  } finally {
    fs.rmSync(mockDir, { recursive: true, force: true });
  }
  console.log("GATE2_MIGRATION_DOUBLE_FAILURE_EVIDENCE_PASS");
  passed = true;
} finally {
  if (client) client.release();
  await pool.end();
  fs.rmSync(dir, { recursive: true, force: true });
}
if (!passed) throw new Error("GATE2_RUNNER_TEST_UNVERIFIED");
console.log("GATE2_MIGRATION_RUNNER_ACCEPTANCE_PASS");
