import { query } from '../lib/db.js';
import { createAdminAuthorityId, createAdminEntityVersionRow, ensureAdminAuthorityTables } from './adminAuthorityStore.js';

export type AdminEntityVersion = {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  snapshot: unknown;
  createdBy: string;
  createdAt: string;
  reason?: string;
};

export async function createAdminEntityVersion(input: Omit<AdminEntityVersion, 'id' | 'version' | 'createdAt'>): Promise<AdminEntityVersion> {
  const id = createAdminAuthorityId('version');
  const created = await createAdminEntityVersionRow({
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    snapshot: input.snapshot,
    createdBy: input.createdBy,
    reason: input.reason,
  });

  const item: AdminEntityVersion = {
    id,
    version: created.version,
    createdAt: created.createdAt,
    ...input,
  };
  return item;
}

export async function listAdminEntityVersions(entityType: string, entityId: string): Promise<AdminEntityVersion[]> {
  await ensureAdminAuthorityTables();
  const res = await query<{
    id: string;
    entity_type: string;
    entity_id: string;
    version: number;
    snapshot: unknown;
    created_by: string;
    created_at: string;
    reason: string | null;
  }>(
    `
    SELECT id, entity_type, entity_id, version, snapshot, created_by, created_at, reason
    FROM admin_entity_versions
    WHERE entity_type = $1 AND entity_id = $2
    ORDER BY version DESC
    `,
    [entityType, entityId],
  );

  return res.rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    version: Number(row.version),
    snapshot: row.snapshot,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    reason: row.reason ?? undefined,
  }));
}
