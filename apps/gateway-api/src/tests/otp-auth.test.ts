/**
 * OTP authentication regression tests.
 *
 * Mocks the PostgreSQL query layer so no live DB is required.
 * The SMS provider uses OTP_PROVIDER=console (log-only, no real SMS).
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { hashPassword } from "../auth/password";
import { signAccessToken } from "../auth/auth-middleware";
import { normalizePhone } from "../auth/otp-routes";

const { sendOtpMock, fetchMock } = vi.hoisted(() => ({ sendOtpMock: vi.fn(), fetchMock: vi.fn() }));
vi.stubGlobal("fetch", fetchMock);

// ── Environment setup ──────────────────────────────────────────────────────
process.env.NODE_ENV = "test";
process.env.OTP_PROVIDER = "console";
process.env.OTP_DEV_CODE = "123456";
process.env.OTP_TTL_MINUTES = "10";
process.env.OTP_MAX_ATTEMPTS = "5";
process.env.OTP_RESEND_COOLDOWN_SECONDS = "60";
process.env.OTP_DAILY_LIMIT_PER_PHONE = "10";
process.env.OTP_DAILY_LIMIT_PER_IP = "30";

// ── Mock the DB layer ──────────────────────────────────────────────────────
vi.mock("../lib/db.js", () => ({ query: vi.fn() }));
vi.mock("../auth/sms.js", () => ({
  createSmsProvider: () => ({ sendOtp: sendOtpMock }),
}));

// Import after mock registration
const { query } = await import("../lib/db.js") as { query: Mock };
const { otpRoutes } = await import("../auth/otp-routes");
const { registerAuthHook } = await import("../auth/auth-middleware");

// ── Helpers ────────────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(cookie);
  registerAuthHook(app);
  app.register(otpRoutes);

  // Tests require a local /api/me when otpRoutes are registered in-process.
  // Register a minimal handler here to avoid duplicating the route in full
  // runtime where auth-routes.ts already declares /api/me.
  app.get("/api/me", async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: "غير مصرح" });
    const res = await query("SELECT id, email, phone_number, full_name, name, rank, military_id, service_number, role, status, region, user_type, profile_completed, phone_verified_at, created_at, last_login FROM users WHERE id = $1", [user.id]);
    if ((res.rowCount ?? 0) === 0) return reply.code(404).send({ error: "المستخدم غير موجود" });
    return reply.send({ user: res.rows[0] });
  });
  return app;
}

function makeAuthToken(userId = "user-uuid-0001") {
  return signAccessToken({ sub: userId, role: "public", email: "user@watany.test" });
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

/** Pre-hash the dev code so tests can reuse it synchronously via beforeEach. */
let DEV_CODE_HASH = "";
beforeEach(async () => {
  if (!DEV_CODE_HASH) {
    DEV_CODE_HASH = await hashPassword("123456");
  }
  process.env.NODE_ENV = "test";
  process.env.OTP_PROVIDER = "console";
  process.env.OTP_DEV_CODE = "123456";
  process.env.OTP_TTL_MINUTES = "10";
  process.env.OTP_MAX_ATTEMPTS = "5";
  process.env.OTP_RESEND_COOLDOWN_SECONDS = "60";
  process.env.OTP_DAILY_LIMIT_PER_PHONE = "10";
  process.env.OTP_DAILY_LIMIT_PER_IP = "30";
  vi.clearAllMocks();
  sendOtpMock.mockReset();
  sendOtpMock.mockResolvedValue(undefined);
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error("fetch not mocked"));
  delete process.env.SMS_API_BASE_URL;
  delete process.env.SMS_API_KEY;
  delete process.env.SMS_API_TIMEOUT_MS;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Phone normalizer (pure unit tests) ─────────────────────────────────────

describe("normalizePhone", () => {
  it("accepts E.164 format", () => {
    expect(normalizePhone("+96103123456")).toBe("+96103123456");
  });

  it("normalises Lebanese 8-digit without prefix", () => {
    expect(normalizePhone("03123456")).toBe("+96103123456");
  });

  it("normalises Lebanese 8-digit with 0 prefix", () => {
    expect(normalizePhone("03 123 456")).toBe("+96103123456");
  });

  it("handles international 00 prefix", () => {
    expect(normalizePhone("0096103123456")).toBe("+96103123456");
  });

  it("returns null for invalid input", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

// ── POST /api/auth/otp/request ──────────────────────────────────────────────

describe("POST /api/auth/otp/request", () => {
  it("returns generic success for valid phone", async () => {
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    expect(sendOtpMock).toHaveBeenCalledWith("+96103123456", "123456");
  });

  it("returns generic success even for invalid phone (no enumeration)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "not-a-phone" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    // No DB calls should be made for invalid phone
    expect(query).not.toHaveBeenCalled();
  });

  it("stores bcrypt hash, not plain OTP code", async () => {
    let insertedHash = "";
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockImplementationOnce(async (_sql: string, params: unknown[]) => {
        // params[2] is code_hash
        insertedHash = params[2] as string;
        return { rows: [], rowCount: 1 };
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const app = buildApp();
    await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "03123456" },
    });

    expect(insertedHash).toBeTruthy();
    expect(insertedHash).not.toBe("123456");
    expect(insertedHash.startsWith("$2")).toBe(true); // bcrypt prefix
  });

  it("returns a generic failure when the provider send fails", async () => {
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    sendOtpMock.mockRejectedValueOnce(new Error("provider unavailable"));

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "تعذر إرسال رمز التحقق حالياً. حاول لاحقاً." });

    const cleanupCall = query.mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("DELETE FROM phone_otps WHERE id = $1"),
    );
    expect(cleanupCall).toBeTruthy();
  });

  it("enforces resend cooldown", async () => {
    query.mockResolvedValueOnce({ rows: [{ created_at: new Date().toISOString() }], rowCount: 1 });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: "تعذر إرسال رمز التحقق حالياً. حاول لاحقاً." });
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it("enforces the daily phone limit", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ created_at: new Date(Date.now() - 61_000).toISOString() }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 10 }], rowCount: 1 });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: "تعذر إرسال رمز التحقق حالياً. حاول لاحقاً." });
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it("enforces the daily IP limit", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ created_at: new Date(Date.now() - 61_000).toISOString() }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 2 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 30 }], rowCount: 1 });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: "تعذر إرسال رمز التحقق حالياً. حاول لاحقاً." });
    expect(sendOtpMock).not.toHaveBeenCalled();
  });
});

// ── POST /api/auth/otp/verify ───────────────────────────────────────────────

describe("POST /api/auth/otp/verify", () => {
  const MOCK_OTP_ID = "otp-uuid-0001";
  const MOCK_USER_ID = "user-uuid-0001";

  function mockVerifySequence(overrides: {
    otpRows?: object[];
    userRow?: object;
    userExists?: boolean;
  } = {}) {
    const otpRow = overrides.otpRows ?? [{
      id: MOCK_OTP_ID,
      code_hash: DEV_CODE_HASH,
      attempts: 0,
      max_attempts: 5,
    }];

    const userRow = overrides.userRow ?? {
      id: MOCK_USER_ID,
      role: "public",
      full_name: "مستخدم واتني",
      phone_number: "+96103123456",
      profile_completed: false,
    };

    query
      .mockResolvedValueOnce({ rows: otpRow, rowCount: otpRow.length }) // select OTP
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                 // increment attempts
      .mockResolvedValueOnce({ rows: [userRow], rowCount: 1 })          // upsert user
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                 // insert session
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                 // consume OTP
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });                // audit success
  }

  it("verifies correct OTP and creates new user", async () => {
    mockVerifySequence();

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "123456" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.phoneNumber).toBe("+96103123456");
    expect(body.user.role).toBe("public");
    expect(body.user.profileCompleted).toBe(false);

    const upsertCall = query.mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("INSERT INTO users"),
    );
    expect(upsertCall[0]).toContain("(email, phone_number, phone, role, status, full_name, name, username, profile_completed, phone_verified_at)");
    expect(upsertCall[1][0]).toBe("+96103123456");
    expect(upsertCall[1][1]).toBe("مستخدم واتني");

    const sessionCall = query.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO sessions"));
    const consumeCall = query.mock.calls.find(([sql]) => typeof sql === "string" && sql.includes("UPDATE phone_otps SET consumed_at = now() WHERE id = $1"));
    expect(sessionCall[0]).toContain("INSERT INTO sessions");
    expect(consumeCall[0]).toContain("UPDATE phone_otps SET consumed_at = now()");
  });

  it("verifies correct OTP and logs in existing user", async () => {
    mockVerifySequence({
      userRow: {
        id: MOCK_USER_ID,
        role: "public",
        full_name: "أحمد سليمان",
        phone_number: "+96103123456",
        profile_completed: true,
      },
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "123456" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.profileCompleted).toBe(true);
  });

  it("returns 401 for wrong OTP code", async () => {
    query
      .mockResolvedValueOnce({                             // select OTP (found)
        rows: [{ id: MOCK_OTP_ID, code_hash: DEV_CODE_HASH, attempts: 0, max_attempts: 5 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });  // increment attempts

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "999999" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("rejects expired OTP (no rows returned)", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // select OTP — not found/expired

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "123456" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/صلاحيته/);
  });

  it("increments attempts on wrong code", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: MOCK_OTP_ID, code_hash: DEV_CODE_HASH, attempts: 1, max_attempts: 5 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // increment attempts

    const app = buildApp();
    await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "000000" },
    });

    // Second call should be the UPDATE attempts query
    const updateCall = query.mock.calls[1];
    expect(updateCall[0]).toContain("UPDATE phone_otps SET attempts");
  });

  it("blocks and consumes OTP after max attempts", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: MOCK_OTP_ID, code_hash: DEV_CODE_HASH, attempts: 4, max_attempts: 5 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })  // increment attempts
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // consume OTP

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "123456" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/الحد الأقصى/);

    // Third DB call should be the consume OTP query
    const consumeCall = query.mock.calls[2];
    expect(consumeCall[0]).toContain("consumed_at = now()");
  });

  it("cannot reuse a consumed OTP", async () => {
    // First use: success
    mockVerifySequence();
    const app = buildApp();
    const first = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "123456" },
    });
    expect(first.statusCode).toBe(200);

    // Second use: OTP is consumed — SELECT returns no rows
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const second = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "123456" },
    });
    expect(second.statusCode).toBe(401);
  });

  it("does not consume OTP when user creation fails", async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: MOCK_OTP_ID, code_hash: DEV_CODE_HASH, attempts: 0, max_attempts: 5 }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockRejectedValueOnce(new Error("user insert failed"));

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "123456" },
    });

    expect(res.statusCode).toBe(500);

    const consumeCalls = query.mock.calls.filter(([sql]) =>
      typeof sql === "string" && sql.includes("UPDATE phone_otps SET consumed_at = now()"),
    );
    expect(consumeCalls).toHaveLength(0);
  });

  it("returns 400 for non-numeric code", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "03123456", code: "abcdef" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("does not reveal whether account exists (same error for unknown phone)", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // no OTP found

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/verify",
      payload: { phoneNumber: "+96170999999", code: "123456" },
    });

    // Same 401 as any other failure — no distinction
    expect(res.statusCode).toBe(401);
  });
});

// ── POST /api/auth/phone-verification/request ─────────────────────────────

describe("POST /api/auth/phone-verification/request", () => {
  it("starts an authenticated phone verification via SMS API", async () => {
    process.env.SMS_API_BASE_URL = "http://127.0.0.1:3012";
    process.env.SMS_API_KEY = "sk_test_sms_api";

    fetchMock.mockResolvedValueOnce(jsonResponse(202, {
      requestId: "sms-api-request-1",
      phone: "+96103123456",
      channel: "sms",
      status: "pending",
      expiresAt: "2026-05-23T18:30:00.000Z",
    }));
    query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/phone-verification/request",
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      phoneNumber: "+96103123456",
      message: "تم إرسال رمز التحقق إلى الرقم المطلوب.",
      expiresAt: "2026-05-23T18:30:00.000Z",
    });
    expect(res.json().requestId).toEqual(expect.any(String));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3012/v1/verify/start",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer sk_test_sms_api" }),
      }),
    );
  });

  it("falls back to the local whatsapp OTP provider during the initial stage", async () => {
    process.env.OTP_PROVIDER = "whatsapp";
    process.env.WHATSAPP_OUTBOUND_MODE = "simulate";
    process.env.WHATSAPP_ACCOUNT_NUMBER = "+96181396332";

    query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/phone-verification/request",
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      phoneNumber: "+96103123456",
      message: "تم إرسال رمز التحقق إلى الرقم المطلوب.",
    });
    expect(sendOtpMock).toHaveBeenCalledWith("+96103123456", "123456");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when SMS API is not configured", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/phone-verification/request",
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatch(/خدمة التحقق الهاتفي/);
  });
});

// ── POST /api/auth/phone-verification/verify ──────────────────────────────

describe("POST /api/auth/phone-verification/verify", () => {
  it("verifies the code and updates the authenticated user phone state", async () => {
    process.env.SMS_API_BASE_URL = "http://127.0.0.1:3012";
    process.env.SMS_API_KEY = "sk_test_sms_api";

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "sms-api-request-1",
      phone: "+96103123456",
      status: "verified",
      verifiedAt: "2026-05-23T18:15:00.000Z",
    }));
    query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    query
      .mockResolvedValueOnce({
        rows: [{
          id: "local-request-1",
          phone_number: "+96103123456",
          sms_api_request_id: "sms-api-request-1",
          status: "pending",
          expires_at: "2026-05-23T18:30:00.000Z",
          verified_at: null,
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "user-uuid-0001",
          role: "public",
          full_name: "أحمد سليمان",
          name: "أحمد سليمان",
          email: "user@watany.test",
          phone_number: "+96103123456",
          profile_completed: true,
          phone_verified_at: "2026-05-23T18:15:00.000Z",
        }],
        rowCount: 1,
      });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/phone-verification/verify",
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      payload: { requestId: "local-request-1", code: "123456" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      phoneNumber: "+96103123456",
      verifiedAt: "2026-05-23T18:15:00.000Z",
      profile: {
        isAuthed: true,
        phone: "+96103123456",
        phoneVerified: true,
        phoneVerifiedAt: "2026-05-23T18:15:00.000Z",
      },
    });
  });

  it("maps invalid SMS API code failures to a user-facing verification error", async () => {
    process.env.SMS_API_BASE_URL = "http://127.0.0.1:3012";
    process.env.SMS_API_KEY = "sk_test_sms_api";

    fetchMock.mockResolvedValueOnce(jsonResponse(400, { message: "Invalid code" }));
    query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    query.mockResolvedValueOnce({
      rows: [{
        id: "local-request-1",
        phone_number: "+96103123456",
        sms_api_request_id: "sms-api-request-1",
        status: "pending",
        expires_at: "2026-05-23T18:30:00.000Z",
        verified_at: null,
      }],
      rowCount: 1,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/phone-verification/verify",
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      payload: { requestId: "local-request-1", code: "999999" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("الرمز غير صحيح أو انتهت صلاحيته.");
  });

  it("verifies through the local initial-stage whatsapp fallback when SMS API is absent", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    query
      .mockResolvedValueOnce({
        rows: [{
          id: "local-request-1",
          phone_number: "+96103123456",
          sms_api_request_id: "local-otp-1",
          verification_backend: "local_whatsapp",
          status: "pending",
          expires_at: "2026-05-23T18:30:00.000Z",
          verified_at: null,
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "local-otp-1",
          code_hash: DEV_CODE_HASH,
          attempts: 0,
          max_attempts: 5,
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{
          id: "user-uuid-0001",
          role: "public",
          full_name: "أحمد سليمان",
          name: "أحمد سليمان",
          email: "user@watany.test",
          phone_number: "+96103123456",
          profile_completed: true,
          phone_verified_at: "2026-05-23T18:15:00.000Z",
        }],
        rowCount: 1,
      });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/phone-verification/verify",
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      payload: { requestId: "local-request-1", code: "123456" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      phoneNumber: "+96103123456",
      profile: {
        isAuthed: true,
        phone: "+96103123456",
        phoneVerified: true,
      },
    });
  });

  it("returns a conflict when the verified phone belongs to another account", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
    query
      .mockResolvedValueOnce({
        rows: [{
          id: "local-request-1",
          phone_number: "+96103123456",
          sms_api_request_id: "local-otp-1",
          verification_backend: "local_whatsapp",
          status: "pending",
          expires_at: "2026-05-23T18:30:00.000Z",
          verified_at: null,
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{
          id: "local-otp-1",
          code_hash: DEV_CODE_HASH,
          attempts: 0,
          max_attempts: 5,
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockRejectedValueOnce({ code: "23505", constraint: "users_phone_number_unique" });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/phone-verification/verify",
      headers: { authorization: `Bearer ${makeAuthToken()}` },
      payload: { requestId: "local-request-1", code: "123456" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("رقم الهاتف مستخدم بالفعل في حساب آخر.");
  });
});

// ── GET /api/me ─────────────────────────────────────────────────────────────

describe("GET /api/me", () => {
  const MOCK_USER_ID = "user-uuid-0001";

  function makeToken(userId = MOCK_USER_ID) {
    return signAccessToken({ sub: userId, role: "public", email: "+96103123456" });
  }

  it("returns user profile for authenticated request", async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: MOCK_USER_ID,
        email: null,
        phone_number: "+96103123456",
        full_name: "",
        name: "",
        rank: null,
        military_id: null,
        service_number: null,
        role: "public",
        status: "active",
        region: null,
        user_type: null,
        profile_completed: false,
        phone_verified_at: "2026-05-23T18:15:00.000Z",
        created_at: new Date().toISOString(),
        last_login: null,
      }],
      rowCount: 1,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.phone_number).toBe("+96103123456");
    expect(res.json().user.phone_verified_at).toBe("2026-05-23T18:15:00.000Z");
  });

  it("returns 401 without auth token", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/me" });
    expect(res.statusCode).toBe(401);
  });
});

// ── PATCH /api/me/profile ────────────────────────────────────────────────────

describe("PATCH /api/me/profile", () => {
  const MOCK_USER_ID = "user-uuid-0001";

  function makeToken(userId = MOCK_USER_ID) {
    return signAccessToken({ sub: userId, role: "public", email: "+96103123456" });
  }

  it("updates optional profile fields", async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: MOCK_USER_ID,
        email: null,
        phone_number: "+96103123456",
        full_name: "أحمد سليمان",
        rank: "رائد",
        service_number: null,
        user_type: "retired",
        role: "public",
        region: "بيروت",
        profile_completed: true,
        phone_verified_at: "2026-05-23T18:15:00.000Z",
      }],
      rowCount: 1,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { authorization: `Bearer ${makeToken()}` },
      payload: { fullName: "أحمد سليمان", rank: "رائد", userType: "retired", region: "بيروت" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.full_name).toBe("أحمد سليمان");
    expect(res.json().user.profile_completed).toBe(true);
    expect(res.json().user.phone_verified_at).toBe("2026-05-23T18:15:00.000Z");
  });

  it("rejects fullName shorter than 2 chars", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { authorization: `Bearer ${makeToken()}` },
      payload: { fullName: "أ" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid userType", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { authorization: `Bearer ${makeToken()}` },
      payload: { userType: "hacker" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 without auth token", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      payload: { fullName: "أحمد" },
    });
    expect(res.statusCode).toBe(401);
  });
});
