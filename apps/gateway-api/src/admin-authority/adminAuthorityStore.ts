import type { PoolClient } from 'pg';
import { getClient, query } from '../lib/db.js';

let ensureTablesPromise: Promise<void> | null = null;

function toJson(value: unknown): unknown {
  if (value === undefined) return null;
  return value;
}

export function createAdminAuthorityId(prefix: 'audit' | 'approval' | 'version'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureAdminAuthorityTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
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
  }

  return ensureTablesPromise;
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
