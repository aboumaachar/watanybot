import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query } from '../lib/db.js';
import { createAdminAuthorityId, ensureAdminAuthorityTables } from './adminAuthorityStore.js';

export type AdminAuditEvent = {
  id: string;
  eventType: string;
  actorId: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  approvalId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  immutableHash?: string;
};

function buildAuditImmutableHash(input: Omit<AdminAuditEvent, 'id' | 'createdAt' | 'immutableHash'>, createdAtIso: string): string {
  const canonical = JSON.stringify({
    ...input,
    createdAt: createdAtIso,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function createAdminAuditEvent(input: Omit<AdminAuditEvent, 'id' | 'createdAt'>): AdminAuditEvent {
  const now = new Date().toISOString();
  const immutableHash = input.immutableHash || buildAuditImmutableHash(input, now);
  return {
    id: createAdminAuthorityId('audit'),
    createdAt: now,
    immutableHash,
    ...input,
  };
}

export async function appendAdminAuditEvent(event: AdminAuditEvent): Promise<AdminAuditEvent> {
  await ensureAdminAuthorityTables();
  const inserted = await query<{ created_at: string }>(
    `
    INSERT INTO admin_audit_events (
      id,
      event_type,
      actor_id,
      entity_type,
      entity_id,
      before_state,
      after_state,
      reason,
      approval_id,
      request_id,
      ip,
      user_agent,
      immutable_hash,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::jsonb,
      $7::jsonb,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14::timestamptz
    )
    RETURNING created_at
    `,
    [
      event.id,
      event.eventType,
      event.actorId,
      event.entityType,
      event.entityId ?? null,
      JSON.stringify(event.before ?? null),
      JSON.stringify(event.after ?? null),
      event.reason ?? null,
      event.approvalId ?? null,
      event.requestId ?? null,
      event.ip ?? null,
      event.userAgent ?? null,
      event.immutableHash ?? null,
      event.createdAt,
    ],
  );

  event.createdAt = new Date(inserted.rows[0]?.created_at || event.createdAt).toISOString();
  return event;
}

export async function appendAdminAuditEventInTransaction(client: PoolClient, event: AdminAuditEvent): Promise<AdminAuditEvent> {
  const inserted = await client.query<{ created_at: string }>(
    `INSERT INTO admin_audit_events (id, event_type, actor_id, entity_type, entity_id, before_state, after_state, reason, approval_id, request_id, ip, user_agent, immutable_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14::timestamptz) RETURNING created_at`,
    [event.id, event.eventType, event.actorId, event.entityType, event.entityId ?? null, JSON.stringify(event.before ?? null), JSON.stringify(event.after ?? null), event.reason ?? null, event.approvalId ?? null, event.requestId ?? null, event.ip ?? null, event.userAgent ?? null, event.immutableHash ?? null, event.createdAt],
  );
  event.createdAt = new Date(inserted.rows[0]?.created_at || event.createdAt).toISOString();
  return event;
}

export async function listRecentAdminAuditEvents(limit = 50): Promise<AdminAuditEvent[]> {
  await ensureAdminAuthorityTables();
  const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200);
  const res = await query<{
    id: string;
    event_type: string;
    actor_id: string;
    entity_type: string;
    entity_id: string | null;
    before_state: unknown;
    after_state: unknown;
    reason: string | null;
    approval_id: string | null;
    request_id: string | null;
    ip: string | null;
    user_agent: string | null;
    created_at: string;
    immutable_hash: string | null;
  }>(
    `
    SELECT
      id,
      event_type,
      actor_id,
      entity_type,
      entity_id,
      before_state,
      after_state,
      reason,
      approval_id,
      request_id,
      ip,
      user_agent,
      created_at,
      immutable_hash
    FROM admin_audit_events
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit],
  );

  return res.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    actorId: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    before: row.before_state ?? undefined,
    after: row.after_state ?? undefined,
    reason: row.reason ?? undefined,
    approvalId: row.approval_id ?? undefined,
    requestId: row.request_id ?? undefined,
    ip: row.ip ?? undefined,
    userAgent: row.user_agent ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    immutableHash: row.immutable_hash ?? undefined,
  }));
}
