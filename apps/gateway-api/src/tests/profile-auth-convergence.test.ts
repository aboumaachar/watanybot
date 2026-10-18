import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/db.js", () => ({ query: vi.fn() }));

import { query } from "../lib/db.js";
import { profileRoutes } from "../routes/profile";
import { requireAuth } from "../lib/helpers";

const queryMock = vi.mocked(query);
const forbiddenLegacyTokens = ["Veteran User", "abouyasine", "بوفراعة"];

async function makeProfileApp(user?: { id: string; role: string; email: string }) {
  const app = Fastify();
  if (user) {
    app.addHook("onRequest", async (request) => {
      (request as any).user = user;
    });
  }
  await app.register(profileRoutes, { pluginDb: {} as any });
  await app.ready();
  return app;
}

afterEach(() => {
  queryMock.mockReset();
  vi.restoreAllMocks();
});

describe("legacy profile compatibility security", () => {
  it("blocks unauthenticated GET without exposing shared profile data", async () => {
    const app = await makeProfileApp();
    const res = await app.inject({ method: "GET", url: "/api/profile" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "AUTH_REQUIRED" });
    for (const token of forbiddenLegacyTokens) expect(res.body).not.toContain(token);
    expect(queryMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("retires pseudo-login and blocks unauthenticated PATCH", async () => {
    const app = await makeProfileApp();
    const login = await app.inject({ method: "POST", url: "/api/profile/login", payload: { name: "x" } });
    const patch = await app.inject({ method: "PATCH", url: "/api/profile", payload: { region: "x" } });
    expect(login.statusCode).toBe(410);
    expect(login.json()).toEqual({ error: "LEGACY_PROFILE_API_DEPRECATED", replacement: "/api/auth/login" });
    expect(patch.statusCode).toBe(401);
    expect(patch.json()).toEqual({ error: "AUTH_REQUIRED" });
    await app.close();
  });

  it("keeps legacy logout side-effect-free and guest-shaped", async () => {
    const app = await makeProfileApp();
    const res = await app.inject({ method: "POST", url: "/api/profile/logout" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ profile: { isAuthed: false, role: "public" } });
    expect(queryMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("reads the authenticated user from the canonical users table", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: "u1", email: "u@example.test", full_name: "User One", name: null,
        phone_number: "+9613000000", phone: null, role: "accredited",
        region: "Beirut", note: "note", last_login: "2026-10-03T12:00:00.000Z",
      }],
      rowCount: 1,
    } as any);
    const app = await makeProfileApp({ id: "u1", role: "accredited", email: "u@example.test" });
    const res = await app.inject({ method: "GET", url: "/api/profile" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ profile: expect.objectContaining({
      isAuthed: true,
      role: "accredited",
      name: "User One",
      phone: "+9613000000",
      email: "u@example.test",
      region: "Beirut",
      note: "note",
    }) });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("FROM users WHERE id = $1"), ["u1"]);
    await app.close();
  });

  it("rejects privilege, auth-state, and phone mutation through the legacy surface", async () => {
    const app = await makeProfileApp({ id: "u1", role: "accredited", email: "u@example.test" });
    const res = await app.inject({ method: "PATCH", url: "/api/profile", payload: { role: "superadmin" } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "LEGACY_PROFILE_FIELD_NOT_WRITABLE" });
    expect(queryMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("persists benign fields for the authenticated user and tolerates the unchanged email", async () => {
    const current = {
      id: "u1", email: "u@example.test", full_name: "User One", name: null,
      phone_number: "+9613000000", phone: null, role: "accredited",
      region: "Old", note: "old", last_login: null,
    };
    const updated = { ...current, region: "New Region", note: "new note" };
    queryMock
      .mockResolvedValueOnce({ rows: [current], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [updated], rowCount: 1 } as any);
    const app = await makeProfileApp({ id: "u1", role: "accredited", email: "u@example.test" });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profile",
      payload: { email: "u@example.test", region: "New Region", note: "new note" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ profile: expect.objectContaining({
      isAuthed: true,
      email: "u@example.test",
      region: "New Region",
      note: "new note",
    }) });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1]?.[1]).toEqual(["u1", null, "New Region", "new note"]);
    await app.close();
  });

  it("rejects a changed email without a dedicated re-authentication flow", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: "u1", email: "u@example.test", role: "accredited" }], rowCount: 1 } as any);
    const app = await makeProfileApp({ id: "u1", role: "accredited", email: "u@example.test" });
    const res = await app.inject({ method: "PATCH", url: "/api/profile", payload: { email: "other@example.test" } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "EMAIL_CHANGE_REQUIRES_REAUTH" });
    expect(queryMock).toHaveBeenCalledTimes(1);
    await app.close();
  });
});

describe("shared requireAuth authority", () => {
  it("never consults the legacy profile row for an unauthenticated request", () => {
    const prepare = vi.fn(() => { throw new Error("legacy profile read attempted"); });
    const reply = { request: { headers: {}, user: undefined }, code: vi.fn(function code() { return this; }) } as any;
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(requireAuth({ prepare } as any, reply, "accredited")).toBeNull();
      expect(reply.code).toHaveBeenCalledWith(401);
      expect(prepare).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("allows anonymous access only when the required role is public", () => {
    const prepare = vi.fn(() => { throw new Error("legacy profile read attempted"); });
    const reply = { request: { headers: {}, user: undefined }, code: vi.fn(function code() { return this; }) } as any;
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(requireAuth({ prepare } as any, reply, "public")).toBe("public");
      expect(reply.code).not.toHaveBeenCalled();
      expect(prepare).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("accepts a JWT principal with sufficient role", () => {
    const prepare = vi.fn(() => { throw new Error("legacy profile read attempted"); });
    const reply = {
      request: { headers: {}, user: { id: "u1", role: "accredited", email: "u@example.test" } },
      code: vi.fn(function code() { return this; }),
    } as any;
    expect(requireAuth({ prepare } as any, reply, "accredited")).toBe("accredited");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("rejects a JWT principal below the required role", () => {
    const prepare = vi.fn(() => { throw new Error("legacy profile read attempted"); });
    const reply = {
      request: { headers: {}, user: { id: "u1", role: "public", email: "u@example.test" } },
      code: vi.fn(function code() { return this; }),
    } as any;
    expect(requireAuth({ prepare } as any, reply, "accredited")).toBeNull();
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(prepare).not.toHaveBeenCalled();
  });
});
