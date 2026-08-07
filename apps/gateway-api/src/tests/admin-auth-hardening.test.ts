import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { signAccessToken, signRefreshToken } from "../auth/auth-middleware";

let appPromise: Promise<typeof import("../server").default> | null = null;
const originalNodeEnv = process.env.NODE_ENV;
const originalDevAdminFallback = process.env.ALLOW_DEV_ADMIN_FALLBACK;
const originalDisableAuth = process.env.DISABLE_AUTH;
const originalAuthBypassForTesting = process.env.AUTH_BYPASS_FOR_TESTING;

async function getApp() {
  process.env.JWT_SECRET ||= "test-jwt-secret-for-admin-hardening-0123456789";
  process.env.DISABLE_PLUGIN_DB ||= "true";
  process.env.DISABLE_KB_NODES ||= "true";
  process.env.DISABLE_CHAT_PERSIST ||= "true";
  appPromise ||= import("../server").then((mod) => mod.default);
  return appPromise;
}

function authHeader(role: "admin" | "superadmin") {
  return {
    authorization: `Bearer ${signAccessToken({
      sub: `${role}-test-user`,
      role,
      email: `${role}@watany.test`,
    })}`,
  };
}

function refreshSessionHeaders(refreshToken: string, csrfToken = "test-csrf-token") {
  return {
    cookie: `watany_refresh=${refreshToken}; watany_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    host: "localhost:4000",
  };
}

function publicRefreshSessionHeaders(refreshToken: string, csrfToken = "test-csrf-token") {
  return {
    cookie: `watany_refresh=${refreshToken}; watany_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
    host: "koudama.com",
  };
}

afterAll(async () => {
  if (appPromise !== null) {
    const fastifyApp = await appPromise;
    await fastifyApp.close();
  }
}, 30000);

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalDevAdminFallback === undefined) {
    delete process.env.ALLOW_DEV_ADMIN_FALLBACK;
  } else {
    process.env.ALLOW_DEV_ADMIN_FALLBACK = originalDevAdminFallback;
  }

  if (originalDisableAuth === undefined) {
    delete process.env.DISABLE_AUTH;
  } else {
    process.env.DISABLE_AUTH = originalDisableAuth;
  }

  if (originalAuthBypassForTesting === undefined) {
    delete process.env.AUTH_BYPASS_FOR_TESTING;
  } else {
    process.env.AUTH_BYPASS_FOR_TESTING = originalAuthBypassForTesting;
  }
});

beforeAll(async () => {
  await getApp();
}, 60000);

describe("admin auth hardening", () => {
  it("keeps feature flags readable without auth", async () => {
    const app = await getApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/features" });

    expect(response.statusCode).toBe(200);
  });

  it("blocks unauthenticated admin dashboard access", async () => {
    const app = await getApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/dashboard" });

    expect(response.statusCode).toBe(401);
  });

  it("blocks unauthenticated admin user management access", async () => {
    const app = await getApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/users" });

    expect(response.statusCode).toBe(401);
  });

  it("blocks unauthenticated admin audit access", async () => {
    const app = await getApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/audit" });

    expect(response.statusCode).toBe(401);
  });

  it("blocks unauthenticated hybrid KB admin status access", async () => {
    const app = await getApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/hybrid-kb-index/status" });

    expect(response.statusCode).toBe(401);
  });

  it("blocks unauthenticated civilian opportunities admin access", async () => {
    const app = await getApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/opportunities" });

    expect(response.statusCode).toBe(401);
  });

  it("blocks unauthenticated procedures admin access", async () => {
    const app = await getApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/procedures" });

    expect(response.statusCode).toBe(401);
  });

  it("blocks unauthenticated payments admin access when auth bypass env is unset", async () => {
    const app = await getApp();
    delete process.env.DISABLE_AUTH;
    delete process.env.AUTH_BYPASS_FOR_TESTING;

    const response = await app.inject({ method: "GET", url: "/api/admin/payments/questions" });

    expect(response.statusCode).toBe(401);
  });

  it("allows admin dashboard access with an admin token", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/dashboard",
      headers: authHeader("admin"),
    });

    expect(response.statusCode).toBe(200);
  });

  it("allows admin user management access with an admin token", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: authHeader("admin"),
    });

    expect(response.statusCode).toBe(200);
  });

  it("allows hybrid KB admin status access with an admin token", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/hybrid-kb-index/status",
      headers: authHeader("admin"),
    });

    expect(response.statusCode).toBe(200);
  });

  it("allows civilian opportunities admin access with an admin token", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/opportunities",
      headers: authHeader("admin"),
    });

    expect(response.statusCode).toBe(200);
  });

  it("blocks admin tokens from procedures admin access", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/procedures",
      headers: authHeader("admin"),
    });

    expect(response.statusCode).toBe(403);
  });

  it("allows superadmin tokens to read procedures admin list", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/procedures",
      headers: authHeader("superadmin"),
    });

    expect(response.statusCode).toBe(200);
  }, 60000);

  it("blocks admin tokens from superadmin-only procedures diagnostics", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/procedures/diagnostics",
      headers: authHeader("admin"),
    });

    expect(response.statusCode).toBe(403);
  });

  it("allows superadmin tokens to read procedures diagnostics", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/procedures/diagnostics",
      headers: authHeader("superadmin"),
    });

    expect(response.statusCode).toBe(200);
  }, 60000);

  it("rejects body-supplied refresh tokens", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: signRefreshToken({ sub: "superadmin-test-user" }) },
    });

    expect(response.statusCode).toBe(401);
  });

  it("requires the explicit local dev fallback flag before refreshing dev admin sessions", async () => {
    const app = await getApp();
    const refreshToken = signRefreshToken({ sub: "00000000-0000-0000-0000-000000000001" });

    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_DEV_ADMIN_FALLBACK;

    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: refreshSessionHeaders(refreshToken),
    });

    expect(blocked.statusCode).toBe(401);

    process.env.ALLOW_DEV_ADMIN_FALLBACK = "true";

    const allowed = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: refreshSessionHeaders(refreshToken),
    });

    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual(expect.objectContaining({
      accessToken: expect.any(String),
      expiresIn: 86400,
    }));
    expect(allowed.json()).not.toHaveProperty("refreshToken");
  });

  it("blocks dev admin fallback outside development mode", async () => {
    const app = await getApp();
    const refreshToken = signRefreshToken({ sub: "00000000-0000-0000-0000-000000000001" });

    process.env.NODE_ENV = "staging";
    process.env.ALLOW_DEV_ADMIN_FALLBACK = "true";

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: refreshSessionHeaders(refreshToken),
    });

    expect(response.statusCode).toBe(401);
  });

  it("blocks dev admin fallback on a public host even when the socket ip is local", async () => {
    const app = await getApp();
    const refreshToken = signRefreshToken({ sub: "00000000-0000-0000-0000-000000000001" });

    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_ADMIN_FALLBACK = "true";

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: publicRefreshSessionHeaders(refreshToken),
    });

    expect(response.statusCode).toBe(401);
  });
});