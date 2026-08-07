import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.stubGlobal("fetch", fetchMock);
vi.mock("../lib/db.js", () => ({ query: vi.fn() }));

const { query } = await import("../lib/db.js") as { query: Mock };
const { authRoutes } = await import("../auth/auth-routes");
const { registerAuthHook } = await import("../auth/auth-middleware");

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(cookie);
  registerAuthHook(app);
  app.register(authRoutes);
  return app;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-jwt-secret-for-google-auth-0123456789";
  process.env.GOOGLE_CLIENT_ID = "google-client-id-123";
  vi.clearAllMocks();
  query.mockReset();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/google", () => {
  it("returns 503 when Google auth is not configured on the server", async () => {
    process.env.GOOGLE_CLIENT_ID = "";

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      payload: { credential: "google-id-token" },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "تسجيل الدخول عبر Google غير مهيأ حالياً" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("logs in an existing user with a verified Google credential", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      aud: "google-client-id-123",
      email: "veteran@example.com",
      email_verified: "true",
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      iss: "https://accounts.google.com",
      name: "Veteran User",
      sub: "google-sub-1",
    }));

    query
      .mockResolvedValueOnce({
        rows: [{
          id: "user-1",
          email: "veteran@example.com",
          full_name: "Veteran User",
          role: "public",
          status: "active",
          username: "veteran_user",
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      payload: { credential: "google-id-token", rememberMe: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.objectContaining({
      accessToken: expect.any(String),
      expiresIn: 86400,
      user: expect.objectContaining({
        id: "user-1",
        email: "veteran@example.com",
        fullName: "Veteran User",
      }),
    }));
    expect(fetchMock).toHaveBeenCalledWith("https://oauth2.googleapis.com/tokeninfo?id_token=google-id-token");
    expect(res.headers["set-cookie"]).toBeTruthy();
  });

  it("creates a local user for a new verified Google account", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      aud: "google-client-id-123",
      email: "newuser@example.com",
      email_verified: true,
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      iss: "accounts.google.com",
      name: "New User",
      sub: "google-sub-2",
    }));

    query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [{
          id: "user-2",
          email: "newuser@example.com",
          full_name: "New User",
          role: "public",
          status: "active",
          username: "u_generated",
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      payload: { credential: "new-google-token" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.objectContaining({
      user: expect.objectContaining({
        id: "user-2",
        email: "newuser@example.com",
        fullName: "New User",
      }),
    }));
    expect(query.mock.calls[1]?.[0]).toContain("INSERT INTO public.users");
  });

  it("rejects an invalid Google credential", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      aud: "wrong-client-id",
      email: "veteran@example.com",
      email_verified: "true",
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      iss: "https://accounts.google.com",
      sub: "google-sub-3",
    }));

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      payload: { credential: "bad-google-token" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "تعذر التحقق من حساب Google" });
    expect(query).not.toHaveBeenCalled();
  });

  it("returns 503 instead of 500 when the database is unavailable", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      aud: "google-client-id-123",
      email: "veteran@example.com",
      email_verified: "true",
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      iss: "https://accounts.google.com",
      name: "Veteran User",
      sub: "google-sub-4",
    }));

    query.mockRejectedValueOnce({ code: "ECONNREFUSED", message: "connect ECONNREFUSED 127.0.0.1:5432" });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      payload: { credential: "google-id-token" },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "خدمة تسجيل الدخول غير متاحة حالياً" });
  });

  it("returns 503 when Postgres password authentication fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      aud: "google-client-id-123",
      email: "veteran@example.com",
      email_verified: "true",
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      iss: "https://accounts.google.com",
      name: "Veteran User",
      sub: "google-sub-5",
    }));

    query.mockRejectedValueOnce({ code: "28P01", message: "password authentication failed for user \"watanybot\"" });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/google",
      payload: { credential: "google-id-token" },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "خدمة تسجيل الدخول غير متاحة حالياً" });
  });
});