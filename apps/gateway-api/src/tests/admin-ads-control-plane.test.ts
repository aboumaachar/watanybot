import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { copyFile, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { query } from "../lib/db.js";
import { signAccessToken } from "../auth/auth-middleware.js";
import { ensureAdminAuthorityTables } from "../admin-authority/adminAuthorityStore.js";

vi.mock("../lib/db.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/db.js")>();
  return { ...actual, query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("SELECT id, email, role FROM users WHERE id = $1 AND status = 'active'")) {
      const id = String(params[0]); const role = id.endsWith("-superadmin") ? "superadmin" : "admin";
      return { rows: [{ id, email: `${role}@ads-canary.test`, role }], rowCount: 1 };
    }
    if (sql.includes("SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > now()")) return { rows: [{ id: String(params[0]) }], rowCount: 1 };
    return actual.query(sql, params);
  }) };
});

const runId = `APEX-ADS-CANARY-${Date.now()}`;
const storePath = path.resolve(process.cwd(), "runtime", "ads-control.json");
const backupPath = `${storePath}.${runId}.backup`;
let original: string | null = null;
let appPromise: Promise<typeof import("../server").default> | null = null;

async function getApp() {
  process.env.JWT_SECRET ||= "test-jwt-secret-for-ads-canary-0123456789";
  process.env.DISABLE_PLUGIN_DB ||= "true";
  process.env.DISABLE_KB_NODES ||= "true";
  process.env.DISABLE_CHAT_PERSIST ||= "true";
  appPromise ||= import("../server").then((mod) => mod.default);
  return appPromise;
}
function auth(role: "admin" | "superadmin") { return { authorization: `Bearer ${signAccessToken({ sub: `${runId}-${role}`, role, email: `${role}@ads-canary.test`, sid: `${runId}-${role}-session` })}` }; }

beforeAll(async () => { original = existsSync(storePath) ? await readFile(storePath, "utf8") : null; if (original !== null) await copyFile(storePath, backupPath); await ensureAdminAuthorityTables(); await query("DELETE FROM admin_audit_events WHERE actor_id LIKE $1", [`${runId}%`]); await getApp(); }, 60000);
afterAll(async () => { if (original === null) { try { await unlink(storePath); } catch { /* no prior store */ } } else await writeFile(storePath, original, "utf8"); try { await unlink(backupPath); } catch { /* no backup when store was absent */ } await query("DELETE FROM admin_audit_events WHERE actor_id LIKE $1", [`${runId}%`]); if (appPromise) (await appPromise).close(); }, 60000);

describe("Ads Gateway control plane", () => {
  it("enforces roles and proves reversible provider and placement controls", async () => {
    const app = await getApp();
    expect((await app.inject({ method: "GET", url: "/api/admin/ads/status" })).statusCode).toBe(401);
    expect((await app.inject({ method: "PUT", url: "/api/admin/ads/provider", headers: auth("admin"), payload: { name: "Canary provider", accountId: "denied" } })).statusCode).toBe(403);
    const provider = await app.inject({ method: "PUT", url: "/api/admin/ads/provider", headers: auth("superadmin"), payload: { name: "Canary provider", accountId: `${runId}-account` } });
    expect(provider.statusCode).toBe(200);
    const created = await app.inject({ method: "POST", url: "/api/admin/ads/placements", headers: auth("superadmin"), payload: { name: runId, routePattern: "/canary", format: "house", priority: 1, creative: "Canary creative" } });
    expect(created.statusCode).toBe(201);
    const placement = (await created.json() as { placement: { id: string; enabled: boolean } }).placement;
    expect(placement.enabled).toBe(true);
    const disabled = await app.inject({ method: "PATCH", url: `/api/admin/ads/placements/${placement.id}`, headers: auth("superadmin"), payload: { name: runId, routePattern: "/canary", format: "house", priority: 1, enabled: false } });
    expect(disabled.statusCode).toBe(200);
    const preview = await app.inject({ method: "GET", url: `/api/admin/ads/placements/${placement.id}/preview`, headers: auth("admin") });
    expect(preview.statusCode).toBe(200); expect((await preview.json() as { preview: { enabled: boolean } }).preview.enabled).toBe(false);
    const adsTxt = await app.inject({ method: "GET", url: "/api/admin/ads/ads-txt", headers: auth("admin") });
    expect(adsTxt.statusCode).toBe(200); expect((await adsTxt.json() as { line: string }).line).toContain("google.com");
    const auditRows = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_audit_events WHERE actor_id LIKE $1 AND event_type LIKE 'ads.%'", [`${runId}%`]);
    expect(Number(auditRows.rows[0]?.count || 0)).toBe(3);
  });
});
