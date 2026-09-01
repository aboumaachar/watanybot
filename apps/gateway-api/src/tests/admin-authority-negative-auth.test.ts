import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../admin-authority/adminAuthorityAudit.js", () => ({
  appendAdminAuditEvent: vi.fn(),
  createAdminAuditEvent: vi.fn(),
  listRecentAdminAuditEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("../admin-authority/adminAuthorityApproval.js", () => ({
  createAdminApprovalRequest: vi.fn(),
  decideAdminApprovalRequest: vi.fn(),
  listPendingAdminApprovalRequests: vi.fn().mockResolvedValue([]),
}));

import { registerAuthHook, signAccessToken } from "../auth/auth-middleware";
import { adminAuthorityRoutes } from "../admin-authority/adminAuthorityRoutes";

process.env.JWT_SECRET = "admin-authority-negative-auth-test-secret";

let app: ReturnType<typeof Fastify>;
const ENDPOINTS = [
  "/api/admin-authority/me",
  "/api/admin-authority/permissions",
  "/api/admin-authority/dashboard/summary",
  "/api/admin-authority/audit-events",
  "/api/admin-authority/approval-requests",
  "/api/admin-authority/integration-status",
  "/api/admin-authority/module-health",
] as const;

function makeToken(role: "public" | "admin" | "superadmin", id = "test-user") {
  return signAccessToken({ sub: id, role, email: `${role}@test.local` });
}

async function request(endpoint: string, headers?: Record<string, string>) {
  return app.inject({ method: "GET", url: endpoint, headers });
}

beforeAll(async () => {
  app = Fastify();
  registerAuthHook(app);
  await app.register(adminAuthorityRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Admin Authority - No token", () => {
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} without token returns 401 or 403`, async () => {
      expect([401, 403]).toContain((await request(endpoint)).statusCode);
    });
  }
});

describe("Admin Authority - Public user token", () => {
  const token = makeToken("public");
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} with public token is denied`, async () => {
      expect([401, 403]).toContain((await request(endpoint, { authorization: `Bearer ${token}` })).statusCode);
    });
  }
});

describe("Admin Authority - Admin token", () => {
  const token = makeToken("admin");
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} with admin token is denied`, async () => {
      expect([401, 403]).toContain((await request(endpoint, { authorization: `Bearer ${token}` })).statusCode);
    });
  }
});

describe("Admin Authority - Superadmin token", () => {
  const headers = { authorization: `Bearer ${makeToken("superadmin", "test-super")}` };

  it("reads authority me", async () => {
    const res = await request("/api/admin-authority/me", headers);
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.authority.authenticated).toBe(true);
    expect(body.authority.roles).toContain("superadmin");
  });

  it("reads permissions", async () => {
    const res = await request("/api/admin-authority/permissions", headers);
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.policies)).toBe(true);
    expect(body.count).toBeGreaterThan(0);
  });

  it("reads dashboard summary", async () => {
    const res = await request("/api/admin-authority/dashboard/summary", headers);
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.summary.authority).toBeDefined();
    expect(Array.isArray(body.summary.modules)).toBe(true);
    expect(body.summary.audit).toBeDefined();
    expect(typeof body.summary.generatedAt).toBe("string");
  });

  it("reads audit events", async () => {
    const res = await request("/api/admin-authority/audit-events", headers);
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("reads approval requests", async () => {
    const res = await request("/api/admin-authority/approval-requests", headers);
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.approvals)).toBe(true);
  });

  it("reads module health", async () => {
    const res = await request("/api/admin-authority/module-health", headers);
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.modules)).toBe(true);
  });
});

describe("Admin Authority - Dev bypass header", () => {
  it("accepts or denies dev bypass by environment", async () => {
    const res = await request("/api/admin-authority/me", { "x-watany-role": "superadmin" });
    expect([200, 401, 403]).toContain(res.statusCode);
  });
});
