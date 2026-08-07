import { query } from '../lib/db.js';
import { createAdminAuthorityId, ensureAdminAuthorityTables } from './adminAuthorityStore.js';

export type AdminApprovalRequest = {
  id: string;
  actionType: string;
  requestedBy: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
};

export async function createAdminApprovalRequest(input: Omit<AdminApprovalRequest, 'id' | 'status' | 'createdAt' | 'decidedAt' | 'decidedBy' | 'decisionNote'>): Promise<AdminApprovalRequest> {
  await ensureAdminAuthorityTables();
  const item: AdminApprovalRequest = {
    id: createAdminAuthorityId('approval'),
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...input,
  };

  const inserted = await query<{ created_at: string }>(
    `
    INSERT INTO admin_approval_requests (
      id,
      action_type,
      requested_by,
      entity_type,
      entity_id,
      reason,
      status,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
    RETURNING created_at
    `,
    [
      item.id,
      item.actionType,
      item.requestedBy,
      item.entityType,
      item.entityId ?? null,
      item.reason ?? null,
      item.status,
      item.createdAt,
    ],
  );

  item.createdAt = new Date(inserted.rows[0]?.created_at || item.createdAt).toISOString();
  return item;
}

export async function listPendingAdminApprovalRequests(limit = 50, actionTypePrefix?: string): Promise<AdminApprovalRequest[]> {
  await ensureAdminAuthorityTables();
  const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200);
  const hasPrefix = Boolean(String(actionTypePrefix || '').trim());
  const sql = hasPrefix
    ? `
      SELECT id, action_type, requested_by, entity_type, entity_id, reason, status, created_at, decided_at, decided_by, decision_note
      FROM admin_approval_requests
      WHERE status = 'pending' AND action_type LIKE $2
      ORDER BY created_at DESC
      LIMIT $1
    `
    : `
      SELECT id, action_type, requested_by, entity_type, entity_id, reason, status, created_at, decided_at, decided_by, decision_note
      FROM admin_approval_requests
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT $1
    `;

  const params = hasPrefix ? [safeLimit, `${String(actionTypePrefix).trim()}%`] : [safeLimit];
  const res = await query<{
    id: string;
    action_type: string;
    requested_by: string;
    entity_type: string;
    entity_id: string | null;
    reason: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    created_at: string;
    decided_at: string | null;
    decided_by: string | null;
    decision_note: string | null;
  }>(sql, params);

  return res.rows.map((row) => ({
    id: row.id,
    actionType: row.action_type,
    requestedBy: row.requested_by,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    reason: row.reason ?? undefined,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : undefined,
    decidedBy: row.decided_by ?? undefined,
    decisionNote: row.decision_note ?? undefined,
  }));
}

export async function decideAdminApprovalRequest(input: {
  approvalId: string;
  actorId: string;
  decision: 'approved' | 'rejected' | 'cancelled';
  decisionNote?: string;
}): Promise<AdminApprovalRequest | null> {
  await ensureAdminAuthorityTables();

  const updated = await query<{
    id: string;
    action_type: string;
    requested_by: string;
    entity_type: string;
    entity_id: string | null;
    reason: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    created_at: string;
    decided_at: string | null;
    decided_by: string | null;
    decision_note: string | null;
  }>(
    `
    UPDATE admin_approval_requests
    SET
      status = $2,
      decided_at = NOW(),
      decided_by = $3,
      decision_note = $4
    WHERE id = $1 AND status = 'pending'
    RETURNING id, action_type, requested_by, entity_type, entity_id, reason, status, created_at, decided_at, decided_by, decision_note
    `,
    [
      input.approvalId,
      input.decision,
      input.actorId,
      input.decisionNote ?? null,
    ],
  );

  const row = updated.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    actionType: row.action_type,
    requestedBy: row.requested_by,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    reason: row.reason ?? undefined,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : undefined,
    decidedBy: row.decided_by ?? undefined,
    decisionNote: row.decision_note ?? undefined,
  };
}
