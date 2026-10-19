import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getClient, query } from '../lib/db.js';

let ensureTablesPromise: Promise<void> | null = null;

function toJson(value: unknown): unknown {
  if (value === undefined) return null;
  return value;
}

export function createAdminAuthorityId(prefix: 'audit' | 'approval' | 'version'): string {
  return `${prefix}_${Date.now()}_${randomUUID()}`;
}

export type ImportPlanStatus = 'VALIDATED' | 'APPLYING' | 'APPLIED' | 'RECOVERY_REQUIRED' | 'EXPIRED' | 'SUPERSEDED' | 'REJECTED';

export type ImportPlan = {
  planId: string;
  actorGatewayUserId: string;
  schemaVersion: string;
  inputCanonicalHash: string;
  baselineEditorialHash: string;
  semanticDiffHash: string;
  inputPayload: unknown;
  targetSemanticHash?: string;
  resultingPayloadVersionId?: string;
  status: ImportPlanStatus;
  createdAt: string;
  expiresAt: string;
};

export async function ensureAdminAuthorityTables(): Promise<void> {
  ensureTablesPromise ??= (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS admin_audit_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          before_state JSONB,
          after_state JSONB,
          reason TEXT,
          approval_id TEXT,
          request_id TEXT,
          ip TEXT,
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          immutable_hash TEXT
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created_at
        ON admin_audit_events (created_at DESC)
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_admin_audit_events_event_type
        ON admin_audit_events (event_type)
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS admin_approval_requests (
          id TEXT PRIMARY KEY,
          action_type TEXT NOT NULL,
          requested_by TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          reason TEXT,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          decided_at TIMESTAMPTZ,
          decided_by TEXT,
          decision_note TEXT
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_admin_approval_requests_status_created
        ON admin_approval_requests (status, created_at DESC)
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS admin_entity_versions (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          snapshot JSONB NOT NULL,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          reason TEXT,
          UNIQUE(entity_type, entity_id, version)
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_admin_entity_versions_lookup
        ON admin_entity_versions (entity_type, entity_id, version DESC)
      `);

  })().catch((error) => {
    ensureTablesPromise = null;
    throw error;
  });

  return ensureTablesPromise;
}

export async function createImportPlan(input: Omit<ImportPlan, 'createdAt'> & { createdAt?: string }): Promise<ImportPlan> {
  await ensureAdminAuthorityTables();
  const plan: ImportPlan = { ...input, createdAt: input.createdAt || new Date().toISOString() };
  await query(
    `INSERT INTO admin_import_plans (plan_id, actor_gateway_user_id, schema_version, input_canonical_hash, baseline_editorial_hash, semantic_diff_hash, input_payload, target_semantic_hash, resulting_payload_version_id, status, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::timestamptz, $12::timestamptz)`,
    [plan.planId, plan.actorGatewayUserId, plan.schemaVersion, plan.inputCanonicalHash, plan.baselineEditorialHash, plan.semanticDiffHash, JSON.stringify(plan.inputPayload), plan.targetSemanticHash ?? null, plan.resultingPayloadVersionId ?? null, plan.status, plan.createdAt, plan.expiresAt],
  );
  return plan;
}

export async function getImportPlan(planId: string): Promise<ImportPlan | null> {
  await ensureAdminAuthorityTables();
  const result = await query<ImportPlan>(
    `SELECT plan_id AS "planId", actor_gateway_user_id AS "actorGatewayUserId", schema_version AS "schemaVersion", input_canonical_hash AS "inputCanonicalHash", baseline_editorial_hash AS "baselineEditorialHash", semantic_diff_hash AS "semanticDiffHash", input_payload AS "inputPayload", target_semantic_hash AS "targetSemanticHash", resulting_payload_version_id AS "resultingPayloadVersionId", status, created_at AS "createdAt", expires_at AS "expiresAt" FROM admin_import_plans WHERE plan_id = $1`,
    [planId],
  );
  return result.rows[0] || null;
}

export async function updateImportPlanStatus(planId: string, status: ImportPlanStatus): Promise<void> {
  await ensureAdminAuthorityTables();
  await query(`UPDATE admin_import_plans SET status = $2 WHERE plan_id = $1`, [planId, status]);
}

export async function markImportPlanApplied(planId: string, targetSemanticHash: string, resultingPayloadVersionId: string): Promise<void> {
  await ensureAdminAuthorityTables();
  await query(
    `UPDATE admin_import_plans
     SET status = 'APPLIED', target_semantic_hash = $2, resulting_payload_version_id = $3, applied_at = NOW()
     WHERE plan_id = $1 AND status = 'APPLYING'`,
    [planId, targetSemanticHash, resultingPayloadVersionId],
  );
}

export async function markImportPlanRecoveryRequired(planId: string): Promise<void> {
  await ensureAdminAuthorityTables();
  await query(`UPDATE admin_import_plans SET status = 'RECOVERY_REQUIRED' WHERE plan_id = $1 AND status = 'APPLYING'`, [planId]);
}

export async function reconcileImportPlan(planId: string, actorGatewayUserId: string, targetSemanticHash: string, resultingPayloadVersionId: string): Promise<boolean> {
  await ensureAdminAuthorityTables();
  const result = await query(
    `UPDATE admin_import_plans
     SET status = 'APPLIED', target_semantic_hash = $3, resulting_payload_version_id = $4, applied_at = NOW()
     WHERE plan_id = $1 AND actor_gateway_user_id = $2
       AND (status = 'RECOVERY_REQUIRED'
         OR (status = 'APPLIED' AND target_semantic_hash = $3 AND resulting_payload_version_id = $4))`,
    [planId, actorGatewayUserId, targetSemanticHash, resultingPayloadVersionId],
  );
  return result.rowCount === 1;
}

export async function claimImportPlan(planId: string, actorGatewayUserId: string, now = new Date()): Promise<ImportPlan | null> {
  await ensureAdminAuthorityTables();
  const result = await query<ImportPlan>(
    `UPDATE admin_import_plans
     SET status = 'APPLYING'
     WHERE plan_id = $1 AND actor_gateway_user_id = $2 AND status = 'VALIDATED' AND expires_at > $3::timestamptz
    RETURNING plan_id AS "planId", actor_gateway_user_id AS "actorGatewayUserId", schema_version AS "schemaVersion", input_canonical_hash AS "inputCanonicalHash", baseline_editorial_hash AS "baselineEditorialHash", semantic_diff_hash AS "semanticDiffHash", input_payload AS "inputPayload", target_semantic_hash AS "targetSemanticHash", resulting_payload_version_id AS "resultingPayloadVersionId", status, created_at AS "createdAt", expires_at AS "expiresAt"`,
    [planId, actorGatewayUserId, now.toISOString()],
  );
  return result.rows[0] || null;
}

export async function createAdminEntityVersionRow(input: {
  id: string;
  entityType: string;
  entityId: string;
  snapshot: unknown;
  createdBy: string;
  reason?: string;
}): Promise<{ version: number; createdAt: string }> {
  await ensureAdminAuthorityTables();
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE admin_entity_versions IN SHARE ROW EXCLUSIVE MODE');

    const current = await client.query<{ next_version: number }>(
      `
      SELECT COALESCE(MAX(version), 0) + 1 AS next_version
      FROM admin_entity_versions
      WHERE entity_type = $1 AND entity_id = $2
      `,
      [input.entityType, input.entityId],
    );

    const nextVersion = Number(current.rows[0]?.next_version || 1);

    const inserted = await client.query<{ created_at: string }>(
      `
      INSERT INTO admin_entity_versions (
        id, entity_type, entity_id, version, snapshot, created_by, reason
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      RETURNING created_at
      `,
      [
        input.id,
        input.entityType,
        input.entityId,
        nextVersion,
        JSON.stringify(toJson(input.snapshot)),
        input.createdBy,
        input.reason ?? null,
      ],
    );

    await client.query('COMMIT');
    return {
      version: nextVersion,
      createdAt: new Date(inserted.rows[0]?.created_at || Date.now()).toISOString(),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createAdminEntityVersionRowInTransaction(client: PoolClient, input: {
  id: string;
  entityType: string;
  entityId: string;
  snapshot: unknown;
  createdBy: string;
  reason?: string;
}): Promise<{ version: number; createdAt: string }> {
  await client.query('LOCK TABLE admin_entity_versions IN SHARE ROW EXCLUSIVE MODE');
  const current = await client.query<{ next_version: number }>(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM admin_entity_versions WHERE entity_type = $1 AND entity_id = $2`,
    [input.entityType, input.entityId],
  );
  const nextVersion = Number(current.rows[0]?.next_version || 1);
  const inserted = await client.query<{ created_at: string }>(
    `INSERT INTO admin_entity_versions (id, entity_type, entity_id, version, snapshot, created_by, reason)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING created_at`,
    [input.id, input.entityType, input.entityId, nextVersion, JSON.stringify(toJson(input.snapshot)), input.createdBy, input.reason ?? null],
  );
  return { version: nextVersion, createdAt: new Date(inserted.rows[0]?.created_at || Date.now()).toISOString() };
}
