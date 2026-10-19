/**
 * OTP login → admin path, against a real PostgreSQL test database.
 *
 * Regression for the OTP verify flow signing the access token *before* the
 * session existed, without a `sid`. Admin paths resolve the principal from the
 * database (active user + live session + sid), so an OTP-logged-in admin was
 * anonymous there until the token was refreshed.
 *
 * Needs DATABASE_URL; skipped otherwise. When it is set, the run fails closed
 * unless the target is a disposable local test database (helpers/disposable-db.ts).
 * The SMS provider is mocked; OTP_DEV_CODE fixes the code.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.OTP_PROVIDER = "console";
process.env.OTP_DEV_CODE = "123456";
process.env.OTP_RESEND_COOLDOWN_SECONDS = "0";

vi.mock("../auth/sms.js", () => ({ createSmsProvider: () => ({ sendOtp: vi.fn().mockResolvedValue(undefined) }) }));

import { assertDisposableTestDatabase } from "./helpers/disposable-db";

const hasDb = Boolean(process.env.DATABASE_URL);
const { query } = await import("../lib/db.js");
const { otpRoutes } = await import("../auth/otp-routes");
const { registerAuthHook } = await import("../auth/auth-middleware");
const { requireRole } = await import("../auth/rbac");

const ADMIN_PROBE = "/api/admin/otp-session-sid-probe";
const createdUserIds: string[] = [];
const createdPhones: string[] = [];
let app: FastifyInstance;

function uniquePhone(): string {
  // Lebanese mobile format accepted by normalizePhone: +9613xxxxxx
  return `+9613${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
}

async function seedAdmin(email: string | null): Promise<{ id: string; phone: string }> {
  const phone = uniquePhone();
  const res = await query<{ id: string }>(
    "INSERT INTO users (email, phone_number, phone, role, status, name) VALUES ($1, $2, $2, 'admin', 'active', 'OTP session test admin') RETURNING id",
    [email, phone],
  );
  createdUserIds.push(res.rows[0].id);
  createdPhones.push(phone);
  return { id: res.rows[0].id, phone };
}

async function otpLogin(phone: string): Promise<{ status: number; accessToken?: string }> {
  const req = await app.inject({ method: "POST", url: "/api/auth/otp/request", payload: { phoneNumber: phone } });
  expect(req.statusCode).toBe(200);
  const verify = await app.inject({ method: "POST", url: "/api/auth/otp/verify", payload: { phoneNumber: phone, code: "123456" } });
  return { status: verify.statusCode, accessToken: (verify.json() as { accessToken?: string }).accessToken };
}

describe.skipIf(!hasDb)("OTP verify issues a session-backed access token (sid)", () => {
  beforeAll(async () => {
    assertDisposableTestDatabase();
    app = Fastify({ logger: false });
    await app.register(cookie);
    registerAuthHook(app);
    await app.register(otpRoutes);
    app.get(ADMIN_PROBE, { preHandler: requireRole("admin") }, async (request) => ({ user: request.user }));
    await app.ready();
  }, 60000);

  afterAll(async () => {
    if (!app) return; // guard refused the database: nothing was created
    if (createdUserIds.length) {
      await query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [createdUserIds]);
      await query("DELETE FROM audit_log WHERE user_id = ANY($1::uuid[])", [createdUserIds]);
    }
    if (createdPhones.length) await query("DELETE FROM phone_otps WHERE phone_number = ANY($1::text[])", [createdPhones]);
    if (createdUserIds.length) await query("DELETE FROM users WHERE id = ANY($1::uuid[])", [createdUserIds]);
    await app?.close();
  }, 60000);

  it("puts a sid in the access token that matches a live session row for the user", async () => {
    const admin = await seedAdmin(`otp-admin-${randomInt(0, 1e9)}@session.test`);
    const login = await otpLogin(admin.phone);
    expect(login.status).toBe(200);
    const claims = jwt.decode(login.accessToken!) as { sub: string; sid?: string };
    expect(claims.sub).toBe(admin.id);
    expect(typeof claims.sid).toBe("string");
    const session = await query("SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > now()", [claims.sid, admin.id]);
    expect(session.rowCount).toBe(1);
  });

  it("lets an OTP-logged-in admin reach an admin path immediately, without a refresh", async () => {
    const admin = await seedAdmin(`otp-admin-${randomInt(0, 1e9)}@session.test`);
    const login = await otpLogin(admin.phone);
    const res = await app.inject({ method: "GET", url: ADMIN_PROBE, headers: { authorization: `Bearer ${login.accessToken}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { user: { id: string; role: string; sessionId?: string } };
    expect(body.user.id).toBe(admin.id);
    expect(body.user.role).toBe("admin");
    expect(body.user.sessionId).toBe((jwt.decode(login.accessToken!) as { sid: string }).sid);
  });

  it("still treats the same user's token as anonymous on admin paths once the sid is stripped", async () => {
    const admin = await seedAdmin(`otp-admin-${randomInt(0, 1e9)}@session.test`);
    const login = await otpLogin(admin.phone);
    const { sid: _sid, iat: _iat, exp: _exp, ...rest } = jwt.decode(login.accessToken!) as Record<string, unknown>;
    const noSid = jwt.sign(rest, process.env.JWT_SECRET!, { expiresIn: 300 });
    const res = await app.inject({ method: "GET", url: ADMIN_PROBE, headers: { authorization: `Bearer ${noSid}` } });
    expect(res.statusCode).toBe(401);
  });

  it("lets an OTP-only admin with no email reach an admin path", async () => {
    const admin = await seedAdmin(null);
    const login = await otpLogin(admin.phone);
    expect(login.status).toBe(200);
    const res = await app.inject({ method: "GET", url: ADMIN_PROBE, headers: { authorization: `Bearer ${login.accessToken}` } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { user: { id: string; role: string; email: string | null; sessionId?: string } };
    expect(body.user.id).toBe(admin.id);
    expect(body.user.role).toBe("admin");
    expect(body.user.email).toBeNull(); // no invented email
    expect(body.user.sessionId).toBe((jwt.decode(login.accessToken!) as { sid: string }).sid);
  });

  it("still rejects an email-less admin whose session was revoked", async () => {
    const admin = await seedAdmin(null);
    const login = await otpLogin(admin.phone);
    await query("DELETE FROM sessions WHERE user_id = $1", [admin.id]);
    const res = await app.inject({ method: "GET", url: ADMIN_PROBE, headers: { authorization: `Bearer ${login.accessToken}` } });
    expect(res.statusCode).toBe(401);
  });

  it("still rejects an email-less user whose database role is not admin", async () => {
    const admin = await seedAdmin(null);
    const login = await otpLogin(admin.phone);
    await query("UPDATE users SET role = 'public' WHERE id = $1", [admin.id]);
    const res = await app.inject({ method: "GET", url: ADMIN_PROBE, headers: { authorization: `Bearer ${login.accessToken}` } });
    expect(res.statusCode).toBe(403);
  });
});
