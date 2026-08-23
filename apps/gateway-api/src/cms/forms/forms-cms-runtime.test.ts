import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { signAccessToken } from "../../auth/auth-middleware.js";
import { query, closePool } from "../../lib/db.js";

const marker = `apex-c4-forms-acceptance-${Date.now()}`;
const syntheticActor = `superadmin-${marker}`;
let app: typeof import("../../server.js").app;

function token(role: "admin" | "superadmin", permissions: string[] = []) {
  return `Bearer ${signAccessToken({ sub: `${role}-${marker}`, role, email: `${role}@watany.test` })}`;
}

const headers = (authorization: string) => ({ authorization, "content-type": "application/json" });

async function cleanup(): Promise<void> {
  await query("DELETE FROM cms_content_relationships WHERE entity_id IN (SELECT id FROM cms_content_entities WHERE public_id = $1)", [marker]);
  await query("DELETE FROM cms_content_entities WHERE public_id = $1", [marker]);
  const auditTable = await query<{ relation: string | null }>("SELECT to_regclass('public.admin_audit_events') AS relation");
  if (auditTable.rows[0]?.relation) {
    await query("DELETE FROM admin_audit_events WHERE entity_type = $1 AND entity_id = $2 AND actor_id = $3", ["form", marker, syntheticActor]);
  }
  const versionTable = await query<{ relation: string | null }>("SELECT to_regclass('public.admin_entity_versions') AS relation");
  if (versionTable.rows[0]?.relation) {
    await query("DELETE FROM admin_entity_versions WHERE entity_type = $1 AND entity_id = $2 AND created_by = $3", ["cms.forms", marker, syntheticActor]);
  }
}

// APEX_C4_FORMS_FOCUSED_TEST_AUDIT_VERSION_RESIDUE_DEFECT: cleanup must remove this run's synthetic history.
async function assertZeroResidue(): Promise<void> {
  const residue = await query<{ entities: number; relationships: number }>(
    `SELECT
       (SELECT count(*)::int FROM cms_content_entities WHERE public_id = $1) AS entities,
       (SELECT count(*)::int FROM cms_content_relationships r JOIN cms_content_entities e ON e.id = r.entity_id WHERE e.public_id = $1) AS relationships`,
    [marker],
  );
  expect(residue.rows[0]).toEqual({ entities: 0, relationships: 0 });
  const auditTable = await query<{ relation: string | null }>("SELECT to_regclass('public.admin_audit_events') AS relation");
  if (auditTable.rows[0]?.relation) {
    const audit = await query<{ count: number }>("SELECT count(*)::int AS count FROM admin_audit_events WHERE entity_type = $1 AND entity_id = $2 AND actor_id = $3", ["form", marker, syntheticActor]);
    expect(audit.rows[0].count).toBe(0);
  }
  const versionTable = await query<{ relation: string | null }>("SELECT to_regclass('public.admin_entity_versions') AS relation");
  if (versionTable.rows[0]?.relation) {
    const versions = await query<{ count: number }>("SELECT count(*)::int AS count FROM admin_entity_versions WHERE entity_type = $1 AND entity_id = $2 AND created_by = $3", ["cms.forms", marker, syntheticActor]);
    expect(versions.rows[0].count).toBe(0);
  }
}

describe("Forms CMS focused runtime acceptance", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET ||= "forms-cms-focused-test-secret-0123456789";
    process.env.DISABLE_PLUGIN_DB = "true";
    process.env.DISABLE_KB_NODES = "true";
    process.env.DISABLE_CHAT_PERSIST = "true";
    app = (await import("../../server.js")).app;
    await cleanup();
  }, 60000);

  afterEach(async () => cleanup());
  afterAll(async () => {
    await cleanup();
    await app.close();
    await closePool();
  });

  it("proves real /inject route registration and anonymous unauthorized 401 denial", async () => {
    const response = await app.inject({ method: "GET", url: "/api/admin/cms/forms" });
    expect(response.statusCode).toBe(401);
  });

  it("proves registered-user and insufficient-admin forbidden 403 mutation denial", async () => {
    const ordinary = await app.inject({ method: "POST", url: "/api/admin/cms/forms", headers: headers(token("admin")), payload: { publicId: marker, title: "Denied" } });
    expect([401, 403]).toContain(ordinary.statusCode);
    const insufficient = await app.inject({ method: "POST", url: "/api/admin/cms/forms", headers: headers(token("admin", ["other.permission"])), payload: { publicId: marker, title: "Denied" } });
    expect([401, 403]).toContain(insufficient.statusCode);
  });

  it("proves authorized superadmin create, list/read, PATCH update, publish lifecycle, audit, version and cleanup", async () => {
    const authorization = token("superadmin");
    const create = await app.inject({ method: "POST", url: "/api/admin/cms/forms", headers: headers(authorization), payload: { publicId: marker, publicCode: `T-${marker}`, sourceId: `source-${marker}`, title: "Focused Forms canary", payload: { marker }, sourceMeta: { test: true } } });
    expect(create.statusCode).toBe(201);
    const created = create.json().item;
    expect(created.publicId).toBe(marker);
    expect(created.version).toBe("1");

    const listed = await app.inject({ method: "GET", url: `/api/admin/cms/forms?q=${marker}`, headers: { authorization } });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items.some((item: { publicId: string }) => item.publicId === marker)).toBe(true);

    const detail = await app.inject({ method: "GET", url: `/api/admin/cms/forms/${marker}`, headers: { authorization } });
    expect(detail.statusCode).toBe(200);
    const updated = await app.inject({ method: "PATCH", url: `/api/admin/cms/forms/${marker}`, headers: headers(authorization), payload: { title: "Focused Forms updated" } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().item.title).toBe("Focused Forms updated");

    const published = await app.inject({ method: "POST", url: `/api/admin/cms/forms/${marker}/actions/publish`, headers: { authorization } });
    expect(published.statusCode).toBe(200);
    expect(published.json().item.status).toBe("PUBLISHED");

    const audit = await app.inject({ method: "GET", url: `/api/admin/cms/forms/${marker}/audit`, headers: { authorization } });
    const version = await app.inject({ method: "GET", url: `/api/admin/cms/forms/${marker}/versions`, headers: { authorization } });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().events.length).toBeGreaterThan(0);
    expect(version.statusCode).toBe(200);
    expect(version.json().versions.length).toBeGreaterThan(0);

    await cleanup();
    await assertZeroResidue();
  });
});
