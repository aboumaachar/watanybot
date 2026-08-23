import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { closePool, query } from "../../lib/db.js";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as { sign: (payload: object, secret: string, options: object) => string };
const secret = process.env.JWT_SECRET || "apex-cms-runtime-acceptance-local-secret-2026";
const canaryId = `apex-c5-announcement-${Date.now()}`;
const title = `Synthetic C5 ${canaryId}`;
let app: { ready: () => Promise<void>; close: () => Promise<void>; inject: (options: { method: string; url: string; headers?: Record<string, string>; payload?: string }) => Promise<{ statusCode: number; body: string }> };

function token(role: string, id: string): string {
  return jwt.sign({ sub: id, role, email: `${role}@apex-c5.local` }, secret, { expiresIn: 3600 });
}

async function request(route: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const body = typeof init.body === "string" ? init.body : undefined;
  const response = await app.inject({ method: init.method || "GET", url: route, headers: (init.headers || {}) as Record<string, string>, payload: body });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

const headers = (tokenValue: string) => ({ Authorization: `Bearer ${tokenValue}`, "Content-Type": "application/json" });

describe("C5 Announcements CMS runtime", () => {
  const superadmin = token("superadmin", "apex-c5-superadmin");
  const admin = token("admin", "apex-c5-admin");

  beforeAll(async () => {
    const server = await import("../../server.js");
    app = server.app as typeof app;
    await app.ready();
  }, 30000);

  afterAll(async () => {
    await query("DELETE FROM cms_content_entities WHERE domain = $1 AND public_id = $2", ["announcements", canaryId]);
    await app.close();
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

    const updated = await request(`/api/admin/cms/announcements/${canaryId}`, { method: "PATCH", headers: headers(superadmin), body: JSON.stringify({ title: `${title} updated` }) });
    expect(updated.status).toBe(200);
    expect(updated.body.item.publicId).toBe(canaryId);

    const published = await request(`/api/admin/cms/announcements/${canaryId}/actions/publish`, { method: "POST", headers: headers(superadmin) });
    expect(published.status).toBe(200);
    const publicRead = await request("/announcements");
    expect(publicRead.status).toBe(200);
    expect(publicRead.body.announcements.some((item: { id: string }) => item.id === canaryId)).toBe(true);

    const unpublished = await request(`/api/admin/cms/announcements/${canaryId}/actions/unpublish`, { method: "POST", headers: headers(superadmin) });
    expect(unpublished.status).toBe(200);
    const publicHidden = await request("/announcements");
    expect(publicHidden.body.announcements.some((item: { id: string }) => item.id === canaryId)).toBe(false);

    const archived = await request(`/api/admin/cms/announcements/${canaryId}/actions/archive`, { method: "POST", headers: headers(superadmin) });
    expect(archived.status).toBe(200);
    const versions = await request(`/api/admin/cms/announcements/${canaryId}/versions`, { headers: headers(superadmin) });
    const audit = await request(`/api/admin/cms/announcements/${canaryId}/audit`, { headers: headers(superadmin) });
    expect(versions.status).toBe(200);
    expect(versions.body.versions.length).toBeGreaterThanOrEqual(4);
    expect(audit.status).toBe(200);
    expect(audit.body.events.map((event: { eventType: string }) => event.eventType)).toEqual(expect.arrayContaining(["cms.announcements.created", "cms.announcements.updated", "cms.announcements.publish", "cms.announcements.unpublish", "cms.announcements.archive"]));
  });
});