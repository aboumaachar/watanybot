/**
 * Scoped cleanup of community audit events for community test suites.
 *
 * admin_audit_events is shared: news, CMS, superadmin and other suites write
 * to it concurrently. Community code (community/service.ts) only ever writes
 * rows whose entity_type starts with "community_" (community_message,
 * community_report, community_appeal, community_group_membership,
 * community_group_invitation), so community suites delete exactly those rows
 * and never TRUNCATE the table. Call it while holding the community DB test
 * lock, alongside resetCommunityStore().
 */
import { query } from "../../lib/db";
import { assertDisposableTestDatabase } from "./disposable-db";

export const COMMUNITY_AUDIT_ENTITY_PREFIX = "community_";

export async function deleteCommunityAuditEvents(): Promise<number> {
  assertDisposableTestDatabase();
  const result = await query(
    "DELETE FROM admin_audit_events WHERE starts_with(entity_type, $1)",
    [COMMUNITY_AUDIT_ENTITY_PREFIX],
  );
  return result.rowCount ?? 0;
}
