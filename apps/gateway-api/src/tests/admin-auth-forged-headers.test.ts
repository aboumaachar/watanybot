/**
 * The admin hardening guard must not trust role headers or token text. Forged role
 * headers, or a bearer value that merely contains "ADMIN"/"SUPER", are anonymous:
 * every guarded prefix (including unknown child paths) answers 401, not 404.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { cleanupSessionUsers, createSessionToken } from "./helpers/session-auth";

let app: FastifyInstance;
const guarded = [
  "/api/admin/dashboard",
  "/api/admin/chat-messages",
  "/api/admin/al-wafiyat",
  "/api/admin/deaths",
  "/api/admin/opportunities/no-such-child",
  "/api/admin/procedures",
  "/api/admin/procedures/diagnostics",
];
const forged: Record<string, Record<string, string>> = {
  "x-user-role": { "x-user-role": "SUPER_ADMIN" },
  "x-admin-role": { "x-admin-role": "admin" },
  "x-watany-role": { "x-watany-role": "superadmin" },
  "bearer text": { authorization: "Bearer SUPERADMIN-ROOT" },
  "x-superadmin": { "x-superadmin": "root" },
  "x-admin-token": { "x-admin-token": "admin" },
};

describe("admin hardening guard ignores forged role headers", () => {
  beforeAll(async () => {
    app = (await import("../server.js")).app;
    await app.ready();
  }, 60000);

  afterAll(async () => {
    await cleanupSessionUsers();
  });

  for (const path of guarded) {
    for (const [label, headers] of Object.entries(forged)) {
      it(`${path} with forged ${label} is 401`, async () => {
        const res = await app.inject({ method: "GET", url: path, headers });
        expect(res.statusCode).toBe(401);
      });
    }
  }

  it("still forbids a real admin session on superadmin-only prefixes, even with a forged role header", async () => {
    const admin = await createSessionToken("admin", "forged-guard");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/procedures/no-such-child",
      headers: { authorization: `Bearer ${admin}`, "x-user-role": "SUPER_ADMIN", "x-watany-role": "superadmin" },
    });
    expect(res.statusCode).toBe(403);
  });
});
