import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closePool, query } from "../../lib/db.js";

vi.mock("../../procedures/indexer.js", () => ({
  loadIndex: vi.fn().mockResolvedValue({ procedures: [{ id: "PROC-DB-1" }] }),
}));
import { registerFaqCmsRoutes } from "./faqs-cms-adapter.js";

const dbName = "apex_r025_validation_20261008";
const base = "/api/admin/cms/faqs", headers = { "x-test-role": "superadmin" };
const answer = "هذه إجابة اختبار واضحة ومدعومة بمصدر رسمي.";
const targetIsIsolated = process.env.DB_NAME === dbName && process.env.DB_PORT === "5433"
  && ["127.0.0.1", "localhost"].includes(process.env.DB_HOST || "")
  && !process.env.DATABASE_URL;
const unique = (suffix: string) => "FAQ-ATOMIC-" + suffix + "-" + randomUUID().slice(0, 8);

async function getApp() {
  const app = Fastify({ logger: false });
  app.addHook("onRequest", async (request) => {
    if (request.headers["x-test-role"] === "superadmin") {
      (request as any).user = { id: "apex-r025-fixture", role: "superadmin", email: "fixture@invalid.example" };
    }
  });
  registerFaqCmsRoutes(app);
  await app.ready();
  return app;
}
type App = Awaited<ReturnType<typeof getApp>>;
async function send(app: App, method: "POST" | "PATCH" | "GET", url: string, payload?: unknown) {
  return app.inject({ method, url: base + url, headers,
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }) });
}
const make = (id: string) => ({ publicId: id, title: "سؤال الاختبار المعزول", payload: { answer, sourceReferences: ["PROC-DB-1"] } });
async function counts(id: string) {
  const result = await query<{ content: string; versions: string; audits: string; revision: number | null; status: string | null }>(
    `SELECT
       (SELECT COUNT(*)::text FROM cms_content_entities WHERE domain='faqs' AND public_id=$1) AS content,
       (SELECT COUNT(*)::text FROM admin_entity_versions WHERE entity_type='cms.faqs' AND entity_id=$1) AS versions,
       (SELECT COUNT(*)::text FROM admin_audit_events WHERE entity_type='faq' AND entity_id=$1) AS audits,
       (SELECT revision FROM cms_content_entities WHERE domain='faqs' AND public_id=$1) AS revision,
       (SELECT status FROM cms_content_entities WHERE domain='faqs' AND public_id=$1) AS status`,
    [id],
  );
  const r = result.rows[0];
  return { content: Number(r.content), versions: Number(r.versions), audits: Number(r.audits),
    revision: r.revision === null ? null : Number(r.revision), status: r.status };
}
async function installFailureTrigger(table: "admin_audit_events" | "admin_entity_versions", id: string, eventType?: string) {
  // User input never reaches this test-only DDL; UUID suffix is strictly validated.
  if (!/^FAQ-ATOMIC-[A-Z]+-[a-f0-9-]{8}$/.test(id)) throw new Error("UNSAFE_TEST_FIXTURE_ID");
  const triggerName = table === "admin_audit_events" ? "r025_atomic_audit_inject" : "r025_atomic_version_inject";
  const functionName = triggerName + "_fn";
  await query(`CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
    BEGIN
      IF NEW.entity_id = '${id}'${eventType ? ` AND NEW.event_type = '${eventType}'` : ""} THEN
        RAISE EXCEPTION 'R025_FORCED_TRANSACTION_FAILURE';
      END IF;
      RETURN NEW;
    END;
  $$ LANGUAGE plpgsql`);
  await query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON ${table}
    FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
  return async () => {
    await query(`DROP TRIGGER IF EXISTS ${triggerName} ON ${table}`);
    await query(`DROP FUNCTION IF EXISTS ${functionName}()`);
  };
}

describe.skipIf(!targetIsIsolated)("R025 transactional FAQ CMS all-or-nothing PostgreSQL validation", () => {
  beforeAll(async () => {
    const identity = await query<{ database: string; port: number; addr: string }>(
      "SELECT current_database() AS database, inet_server_port() AS port, inet_server_addr()::text AS addr",
    );
    expect(identity.rows[0]?.database).toBe(dbName);
    expect(Number(identity.rows[0]?.port)).toBe(5433);
    expect(identity.rows[0]?.addr).toContain("127.0.0.1");
  });
  afterAll(async () => { await closePool(); });

  it("commits the complete draft-to-approved-to-ranked publication with identical audit/version counts", async () => {
    const id = unique("PASS"), app = await getApp();
    try {
      const created = await send(app, "POST", "", make(id));
      expect(created.statusCode, created.body).toBe(201);
      expect((await send(app, "POST", `/${id}/actions/submit-review`, { expectedVersion: 1 })).statusCode).toBe(200);
      expect((await send(app, "POST", `/${id}/actions/approve`, { expectedVersion: 2 })).statusCode).toBe(200);
      expect((await send(app, "POST", `/${id}/actions/publish`, { expectedVersion: 3 })).statusCode).toBe(200);
      expect((await send(app, "PATCH", `/${id}/ranking`, { expectedVersion: 4, latestRank: 4, trendingRank: 5 })).statusCode).toBe(200);
      expect(await counts(id)).toEqual({ content: 1, versions: 5, audits: 5, revision: 5, status: "PUBLISHED" });
      const stale = await send(app, "PATCH", `/${id}/ranking`, { expectedVersion: 4, latestRank: 7 });
      expect(stale.statusCode).toBe(409);
      expect(await counts(id)).toEqual({ content: 1, versions: 5, audits: 5, revision: 5, status: "PUBLISHED" });
    } finally { await app.close(); }
  });

  it("rolls back a new FAQ row and version if audit insertion is forced to fail", async () => {
    const id = unique("AUDIT"), app = await getApp();
    const drop = await installFailureTrigger("admin_audit_events", id);
    try {
      const attempted = await send(app, "POST", "", make(id));
      expect(attempted.statusCode).toBe(500);
      expect(await counts(id)).toEqual({ content: 0, versions: 0, audits: 0, revision: null, status: null });
    } finally { await drop(); await app.close(); }
  });

  it("rolls back a new FAQ row if version insertion is forced to fail", async () => {
    const id = unique("VERSION"), app = await getApp();
    const drop = await installFailureTrigger("admin_entity_versions", id);
    try {
      const attempted = await send(app, "POST", "", make(id));
      expect(attempted.statusCode).toBe(500);
      expect(await counts(id)).toEqual({ content: 0, versions: 0, audits: 0, revision: null, status: null });
    } finally { await drop(); await app.close(); }
  });

  it("does not publish an approved item if its publish audit insert fails", async () => {
    const id = unique("PUBLISH"), app = await getApp();
    try {
      expect((await send(app, "POST", "", make(id))).statusCode).toBe(201);
      expect((await send(app, "POST", `/${id}/actions/submit-review`, { expectedVersion: 1 })).statusCode).toBe(200);
      expect((await send(app, "POST", `/${id}/actions/approve`, { expectedVersion: 2 })).statusCode).toBe(200);
      const initial = await counts(id);
      expect(initial).toEqual({ content: 1, versions: 3, audits: 3, revision: 3, status: "REVIEW_READY" });
      const drop = await installFailureTrigger("admin_audit_events", id, "cms.faqs.published");
      try {
        const attempted = await send(app, "POST", `/${id}/actions/publish`, { expectedVersion: 3 });
        expect(attempted.statusCode).toBe(500);
        expect(await counts(id)).toEqual(initial);
      } finally { await drop(); }
      expect((await send(app, "POST", `/${id}/actions/publish`, { expectedVersion: 3 })).statusCode).toBe(200);
      expect(await counts(id)).toEqual({ content: 1, versions: 4, audits: 4, revision: 4, status: "PUBLISHED" });
    } finally { await app.close(); }
  });
});
