import { randomUUID } from "node:crypto";
import pg from "pg";
import { runMigrations } from "../db/migrate.js";
import { closePool } from "../lib/db.js";
import {
  claimImportPlan,
  createImportPlan,
  getImportPlan,
  markImportPlanApplied,
  markImportPlanRecoveryRequired,
  reconcileImportPlan,
} from "../admin-authority/adminAuthorityStore.js";

const connectionString = process.env.APEX_V119_TEST_DATABASE_URL || process.env.DATABASE_URL || "";
const mode = String(process.env.UD3_RUNTIME_PROOF_MODE || "CLEAN").toUpperCase();

function fail(message: string): never {
  console.error(`UD3_RUNTIME_PROOF_FAILURE=${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function assertDisposableLoopback(value: string): URL {
  if (!value) return fail("DATABASE_URL_MISSING");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail("DATABASE_URL_INVALID");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) return fail("DATABASE_URL_NOT_LOOPBACK");
  if (!/(test|apex_v119|ud3)/iu.test(decodeURIComponent(parsed.pathname))) return fail("DATABASE_URL_NOT_DISPOSABLE");
  return parsed;
}

async function metadata(pool: pg.Pool) {
  const migration = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM _migrations WHERE name = '038_ud3_import_plans.sql'");
  const columns = await pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_import_plans' ORDER BY ordinal_position");
  const constraint = await pool.query<{ definition: string }>("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'admin_import_plans_status_check'");
  return {
    migrationApplied: Number(migration.rows[0]?.count || 0) === 1,
    columns: columns.rows.map((row) => row.column_name),
    constraint: constraint.rows[0]?.definition || "",
  };
}

async function createLegacySchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE admin_import_plans (
      plan_id TEXT PRIMARY KEY,
      actor_gateway_user_id TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      input_canonical_hash TEXT NOT NULL,
      baseline_editorial_hash TEXT NOT NULL,
      semantic_diff_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('VALIDATED', 'APPLYING', 'APPLIED', 'EXPIRED', 'SUPERSEDED', 'REJECTED')),
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await pool.query(
    `INSERT INTO admin_import_plans (plan_id, actor_gateway_user_id, schema_version, input_canonical_hash, baseline_editorial_hash, semantic_diff_hash, status, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'VALIDATED', NOW(), NOW() + interval '15 minutes')`,
    ["legacy_ud3_fixture", "legacy-actor", "ud3-procedure-v1", "legacy-input", "legacy-baseline", "legacy-diff"],
  );
}

async function runMigrationProof(pool: pg.Pool): Promise<void> {
  if (mode === "LEGACY") await createLegacySchema(pool);
  const before = mode === "LEGACY" ? await pool.query<{ plan_id: string }>("SELECT plan_id FROM admin_import_plans WHERE plan_id = 'legacy_ud3_fixture'") : null;
  await runMigrations();
  const after = await metadata(pool);
  if (!after.migrationApplied) return fail("MIGRATION_038_NOT_RECORDED");
  for (const requiredColumn of ["input_payload", "target_semantic_hash", "resulting_payload_version_id", "applied_at", "status"]) {
    if (!after.columns.includes(requiredColumn)) return fail(`MIGRATION_COLUMN_MISSING_${requiredColumn}`);
  }
  if (!after.constraint.includes("RECOVERY_REQUIRED")) return fail("MIGRATION_STATUS_CONSTRAINT_INCOMPLETE");
  if (mode === "LEGACY") {
    const preserved = await pool.query<{ plan_id: string; status: string }>("SELECT plan_id, status FROM admin_import_plans WHERE plan_id = 'legacy_ud3_fixture'");
    if (before?.rowCount !== 1 || preserved.rowCount !== 1 || preserved.rows[0]?.status !== "VALIDATED") return fail("LEGACY_ROW_NOT_PRESERVED");
  }
  const migrationCountBeforeReplay = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM _migrations");
  await runMigrations();
  const migrationCountAfterReplay = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM _migrations");
  if (migrationCountBeforeReplay.rows[0]?.count !== migrationCountAfterReplay.rows[0]?.count) return fail("MIGRATION_REPLAY_DRIFT");
  console.log("MIGRATION_RUNTIME_TEST_SKIPPED=NO");
  console.log(`MIGRATION_MODE=${mode}`);
  console.log(`MIGRATION_038_APPLIED=${after.migrationApplied ? "YES" : "NO"}`);
  console.log(`MIGRATION_038_REQUIRED_COLUMNS=${["input_payload", "target_semantic_hash", "resulting_payload_version_id", "applied_at"].every((column) => after.columns.includes(column)) ? "YES" : "NO"}`);
  console.log(`MIGRATION_038_STATUS_CONSTRAINT_RECOVERY_REQUIRED=${after.constraint.includes("RECOVERY_REQUIRED") ? "YES" : "NO"}`);
  console.log(`LEGACY_ROW_PRESERVED=${mode === "LEGACY" ? "YES" : "NOT_APPLICABLE"}`);
  console.log("MIGRATION_REPLAY_NO_DRIFT=YES");
}

async function runClaimProof(pool: pg.Pool): Promise<void> {
  await runMigrations();
  const planId = `ud3_claim_${randomUUID()}`;
  const actorId = "ud3-claim-actor";
  await createImportPlan({
    planId,
    actorGatewayUserId: actorId,
    schemaVersion: "ud3-procedure-v1",
    inputCanonicalHash: "claim-input",
    baselineEditorialHash: "claim-baseline",
    semanticDiffHash: "claim-diff",
    inputPayload: { schemaVersion: "ud3-procedure-v1", records: [] },
    status: "VALIDATED",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  const claims = await Promise.all([claimImportPlan(planId, actorId), claimImportPlan(planId, actorId)]);
  const successfulClaims = claims.filter((claim) => claim !== null).length;
  const deniedClaims = claims.filter((claim) => claim === null).length;
  const applying = await getImportPlan(planId);
  if (successfulClaims !== 1 || deniedClaims !== 1 || applying?.status !== "APPLYING") return fail("ATOMIC_CLAIM_CONTRACT_FAILED");
  await markImportPlanRecoveryRequired(planId);
  const recovery = await getImportPlan(planId);
  if (recovery?.status !== "RECOVERY_REQUIRED") return fail("APPLYING_TO_RECOVERY_REQUIRED_FAILED");
  await markImportPlanApplied(planId, "recovery-target", "recovery-version");
  const deniedRecoveryApply = await getImportPlan(planId);
  if (deniedRecoveryApply?.status !== "RECOVERY_REQUIRED") return fail("RECOVERY_TO_APPLIED_WAS_NOT_DENIED");
  const reconciled = await reconcileImportPlan(planId, actorId, "reconciled-target", "reconciled-version");
  const finalPlan = await getImportPlan(planId);
  if (!reconciled || finalPlan?.status !== "APPLIED" || finalPlan.targetSemanticHash !== "reconciled-target" || finalPlan.resultingPayloadVersionId !== "reconciled-version") return fail("RECOVERY_RECONCILIATION_FAILED");
  console.log("CLAIM_ATTEMPTS=2");
  console.log("CLAIM_SUCCESS_COUNT=1");
  console.log("CLAIM_DENIAL_COUNT=1");
  console.log("CLAIM_FINAL_STATUS=APPLYING");
  console.log("RECOVERY_REQUIRED_PROVEN=YES");
  console.log("RECOVERY_TO_APPLIED_DIRECT_DENIED=YES");
  console.log("RECOVERY_RECONCILIATION_TO_APPLIED=YES");
}

async function main(): Promise<void> {
  const parsed = assertDisposableLoopback(connectionString);
  const pool = new pg.Pool({ connectionString, max: 2 });
  try {
    if (mode === "CLAIM") await runClaimProof(pool);
    else if (mode === "CLEAN" || mode === "LEGACY") await runMigrationProof(pool);
    else fail(`UNKNOWN_MODE_${mode}`);
  } finally {
    await pool.end();
    await closePool();
  }
  console.log(`DISPOSABLE_DATABASE=${parsed.pathname.replace(/^\//u, "")}`);
  console.log("UD3_GATEWAY_RUNTIME_PROOF=PASS");
}

void main().catch(() => {
  process.exitCode = 1;
});
