/**
 * Community test cleanup must not delete other suites' audit events.
 *
 * Regression for community-routes.test.ts running `TRUNCATE admin_audit_events`
 * in beforeEach, which wiped news CMS audit events written concurrently by
 * news-cms-runtime.test.ts. Needs a disposable test database (DATABASE_URL);
 * skipped when it is not set, fails closed when it is not disposable.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "../lib/db";
import { acquireCommunityDbTestLock, COMMUNITY_DB_TEST_LOCK_WAIT_MS } from "./community-db-test-lock";
import { deleteCommunityAuditEvents } from "./helpers/community-audit-cleanup";
import { assertDisposableTestDatabase } from "./helpers/disposable-db";

const hasDb = Boolean(process.env.DATABASE_URL);
const tag = `audit-isolation-${randomUUID().slice(0, 8)}`;
const rows = {
  news: { id: `${tag}-news`, entityType: "cms.news", eventType: "cms.news.created" },
  superadmin: { id: `${tag}-feature`, entityType: "feature_controls", eventType: "superadmin.feature.updated" },
  lookalike: { id: `${tag}-lookalike`, entityType: "community", eventType: "other.event" },
  community: { id: `${tag}-community`, entityType: "community_message", eventType: "community.message.deleted" },
};

async function insertAuditRow(row: { id: string; entityType: string; eventType: string }) {
  await query(
    "INSERT INTO admin_audit_events (id, event_type, actor_id, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)",
    [row.id, row.eventType, `${tag}-actor`, row.entityType, `${tag}-entity`],
  );
}

async function existingIds(): Promise<string[]> {
  const res = await query<{ id: string }>("SELECT id FROM admin_audit_events WHERE id = ANY($1::text[]) ORDER BY id", [Object.values(rows).map((r) => r.id)]);
  return res.rows.map((r) => r.id);
}

describe.skipIf(!hasDb)("community audit cleanup isolation", () => {
  let release: null | (() => Promise<void>) = null;

  // Take the community lock before the test (waiting here, not in the test's
  // 5s budget) so no community suite's cleanup runs while ours is checked.
  beforeAll(async () => {
    assertDisposableTestDatabase();
    release = await acquireCommunityDbTestLock();
  }, COMMUNITY_DB_TEST_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      await query("DELETE FROM admin_audit_events WHERE id = ANY($1::text[])", [Object.values(rows).map((r) => r.id)]);
      expect(await existingIds()).toEqual([]);
    } finally {
      if (release) { await release(); release = null; }
    }
  });

  it("removes only community_* audit rows and keeps other suites' rows", async () => {
    for (const row of Object.values(rows)) await insertAuditRow(row);
    await deleteCommunityAuditEvents();
    const remaining = await existingIds();
    expect(remaining).toContain(rows.news.id);
    expect(remaining).toContain(rows.superadmin.id);
    expect(remaining).toContain(rows.lookalike.id); // "community" without the underscore is not community-owned
    expect(remaining).not.toContain(rows.community.id);
  });
});
