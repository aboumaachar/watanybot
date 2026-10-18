import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closePool, query } from "../../lib/db.js";
import { ensureAdminAuthorityTables } from "../../admin-authority/adminAuthorityStore.js";

vi.mock("../../procedures/indexer.js", () => ({
  loadIndex: vi.fn().mockResolvedValue({ procedures: [{ id: "PROC-DB-1" }] }),
}));
import { registerFaqCmsRoutes } from "./faqs-cms-adapter.js";

const dbName = "apex_r025_validation_20261008";
const root = "/api/admin/cms/faqs", superadmin = { "x-test-role": "superadmin" };
function assertIsolatedAuthority() {
  if (process.env.DB_NAME !== dbName || process.env.DB_PORT !== "5433" ||
    !["127.0.0.1", "localhost"].includes(process.env.DB_HOST || "") ||
    Boolean(process.env.DATABASE_URL)) {
    throw new Error("R025_INTEGRATION_TARGET_NOT_ISOLATED");
  }
}
async function appFactory() {
  const app = Fastify();
  app.addHook("onRequest", async (req) => {
    const role = req.headers["x-test-role"];
    if (role === "superadmin" || role === "admin") {
      (req as any).user = { id: "r025-isolated-admin", role, email: "fixture@invalid.example" };
    }
  });
  registerFaqCmsRoutes(app);
  await app.ready();
  return app;
}
function call(app: Awaited<ReturnType<typeof appFactory>>, method: "GET" | "POST" | "PATCH", suffix: string, payload?: unknown, headers: Record<string, string> = superadmin) {
  return app.inject({ method, url: root + suffix, headers, ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }) });
}
const answer = "هذه إجابة اختبار متكاملة تستند إلى إجراء رسمي موثق.";
describe.skipIf(process.env.DB_NAME !== dbName || process.env.DB_PORT !== "5433" || !["127.0.0.1", "localhost"].includes(process.env.DB_HOST || "") || Boolean(process.env.DATABASE_URL))("R025 real PostgreSQL FAQ editorial readback on a dedicated database only", () => {
  beforeAll(async () => {
    assertIsolatedAuthority();
    const who = await query<{ name: string; port: number; addr: string }>(
      "SELECT current_database() AS name, inet_server_port() AS port, inet_server_addr()::text AS addr",
    );
    expect(who.rows[0]?.name).toBe(dbName);
    expect(Number(who.rows[0]?.port)).toBe(5433);
    expect(who.rows[0]?.addr).toContain("127.0.0.1");
    await ensureAdminAuthorityTables();
  });
  afterAll(async () => { await closePool(); });

  it("enforces authentication and cannot bypass draft source approval", async () => {
    const app = await appFactory();
    expect((await call(app, "GET", "", undefined, {})).statusCode).toBe(401);
    expect((await call(app, "POST", "", { publicId: "FAQ-DB-ACTIVE", title: "سؤال الاختبار" }, { "x-test-role": "admin" })).statusCode).toBe(403);
    expect((await call(app, "POST", "", { publicId: "FAQ-DB-ACTIVE", title: "سؤال الاختبار", status: "PUBLISHED" })).statusCode).toBe(400);
    expect((await call(app, "POST", "", { publicId: "FAQ-DB-ACTIVE", title: "سؤال الاختبار", payload: { reviewStatus: "approved" } })).statusCode).toBe(400);
    await app.close();
  });

  it("persists draft, partial edit, reviewed approval, published ranking, audit and versions", async () => {
    const app = await appFactory();
    const created = await call(app, "POST", "", { publicId: "FAQ-DB-ACTIVE", title: "سؤال الاختبار", payload: { answer, category: "معاملات", tags: ["تقاعد"], sourceReferences: ["PROC-DB-1"] } });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().item.version).toBe("1");
    const edited = await call(app, "PATCH", "/FAQ-DB-ACTIVE", { expectedVersion: 1, payload: { tags: ["تقاعد", "وثائق"] } });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(edited.json().item.payload.answer).toBe(answer);
    expect(edited.json().item.payload.sourceReferences).toEqual(["PROC-DB-1"]);
    expect((await call(app, "POST", "/FAQ-DB-ACTIVE/actions/publish", { expectedVersion: 2 })).statusCode).toBe(409);
    const submitted = await call(app, "POST", "/FAQ-DB-ACTIVE/actions/submit-review", { expectedVersion: 2 });
    expect(submitted.statusCode, submitted.body).toBe(200);
    expect(submitted.json().item.status).toBe("REVIEW_READY");
    expect((await call(app, "POST", "/FAQ-DB-ACTIVE/actions/publish", { expectedVersion: 3 })).statusCode).toBe(409);
    const approved = await call(app, "POST", "/FAQ-DB-ACTIVE/actions/approve", { expectedVersion: 3 });
    expect(approved.statusCode, approved.body).toBe(200);
    expect(approved.json().item.payload.reviewStatus).toBe("approved");
    const published = await call(app, "POST", "/FAQ-DB-ACTIVE/actions/publish", { expectedVersion: 4 });
    expect(published.statusCode, published.body).toBe(200);
    expect(published.json().item.status).toBe("PUBLISHED");
    const ranked = await call(app, "PATCH", "/FAQ-DB-ACTIVE/ranking", { expectedVersion: 5, latestRank: 1, trendingRank: 2 });
    expect(ranked.statusCode, ranked.body).toBe(200);
    expect(ranked.json().item.version).toBe("6");
    const stale = await call(app, "PATCH", "/FAQ-DB-ACTIVE/ranking", { expectedVersion: 5, trendingRank: 3 });
    expect(stale.statusCode).toBe(409);
    const stored = await query<{ status: string; revision: number; payload: Record<string, unknown> }>(
      "SELECT status, revision, payload FROM cms_content_entities WHERE domain = 'faqs' AND public_id = 'FAQ-DB-ACTIVE'",
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].status).toBe("PUBLISHED");
    expect(stored.rows[0].revision).toBe(6);
    expect(stored.rows[0].payload.answer).toBe(answer);
    expect(stored.rows[0].payload.latestRank).toBe(1);
    expect(stored.rows[0].payload.trendingRank).toBe(2);
    const versions = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_entity_versions WHERE entity_type = 'cms.faqs' AND entity_id = 'FAQ-DB-ACTIVE'");
    const audit = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_audit_events WHERE entity_type = 'faq' AND entity_id = 'FAQ-DB-ACTIVE'");
    expect(Number(versions.rows[0].count)).toBe(6);
    expect(Number(audit.rows[0].count)).toBe(6);
    await app.close();
  });

  it("persists rejected review and prevents publishing the rejected draft", async () => {
    const app = await appFactory();
    const created = await call(app, "POST", "", { publicId: "FAQ-DB-REJECTED", title: "سؤال مرفوض", payload: { answer, sourceReferences: ["PROC-DB-1"] } });
    expect(created.statusCode, created.body).toBe(201);
    const review = await call(app, "POST", "/FAQ-DB-REJECTED/actions/submit-review", { expectedVersion: 1 });
    expect(review.statusCode, review.body).toBe(200);
    const rejected = await call(app, "POST", "/FAQ-DB-REJECTED/actions/reject", { expectedVersion: 2, reason: "Evidence incomplete for publication" });
    expect(rejected.statusCode, rejected.body).toBe(200);
    expect(rejected.json().item.status).toBe("DRAFT");
    expect((await call(app, "POST", "/FAQ-DB-REJECTED/actions/publish", { expectedVersion: 3 })).statusCode).toBe(409);
    const row = await query<{ status: string; revision: number }>("SELECT status, revision FROM cms_content_entities WHERE domain='faqs' AND public_id='FAQ-DB-REJECTED'");
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].status).toBe("DRAFT");
    expect(row.rows[0].revision).toBe(3);
    await app.close();
  });
});
