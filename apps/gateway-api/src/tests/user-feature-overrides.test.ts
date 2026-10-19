import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/db.js", () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));
vi.mock("../lib/feature-flags.js", () => ({
  getFeatureFlagsPayload: vi.fn(async () => ({
    flags: { salary: true, jobs: false, profile: true },
    lastUpdatedAt: "2026-09-21T10:00:00.000Z",
  })),
}));
vi.mock("../ws/features-ws.js", () => ({
  broadcastFeatureFlagsUpdate: vi.fn(async () => undefined),
}));

import { getClient, query } from "../lib/db.js";
import { broadcastFeatureFlagsUpdate } from "../ws/features-ws.js";
import { adminFeaturesRoutes } from "../routes/admin-features.js";
import { adminUsersManagementRoutes } from "../routes/admin-users-management.js";

const userId = "11111111-1111-4111-8111-111111111111";
const queryMock = vi.mocked(query);
const getClientMock = vi.mocked(getClient);
const broadcastMock = vi.mocked(broadcastFeatureFlagsUpdate);
async function buildApp() {
  const app = Fastify();
  app.decorateRequest("user", undefined);
  app.addHook("onRequest", async (request) => {
    request.user = { id: userId, email: "admin@example.com", role: "superadmin" };
  });
  await app.register(adminFeaturesRoutes);
  await app.register(adminUsersManagementRoutes);
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockResolvedValue({ rows: [], rowCount: 0 } as any);
});

describe("per-user feature overrides", () => {
  it("merges authenticated overrides into the effective feature payload", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ feature_id: "salary", enabled: false, updated_at: "2026-09-21T11:00:00.000Z" }],
      rowCount: 1,
    } as any);
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/api/features" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ scope: "user", flags: { salary: false, jobs: false, profile: true } });
    await app.close();
  });
  it("persists audited superadmin overrides and broadcasts invalidation", async () => {
    const clientQuery = vi.fn(async (text: string) => {
      if (text.includes("SELECT id FROM users")) return { rows: [{ id: userId }], rowCount: 1 };
      if (text.includes("user_feature_overrides") && text.includes("FOR UPDATE")) return { rows: [], rowCount: 0 };
      if (text.includes("SELECT feature_id, enabled FROM user_feature_overrides")) {
        return { rows: [{ feature_id: "salary", enabled: false }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${userId}/features`,
      payload: { overrides: { salary: false, profile: null } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, invalidationBroadcasted: true });
    expect(broadcastMock).toHaveBeenCalledTimes(1);
    const auditCall = clientQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO audit_log"));
    expect(auditCall).toBeDefined();
    expect(auditCall?.[1]?.[1]).toBe("user.features_update");
    expect(auditCall?.[1]?.[3]).toMatchObject({ targetUserId: userId });
    await app.close();
  });

  it("rejects disabling a feature that is not disableable", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/users/${userId}/features`,
      payload: { overrides: { profile: false } },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "FEATURE_CANNOT_BE_DISABLED", featureId: "profile" });
    expect(getClientMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("applies a bulk feature override and broadcasts invalidation", async () => {
    const clientQuery = vi.fn(async (text: string) => {
      if (text.includes("WHERE id = ANY($1::uuid[])")) {
        return { rows: [{ id: userId, email: "user@example.com", name: "User", role: "public", status: "active" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/users/bulk",
      payload: { ids: [userId], action: "feature", featureId: "salary", featureOverride: false, dryRun: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ result: { action: "feature", featureId: "salary", featureOverride: false, invalidationBroadcasted: true } });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO user_feature_overrides"))).toBe(true);
    expect(broadcastMock).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("blocks deleting the authenticated superadmin account", async () => {
    const clientQuery = vi.fn(async (text: string) => {
      if (text.includes("FROM users WHERE id = $1 FOR UPDATE")) return { rows: [{ id: userId, email: "admin@example.com", name: "Admin", role: "superadmin", status: "active" }], rowCount: 1 };
      if (text.includes("status = 'active' AND role IN")) return { rows: [{ id: userId }, { id: "22222222-2222-4222-8222-222222222222" }], rowCount: 2 };
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({ method: "DELETE", url: `/api/admin/users/${userId}`, payload: { confirmation: "admin@example.com" } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "CANNOT_DELETE_OWN_ACCOUNT" });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("DELETE FROM users"))).toBe(false);
    await app.close();
  });

  it("deletes another account only after exact confirmation and writes retained audit evidence", async () => {
    const targetId = "33333333-3333-4333-8333-333333333333";
    const clientQuery = vi.fn(async (text: string) => {
      if (text.includes("FROM users WHERE id = $1 FOR UPDATE")) return { rows: [{ id: targetId, email: "user@example.com", name: "User", role: "public", status: "active" }], rowCount: 1 };
      if (text.includes("status = 'active' AND role IN")) return { rows: [{ id: userId }], rowCount: 1 };
      if (text.includes("SELECT\n           (SELECT COUNT")) return { rows: [{ sessions: 1, login_events: 2, feature_overrides: 1 }], rowCount: 1 };
      if (text.startsWith("DELETE FROM users")) return { rows: [{ id: targetId }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({ method: "DELETE", url: `/api/admin/users/${targetId}`, payload: { confirmation: "user@example.com" } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, deletedUserId: targetId, dependencyPolicy: "database_fk_rules" });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes("FROM notifications WHERE user_id"))).toBe(false);
    const auditCall = clientQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO audit_log"));
    expect(auditCall?.[1]?.[1]).toBe("user.delete");
    expect(auditCall?.[1]?.[3]).toMatchObject({ targetUserId: targetId, deletedUser: { email: "user@example.com" } });
    await app.close();
  });

  it("requires explicit confirmation before applying bulk delete", async () => {
    const targetId = "44444444-4444-4444-8444-444444444444";
    const clientQuery = vi.fn(async (text: string) => {
      if (text.includes("WHERE id = ANY($1::uuid[])")) return { rows: [{ id: targetId, email: "bulk@example.com", name: "Bulk", role: "public", status: "active" }], rowCount: 1 };
      if (text.includes("status = 'active' AND role IN")) return { rows: [{ id: userId }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({ method: "POST", url: "/api/admin/users/bulk", payload: { ids: [targetId], action: "delete", dryRun: false } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "BULK_DELETE_CONFIRMATION_REQUIRED" });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("DELETE FROM users"))).toBe(false);
    await app.close();
  });

  it("applies confirmed bulk delete and writes per-user audit evidence", async () => {
    const targetId = "55555555-5555-4555-8555-555555555555";
    const clientQuery = vi.fn(async (text: string) => {
      if (text.includes("WHERE id = ANY($1::uuid[])")) return { rows: [{ id: targetId, email: "bulk-ok@example.com", name: "Bulk OK", role: "public", status: "active" }], rowCount: 1 };
      if (text.includes("status = 'active' AND role IN")) return { rows: [{ id: userId }], rowCount: 1 };
      if (text.startsWith("DELETE FROM users")) return { rows: [{ id: targetId }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({ method: "POST", url: "/api/admin/users/bulk", payload: { ids: [targetId], action: "delete", confirmDelete: true, dryRun: false } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ result: { action: "delete", requested: 1, affected: 1 } });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("DELETE FROM users"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql, params]) => String(sql).includes("INSERT INTO audit_log") && params?.[1] === "user.bulk.delete")).toBe(true);
    await app.close();
  });

  it("returns a conflict instead of an internal error when the database blocks deletion", async () => {
    const targetId = "66666666-6666-4666-8666-666666666666";
    const clientQuery = vi.fn(async (text: string) => {
      if (text.includes("FROM users WHERE id = $1 FOR UPDATE")) return { rows: [{ id: targetId, email: "fk@example.com", name: "FK", role: "public", status: "active" }], rowCount: 1 };
      if (text.includes("status = 'active' AND role IN")) return { rows: [{ id: userId }], rowCount: 1 };
      if (text.startsWith("DELETE FROM users")) throw Object.assign(new Error("foreign key violation"), { code: "23503" });
      return { rows: [], rowCount: 1 };
    });
    getClientMock.mockResolvedValue({ query: clientQuery, release: vi.fn() } as any);
    const app = await buildApp();
    const response = await app.inject({ method: "DELETE", url: "/api/admin/users/" + targetId, payload: { confirmation: "fk@example.com" } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "USER_DELETE_REFERENTIAL_CONFLICT" });
    await app.close();
  });
});
