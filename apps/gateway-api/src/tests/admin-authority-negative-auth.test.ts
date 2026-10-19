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
import { cleanupSessionUsers, createSessionToken } from "./helpers/session-auth";

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

// Admin paths resolve the principal from the database (active user + live session + sid),
// so role tokens below are session-backed; makeToken() is kept only to prove bare JWTs are anonymous.
const sessionTokens: Record<"public" | "admin" | "superadmin", string> = { public: "", admin: "", superadmin: "" };
const bearer = (role: keyof typeof sessionTokens) => ({ authorization: `Bearer ${sessionTokens[role]}` });

async function request(endpoint: string, headers?: Record<string, string>) {
  return app.inject({ method: "GET", url: endpoint, headers });
}

beforeAll(async () => {
  app = Fastify();
  registerAuthHook(app);
  await app.register(adminAuthorityRoutes, { prefix: "/api" });
  await app.ready();
  for (const role of ["public", "admin", "superadmin"] as const) sessionTokens[role] = await createSessionToken(role);
}, 60000);

afterAll(async () => {
  await cleanupSessionUsers();
  await app.close();
});

describe("Admin Authority - No token", () => {
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} without token returns 401 or 403`, async () => {
      expect([401, 403]).toContain((await request(endpoint)).statusCode);
    });
  }
});

describe("Admin Authority - Bare JWT without session", () => {
  const token = makeToken("superadmin", "test-super");
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} with a bare superadmin JWT (no sid/session) is anonymous`, async () => {
      expect((await request(endpoint, { authorization: `Bearer ${token}` })).statusCode).toBe(401);
    });
  }
});

describe("Admin Authority - Public user token", () => {
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} with public session token is forbidden`, async () => {
      expect((await request(endpoint, bearer("public"))).statusCode).toBe(403);
    });
  }
});

describe("Admin Authority - Admin token", () => {
  for (const endpoint of ENDPOINTS) {
    it(`GET ${endpoint} with admin session token is forbidden`, async () => {
      expect((await request(endpoint, bearer("admin"))).statusCode).toBe(403);
    });
  }
});

describe("Admin Authority - Superadmin token", () => {
  const headers = () => bearer("superadmin");

  it("reads authority me", async () => {
    const res = await request("/api/admin-authority/me", headers());
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.authority.authenticated).toBe(true);
    expect(body.authority.roles).toContain("superadmin");
  });

  it("reads permissions", async () => {
    const res = await request("/api/admin-authority/permissions", headers());
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.policies)).toBe(true);
    expect(body.count).toBeGreaterThan(0);
  });

  it("reads dashboard summary", async () => {
    const res = await request("/api/admin-authority/dashboard/summary", headers());
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.summary.authority).toBeDefined();
    expect(Array.isArray(body.summary.modules)).toBe(true);
    expect(body.summary.audit).toBeDefined();
    expect(typeof body.summary.generatedAt).toBe("string");
  });

  it("reads audit events", async () => {
    const res = await request("/api/admin-authority/audit-events", headers());
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("reads approval requests", async () => {
    const res = await request("/api/admin-authority/approval-requests", headers());
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.approvals)).toBe(true);
  });

  it("reads module health", async () => {
    const res = await request("/api/admin-authority/module-health", headers());
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.modules)).toBe(true);
  });
});

describe("Admin Authority - Dev role header is opt-in only", () => {
  it("ignores x-watany-role without WATANY_ALLOW_DEV_ROLE_HEADER", async () => {
    const previous = process.env.WATANY_ALLOW_DEV_ROLE_HEADER;
    delete process.env.WATANY_ALLOW_DEV_ROLE_HEADER;
    try {
      expect((await request("/api/admin-authority/me", { "x-watany-role": "superadmin" })).statusCode).toBe(401);
    } finally {
      if (previous !== undefined) process.env.WATANY_ALLOW_DEV_ROLE_HEADER = previous;
    }
  });

  it("honours x-watany-role in test mode only when explicitly opted in", async () => {
    const previous = process.env.WATANY_ALLOW_DEV_ROLE_HEADER;
    process.env.WATANY_ALLOW_DEV_ROLE_HEADER = "true";
    try {
      expect((await request("/api/admin-authority/me", { "x-watany-role": "superadmin" })).statusCode).toBe(200);
    } finally {
      if (previous === undefined) delete process.env.WATANY_ALLOW_DEV_ROLE_HEADER; else process.env.WATANY_ALLOW_DEV_ROLE_HEADER = previous;
    }
  });
});
