import { afterEach, describe, expect, it } from "vitest";
import Fastify from "fastify";

import { registerAuthHook } from "../auth/auth-middleware";
import { requireRole } from "../auth/rbac";

describe("registerAuthHook without JWT_SECRET", () => {
  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it("still serves public routes and keeps protected routes locked", async () => {
    delete process.env.JWT_SECRET;

    const app = Fastify({ logger: false });
    registerAuthHook(app);

    app.get("/api/salary/meta", async () => ({ ok: true }));
    app.get("/api/admin/probe", { preHandler: [requireRole("admin")] }, async () => ({ ok: true }));

    const publicRes = await app.inject({ method: "GET", url: "/api/salary/meta" });
    expect(publicRes.statusCode).toBe(200);
    expect(publicRes.json()).toEqual({ ok: true });

    const protectedRes = await app.inject({ method: "GET", url: "/api/admin/probe" });
    expect(protectedRes.statusCode).toBe(401);
  });
});