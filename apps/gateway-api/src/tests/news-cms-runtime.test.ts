import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import os from "node:os";
import path from "node:path";
import { closePool } from "../lib/db.js";

process.env.NODE_ENV = "test";
const usePersistentDb = process.env.C6_NEWS_USE_PERSISTENT_DB === "1";
process.env.DISABLE_PLUGIN_DB = usePersistentDb ? "false" : "true";
process.env.PLUGIN_DB_PATH = process.env.C6_NEWS_PLUGIN_DB_PATH || path.join(os.tmpdir(), `watany-c6-news-${process.pid}.sqlite`);
process.env.USE_PYTHON_API = "false";
process.env.USE_KB_STUB = "true";

const jwt = (await import("jsonwebtoken")).default;
const secret = process.env.JWT_SECRET || "apex-cms-runtime-acceptance-local-secret-2026";
const canaryId = `apex-c6-news-${Date.now()}`;
const title = `Synthetic C6 News ${canaryId}`;
let app: FastifyInstance;
let activeId = "";

function token(role: string, id: string): string {
  return jwt.sign({ sub: id, role, email: `${role}@apex-c6.local` }, secret, { expiresIn: 3600 });
}

async function request(route: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<{ status: number; body: any }> {
  const response = await app.inject({
    method: init.method || "GET",
    url: route,
    headers: init.headers,
    payload: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

const headers = (value: string) => ({ Authorization: `Bearer ${value}`, "Content-Type": "application/json" });

describe("C6 News CMS runtime", () => {
  const superadmin = token("superadmin", "apex-c6-news-superadmin");
  const admin = token("admin", "apex-c6-news-admin");
  let externalFetch: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    const server = await import("../server.js");
    app = server.app;
    await app.ready();
    app.pluginDb.prepare("DELETE FROM news_items WHERE id = ?").run(canaryId);
    externalFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("upstream unavailable", { status: 503 }));
  }, 30000);

  afterAll(async () => {
    app.pluginDb.prepare("DELETE FROM news_items WHERE id = ?").run(activeId || canaryId);
    if (app.pluginDb.prepare("SELECT * FROM news_items WHERE id = ?").get(activeId || canaryId)) {
      throw new Error("C6_NEWS_CANARY_RESIDUE");
    }
    externalFetch.mockRestore();
    await app.close();
    await closePool();
  });

  it("proves RBAC, lifecycle, public reflection, audit, versions, rollback, and cleanup", async () => {
    const anonymous = await request("/admin/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: { title } });
    const insufficient = await request("/admin/news", { method: "POST", headers: headers(admin), body: { title } });
    expect(anonymous.status).toBe(401);
    expect(insufficient.status).toBe(403);

    const created = await request("/admin/news", { method: "POST", headers: headers(superadmin), body: { title, category: "c6-canary", body: "Synthetic News CMS row", status: "DRAFT" } });
    expect(created.status).toBe(201);
    activeId = created.body.id;
    expect(activeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.body.status).toBe("DRAFT");

    const listed = await request("/admin/news", { headers: headers(superadmin) });
    expect(listed.status).toBe(200);
    expect(listed.body.some((item: { id: string }) => item.id === activeId)).toBe(true);

    const updated = await request(`/admin/news/${activeId}`, { method: "PATCH", headers: headers(superadmin), body: { title: `${title} updated` } });
    expect(updated.status).toBe(200);
    expect(updated.body.id).toBe(activeId);

    const published = await request(`/admin/news/${activeId}/actions/publish`, { method: "POST", headers: headers(superadmin) });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("PUBLISHED");
    const publicRead = await request("/api/news?limit=100");
    expect(publicRead.status).toBe(200);
    expect(publicRead.body.some((item: { id: string }) => item.id === activeId)).toBe(true);

    const unpublished = await request(`/admin/news/${activeId}/actions/unpublish`, { method: "POST", headers: headers(superadmin) });
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.status).toBe("UNPUBLISHED");
    const publicHidden = await request("/api/news?limit=100");
    expect(publicHidden.body.some((item: { id: string }) => item.id === activeId)).toBe(false);

    const archived = await request(`/admin/news/${activeId}/actions/archive`, { method: "POST", headers: headers(superadmin) });
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe("ARCHIVED");

    const versions = await request(`/admin/news/${activeId}/versions`, { headers: headers(superadmin) });
    expect(versions.status).toBe(200);
    expect(versions.body.versions.length).toBeGreaterThanOrEqual(5);
    const rollback = await request(`/admin/news/${activeId}/actions/rollback`, { method: "POST", headers: headers(superadmin), body: { version: 3 } });
    expect(rollback.status).toBe(200);
    expect(rollback.body.id).toBe(activeId);
    expect(rollback.body.status).toBe("PUBLISHED");
    const publicAfterRollback = await request("/api/news?limit=100");
    expect(publicAfterRollback.body.some((item: { id: string }) => item.id === activeId)).toBe(true);

    const audit = await request(`/admin/news/${activeId}/audit`, { headers: headers(superadmin) });
    expect(audit.status).toBe(200);
    expect(audit.body.events.map((event: { eventType: string }) => event.eventType)).toEqual(expect.arrayContaining([
      "cms.news.created",
      "cms.news.updated",
      "cms.news.publish",
      "cms.news.unpublish",
      "cms.news.archive",
      "cms.news.rollback",
    ]));
  });
});