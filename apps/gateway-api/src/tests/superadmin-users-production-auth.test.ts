import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRows = Array.from({ length: 121 }, (_, index) => ({
  id: `user-${index + 1}`,
  email: `user${index + 1}@example.test`,
  username: `user_${index + 1}`,
  full_name: `User ${index + 1}`,
  name: `User ${index + 1}`,
  phone: null,
  phone_number: null,
  role: index < 4 ? "superadmin" : "public",
  status: "active",
  created_at: new Date(Date.UTC(2026, 7, 16, 0, 0, index % 60)).toISOString(),
  last_login: null,
}));

vi.mock("../lib/db.js", () => ({
  query: vi.fn(async (sql: string) => {
    if (sql.includes("FROM users")) {
      return { rows: mockRows, rowCount: mockRows.length };
    }
    throw new Error(`UNEXPECTED_SQL:${sql}`);
  }),
}));

describe("superadmin users production auth", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "superadmin-users-production-auth-regression-secret";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwtSecret;
    vi.clearAllMocks();
  });

  async function buildApp() {
    const { registerAuthHook, signAccessToken } = await import("../auth/auth-middleware.js");
    const { registerSuperadminUsersRoutes } = await import("../routes/superadmin-users.js");
    const app = Fastify();
    registerAuthHook(app);
    await registerSuperadminUsersRoutes(app);
    await app.ready();
    return { app, signAccessToken };
  }

  it("rejects x-watany-role without JWT in production", async () => {
    const { app } = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/superadmin/users",
        headers: { "x-watany-role": "SUPERADMIN" },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: "SUPERADMIN_REQUIRED" });
    } finally {
      await app.close();
    }
  });

  it("accepts a production superadmin JWT and returns all 121 production-proven users", async () => {
    const { app, signAccessToken } = await buildApp();
    try {
      const token = signAccessToken({
        sub: "prod-superadmin-test",
        role: "superadmin",
        email: "superadmin@example.test",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/superadmin/users",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload.totalUsers).toBe(121);
      expect(payload.users).toHaveLength(121);
      expect(payload.users.filter((u: { roles: string[] }) => u.roles.includes("SUPERADMIN"))).toHaveLength(4);
      expect(payload.users.filter((u: { roles: string[] }) => u.roles.includes("USER"))).toHaveLength(117);
    } finally {
      await app.close();
    }
  });
});