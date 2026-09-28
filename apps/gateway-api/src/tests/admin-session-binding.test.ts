import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: new Map<string, { id: string; email: string; role: "admin" | "superadmin"; status: "active" | "suspended" }>(),
  sessions: new Map<string, { id: string; userId: string; expiresAt: number }>(),
}));

vi.mock("../lib/db.js", () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("SELECT id, email, role FROM users WHERE id = $1 AND status = 'active'")) {
      const user = state.users.get(String(params[0]));
      return {
        rows: user && user.status === "active" ? [{ id: user.id, email: user.email, role: user.role }] : [],
        rowCount: user && user.status === "active" ? 1 : 0,
      };
    }

    if (sql.includes("SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > now()")) {
      const session = state.sessions.get(String(params[0]));
      const userId = String(params[1]);
      const valid = session && session.userId === userId && session.expiresAt > Date.now();
      return { rows: valid ? [{ id: session.id }] : [], rowCount: valid ? 1 : 0 };
    }

    return { rows: [], rowCount: 0 };
  }),
}));

import { registerAuthHook, signAccessToken } from "../auth/auth-middleware.js";
import { requireRole } from "../auth/rbac.js";

const USER_ID = "session-binding-admin";
const SESSION_ID = "session-binding-session";

function token(sid?: string) {
  return signAccessToken({
    sub: USER_ID,
    role: "admin",
    email: "session-binding-admin@watany.test",
    ...(sid ? { sid } : {}),
  });
}

async function buildApp() {
  const app = Fastify({ logger: false });
  registerAuthHook(app);
  app.get("/api/admin/session-probe", { preHandler: [requireRole("admin")] }, async () => ({ ok: true }));
  app.get("/api/public/session-probe", async () => ({ ok: true }));
  await app.ready();
  return app;
}

beforeEach(() => {
  process.env.JWT_SECRET = "admin-session-binding-test-secret";
  state.users.clear();
  state.sessions.clear();
  state.users.set(USER_ID, {
    id: USER_ID,
    email: "session-binding-admin@watany.test",
    role: "admin",
    status: "active",
  });
  state.sessions.set(SESSION_ID, {
    id: SESSION_ID,
    userId: USER_ID,
    expiresAt: Date.now() + 60_000,
  });
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe("administrative session binding", () => {
  it("allows an active user with a matching live session", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/session-probe",
        headers: { authorization: `Bearer ${token(SESSION_ID)}` },
      });
      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it.each([
    ["missing sid", undefined],
    ["unknown sid", "unknown-session"],
    ["cross-user session", "cross-user-session"],
    ["expired session", "expired-session"],
    ["deleted session", "deleted-session"],
  ])("denies %s on administrative routes", async (_label, sid) => {
    if (sid === "cross-user-session") {
      state.sessions.set(sid, { id: sid, userId: "another-user", expiresAt: Date.now() + 60_000 });
    } else if (sid === "expired-session") {
      state.sessions.set(sid, { id: sid, userId: USER_ID, expiresAt: Date.now() - 1 });
    }

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/session-probe",
        headers: { authorization: `Bearer ${token(sid)}` },
      });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("denies a suspended user even when the session remains live", async () => {
    state.users.set(USER_ID, {
      id: USER_ID,
      email: "session-binding-admin@watany.test",
      role: "admin",
      status: "suspended",
    });
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/session-probe",
        headers: { authorization: `Bearer ${token(SESSION_ID)}` },
      });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("preserves public-token compatibility without sid", async () => {
    const app = await buildApp();
    try {
      const publicToken = signAccessToken({
        sub: "public-user",
        role: "public",
        email: "public-user@watany.test",
      });
      const response = await app.inject({
        method: "GET",
        url: "/api/public/session-probe",
        headers: { authorization: `Bearer ${publicToken}` },
      });
      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});