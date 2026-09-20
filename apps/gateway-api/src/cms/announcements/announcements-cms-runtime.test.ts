import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { signAccessToken } from "../../auth/auth-middleware.js";
import { closePool, query } from "../../lib/db.js";

const canaryId = `apex-c5-announcement-${Date.now()}`;
const secondCanaryId = `${canaryId}-second`;
const title = `Synthetic C5 ${canaryId}`;
const superadminUserId = randomUUID();
const adminUserId = randomUUID();
const superadminSessionId = randomUUID();
const adminSessionId = randomUUID();
let app: { ready: () => Promise<void>; close: () => Promise<void>; inject: (options: { method: string; url: string; headers?: Record<string, string>; payload?: string }) => Promise<{ statusCode: number; body: string }> };

function token(role: "admin" | "superadmin", id: string, sid: string): string {
  return signAccessToken({ sub: id, role, email: `${role}@apex-c5.local`, sid });
}

async function request(route: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const body = typeof init.body === "string" ? init.body : undefined;
  const response = await app.inject({ method: init.method || "GET", url: route, headers: (init.headers || {}) as Record<string, string>, payload: body });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

const headers = (tokenValue: string) => ({ Authorization: `Bearer ${tokenValue}`, "Content-Type": "application/json" });

async function setupAuth(): Promise<void> {
  await query("INSERT INTO users (id, email, username, role, status, name, full_name) VALUES ($1::uuid, $2, $3, 'superadmin', 'active', $4, $4), ($5::uuid, $6, $7, 'admin', 'active', $8, $8)", [superadminUserId, `c5-superadmin-${canaryId}@watany.test`, `c5-superadmin-${canaryId}`, "CMS Announcement Superadmin", adminUserId, `c5-admin-${canaryId}@watany.test`, `c5-admin-${canaryId}`, "CMS Announcement Admin"]);
  await query("INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1::uuid, $2::uuid, $3, now() + interval '1 hour'), ($4::uuid, $5::uuid, $6, now() + interval '1 hour')", [superadminSessionId, superadminUserId, `session-${superadminSessionId}`, adminSessionId, adminUserId, `session-${adminSessionId}`]);
}

async function cleanupAuth(): Promise<void> {
  await query("DELETE FROM sessions WHERE id = ANY($1::uuid[])", [[superadminSessionId, adminSessionId]]);
  await query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[superadminUserId, adminUserId]]);
}
async function cleanup(): Promise<void> {
  const ids = [canaryId, secondCanaryId];
  await query("DELETE FROM cms_content_relationships WHERE entity_id IN (SELECT id FROM cms_content_entities WHERE domain = $1 AND public_id = ANY($2::text[]))", ["announcements", ids]);
  await query("DELETE FROM cms_content_entities WHERE domain = $1 AND public_id = ANY($2::text[])", ["announcements", ids]);
  const auditTable = await query<{ relation: string | null }>("SELECT to_regclass('public.admin_audit_events') AS relation");
  if (auditTable.rows[0]?.relation) {
    await query("DELETE FROM admin_audit_events WHERE entity_type = $1 AND entity_id = ANY($2::text[]) AND actor_id = $3", ["announcement", ids, superadminUserId]);
  }
  const versionTable = await query<{ relation: string | null }>("SELECT to_regclass('public.admin_entity_versions') AS relation");
  if (versionTable.rows[0]?.relation) {
    await query("DELETE FROM admin_entity_versions WHERE entity_type = $1 AND entity_id = ANY($2::text[]) AND created_by = $3", ["cms.announcements", ids, superadminUserId]);
  }
}

async function assertZeroResidue(): Promise<void> {
  const residue = await query<{ entities: number; relationships: number }>(
    `SELECT
       (SELECT count(*)::int FROM cms_content_entities WHERE domain = $1 AND public_id = ANY($2::text[])) AS entities,
       (SELECT count(*)::int FROM cms_content_relationships r JOIN cms_content_entities e ON e.id = r.entity_id WHERE e.domain = $1 AND e.public_id = ANY($2::text[])) AS relationships`,
    ["announcements", [canaryId, secondCanaryId]],
  );
  expect(residue.rows[0]).toEqual({ entities: 0, relationships: 0 });
  const auditTable = await query<{ relation: string | null }>("SELECT to_regclass('public.admin_audit_events') AS relation");
  if (auditTable.rows[0]?.relation) {
    const audit = await query<{ count: number }>("SELECT count(*)::int AS count FROM admin_audit_events WHERE entity_type = $1 AND entity_id = ANY($2::text[]) AND actor_id = $3", ["announcement", [canaryId, secondCanaryId], superadminUserId]);
    expect(audit.rows[0].count).toBe(0);
  }
  const versionTable = await query<{ relation: string | null }>("SELECT to_regclass('public.admin_entity_versions') AS relation");
  if (versionTable.rows[0]?.relation) {
    const versions = await query<{ count: number }>("SELECT count(*)::int AS count FROM admin_entity_versions WHERE entity_type = $1 AND entity_id = ANY($2::text[]) AND created_by = $3", ["cms.announcements", [canaryId, secondCanaryId], superadminUserId]);
    expect(versions.rows[0].count).toBe(0);
  }
}

describe("C5 Announcements CMS runtime", () => {
  let superadmin = "";
  let admin = "";

  beforeAll(async () => {
    process.env.JWT_SECRET ||= "announcements-cms-focused-test-secret-0123456789";
    process.env.DISABLE_PLUGIN_DB = "true";
    process.env.DISABLE_KB_NODES = "true";
    process.env.DISABLE_CHAT_PERSIST = "true";
    await setupAuth();
    superadmin = token("superadmin", superadminUserId, superadminSessionId);
    admin = token("admin", adminUserId, adminSessionId);
    const server = await import("../../server.js");
    app = server.app as typeof app;
    await app.ready();
  }, 60000);

  afterAll(async () => {
    await cleanup();
    await cleanupAuth();
    if (app) await app.close();
    await closePool();
  });

  it("enforces RBAC and preserves identity across CMS lifecycle and public reflection", async () => {
    const anonymous = await request("/api/admin/cms/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicId: canaryId, title }) });
    const insufficient = await request("/api/admin/cms/announcements", { method: "POST", headers: headers(admin), body: JSON.stringify({ publicId: canaryId, title }) });
    expect([401, 403]).toContain(anonymous.status);
    expect([401, 403]).toContain(insufficient.status);

    const created = await request("/api/admin/cms/announcements", { method: "POST", headers: headers(superadmin), body: JSON.stringify({ publicId: canaryId, title, sourceId: `synthetic-${canaryId}`, payload: { summary: "Synthetic acceptance row" } }) });
    expect(created.status).toBe(201);
    expect(created.body.item.publicId).toBe(canaryId);

    const second = await request("/api/admin/cms/announcements", { method: "POST", headers: headers(superadmin), body: JSON.stringify({ publicId: secondCanaryId, title: `${title} second` }) });
    expect(second.status).toBe(201);
    const unauthorizedEdit = await request("/api/admin/cms/announcements/bulk-actions/edit", { method: "POST", headers: headers(admin), body: JSON.stringify({ ids: [canaryId, secondCanaryId], patch: { title: "Denied" } }) });
    expect([401, 403]).toContain(unauthorizedEdit.status);
    const forbiddenEdit = await request("/api/admin/cms/announcements/bulk-actions/edit", { method: "POST", headers: headers(superadmin), body: JSON.stringify({ ids: [canaryId, secondCanaryId], patch: { publicId: "forbidden" } }) });
    expect(forbiddenEdit.status).toBe(400);
    const invalidEdit = await request("/api/admin/cms/announcements/bulk-actions/edit", { method: "POST", headers: headers(superadmin), body: JSON.stringify({ ids: [canaryId, `${canaryId}-missing`], patch: { title: "No partial edit" } }) });
    expect(invalidEdit.status).toBe(404);
    const bulkEdit = await request("/api/admin/cms/announcements/bulk-actions/edit", { method: "POST", headers: headers(superadmin), body: JSON.stringify({ ids: [canaryId, secondCanaryId], patch: { title: "Bulk edited" } }) });
    expect(bulkEdit.status).toBe(200);
    expect(bulkEdit.body.items).toHaveLength(2);
    expect(bulkEdit.body.items.every((item: { title: string }) => item.title === "Bulk edited")).toBe(true);
    const unauthorizedBulk = await request("/api/admin/cms/announcements/bulk-actions/archive", { method: "POST", headers: headers(admin), body: JSON.stringify({ ids: [canaryId, secondCanaryId] }) });
    expect([401, 403]).toContain(unauthorizedBulk.status);
    const invalidBulk = await request("/api/admin/cms/announcements/bulk-actions/archive", { method: "POST", headers: headers(superadmin), body: JSON.stringify({ ids: [canaryId, `${canaryId}-missing`] }) });
    expect(invalidBulk.status).toBe(404);
    const bulk = await request("/api/admin/cms/announcements/bulk-actions/archive", { method: "POST", headers: headers(superadmin), body: JSON.stringify({ ids: [canaryId, secondCanaryId] }) });
    expect(bulk.status).toBe(200);
    expect(bulk.body.items).toHaveLength(2);

    const updated = await request(`/api/admin/cms/announcements/${canaryId}`, { method: "PATCH", headers: headers(superadmin), body: JSON.stringify({ title: `${title} updated` }) });
    expect(updated.status).toBe(200);
    expect(updated.body.item.publicId).toBe(canaryId);

    const published = await request(`/api/admin/cms/announcements/${canaryId}/actions/publish`, { method: "POST", headers: headers(superadmin) });
    expect(published.status).toBe(200);
    const publicRead = await request("/api/announcements");
    expect(publicRead.status).toBe(200);
    expect(publicRead.body.announcements.some((item: { id: string }) => item.id === canaryId)).toBe(true);

    const unpublished = await request(`/api/admin/cms/announcements/${canaryId}/actions/unpublish`, { method: "POST", headers: headers(superadmin) });
    expect(unpublished.status).toBe(200);
    const publicHidden = await request("/api/announcements");
    expect(publicHidden.body.announcements.some((item: { id: string }) => item.id === canaryId)).toBe(false);

    const archived = await request(`/api/admin/cms/announcements/${canaryId}/actions/archive`, { method: "POST", headers: headers(superadmin) });
    expect(archived.status).toBe(200);
    const versions = await request(`/api/admin/cms/announcements/${canaryId}/versions`, { headers: headers(superadmin) });
    const audit = await request(`/api/admin/cms/announcements/${canaryId}/audit`, { headers: headers(superadmin) });
    expect(versions.status).toBe(200);
    expect(versions.body.versions.length).toBeGreaterThanOrEqual(4);
    expect(audit.status).toBe(200);
    expect(audit.body.events.map((event: { eventType: string }) => event.eventType)).toEqual(expect.arrayContaining(["cms.announcements.created", "cms.announcements.updated", "cms.announcements.publish", "cms.announcements.unpublish", "cms.announcements.archive"]));
    await cleanup();
    await assertZeroResidue();
  });
});