/**
 * OTP-based phone auth routes.
 *
 * POST /api/auth/otp/request  — send OTP to phone number
 * POST /api/auth/otp/verify   — verify OTP, create/login user
 * GET  /api/me                — get current user profile
 * PATCH /api/me/profile       — update optional profile fields
 */
import { randomInt, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { UserProfile, UserRole } from "@watany/types";
import { query } from "../lib/db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, signRefreshToken } from "./auth-middleware.js";
import { createSmsProvider, type SmsProvider } from "./sms.js";
import {
  SmsApiConfigError,
  SmsApiRequestError,
  checkSmsApiPhoneVerification,
  startSmsApiPhoneVerification,
} from "./sms-api-verify.js";

function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name] ?? String(fallback));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const OTP_TTL_MINUTES = readPositiveIntEnv("OTP_TTL_MINUTES", 10);
const OTP_MAX_ATTEMPTS = readPositiveIntEnv("OTP_MAX_ATTEMPTS", 5);
const OTP_RESEND_COOLDOWN_SECONDS = readPositiveIntEnv("OTP_RESEND_COOLDOWN_SECONDS", 60);
const OTP_DAILY_LIMIT_PER_PHONE = readPositiveIntEnv("OTP_DAILY_LIMIT_PER_PHONE", 10);
const OTP_DAILY_LIMIT_PER_IP = readPositiveIntEnv("OTP_DAILY_LIMIT_PER_IP", 30);
const OTP_DEFAULT_NAME = "مستخدم واتني";
const OTP_REQUEST_SUCCESS_MESSAGE = "إذا كان الرقم صالحاً، سيتم إرسال رمز التحقق.";
const OTP_SEND_FAILURE_MESSAGE = "تعذر إرسال رمز التحقق حالياً. حاول لاحقاً.";
const PHONE_VERIFICATION_REQUEST_SUCCESS_MESSAGE = "تم إرسال رمز التحقق إلى الرقم المطلوب.";
const PHONE_VERIFICATION_REQUEST_FAILURE_MESSAGE = "خدمة التحقق الهاتفي غير متاحة حالياً. حاول لاحقاً.";
const PHONE_VERIFICATION_VERIFY_FAILURE_MESSAGE = "الرمز غير صحيح أو انتهت صلاحيته.";
const PHONE_VERIFICATION_ATTEMPT_LIMIT_MESSAGE = "تجاوزت الحد الأقصى للمحاولات، اطلب رمزاً جديداً.";
const PHONE_VERIFICATION_PHONE_IN_USE_MESSAGE = "رقم الهاتف مستخدم بالفعل في حساب آخر.";
const PHONE_VERIFICATION_BACKEND_SMS_API = "sms_api";
const PHONE_VERIFICATION_BACKEND_LOCAL_WHATSAPP = "local_whatsapp";

const REFRESH_COOKIE_NAME = "watany_refresh";
const CSRF_COOKIE_NAME = "watany_csrf";
const REFRESH_COOKIE_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

function getHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function maskPhoneForLogs(phoneNumber: string): string {
  if (phoneNumber.length <= 6) return phoneNumber;
  return `${phoneNumber.slice(0, 4)}${"*".repeat(Math.max(phoneNumber.length - 6, 2))}${phoneNumber.slice(-2)}`;
}

async function recordOtpAudit(input: {
  userId?: string | null;
  action: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      "INSERT INTO audit_log (user_id, action, resource, details, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)",
      [input.userId ?? null, input.action, "auth.otp", input.details ?? {}, input.ip ?? null, input.userAgent ?? ""],
    );
  } catch {
    // Audit should never block auth flows.
  }
}

class LocalPhoneVerificationError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "LocalPhoneVerificationError";
    this.statusCode = statusCode;
  }
}

function mapPhoneVerificationProfile(input: {
  role: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone_number: string;
  phone_verified_at?: string | null;
}): UserProfile {
  return {
    isAuthed: true,
    role: input.role as UserRole,
    name: input.full_name || input.name || OTP_DEFAULT_NAME,
    phone: input.phone_number,
    email: input.email || undefined,
    phoneVerified: Boolean(input.phone_verified_at),
    phoneVerifiedAt: input.phone_verified_at || undefined,
  };
}

function mapPhoneVerificationError(error: unknown): { statusCode: number; message: string } | null {
  if (error instanceof LocalPhoneVerificationError) {
    return { statusCode: error.statusCode, message: error.message };
  }

  if (error instanceof SmsApiConfigError) {
    return { statusCode: 503, message: PHONE_VERIFICATION_REQUEST_FAILURE_MESSAGE };
  }

  if (!(error instanceof SmsApiRequestError)) {
    return null;
  }

  if (error.statusCode === 400 || error.statusCode === 422) {
    return { statusCode: 400, message: PHONE_VERIFICATION_VERIFY_FAILURE_MESSAGE };
  }

  if (error.statusCode === 429) {
    return { statusCode: 429, message: PHONE_VERIFICATION_ATTEMPT_LIMIT_MESSAGE };
  }

  return { statusCode: 503, message: PHONE_VERIFICATION_REQUEST_FAILURE_MESSAGE };
}

function isUsersPhoneNumberUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const constraint = "constraint" in error ? error.constraint : undefined;
  return code === "23505" && constraint === "users_phone_number_unique";
}

/**
 * Normalize a Lebanese or international phone number to E.164-like format.
 * Returns null for unrecognisable input.
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");

  // Already E.164: +<digits>
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned;

  // International without +: 00<digits>
  if (/^00\d{8,13}$/.test(cleaned)) return "+" + cleaned.slice(2);

  // Lebanese local with leading 0: 0<8 digits>
  if (/^0\d{8}$/.test(cleaned)) return "+961" + cleaned.slice(1);

  // Lebanese local without leading 0: 8 digits
  if (/^\d{8}$/.test(cleaned)) return "+961" + cleaned;

  return null;
}

function isInitialStageWhatsAppPhoneVerificationEnabled(): boolean {
  return (process.env.OTP_PROVIDER ?? "").trim().toLowerCase() === "whatsapp";
}

function isSmsApiPhoneVerificationConfigured(): boolean {
  return Boolean(process.env.SMS_API_BASE_URL?.trim()) && Boolean(process.env.SMS_API_KEY?.trim());
}

async function createLocalPhoneVerificationOtp(input: {
  sms: SmsProvider;
  phoneNumber: string;
  requestIp?: string;
  userAgent?: string;
}): Promise<{ backendRequestId: string; expiresAt: string }> {
  const code = generateOtpCode();
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const otpId = randomUUID();

  await query(
    `INSERT INTO phone_otps
       (id, phone_number, code_hash, purpose, expires_at, attempts, max_attempts, request_ip, user_agent, created_at)
     VALUES ($1, $2, $3, 'phone_verification', $4, 0, $5, $6, $7, now())`,
    [
      otpId,
      input.phoneNumber,
      codeHash,
      expiresAt,
      OTP_MAX_ATTEMPTS,
      input.requestIp ?? null,
      input.userAgent ?? "",
    ],
  );

  try {
    await input.sms.sendOtp(input.phoneNumber, code);
  } catch (error) {
    await query("DELETE FROM phone_otps WHERE id = $1", [otpId]);
    throw error;
  }

  return { backendRequestId: otpId, expiresAt };
}

async function verifyLocalPhoneVerificationOtp(input: {
  backendRequestId: string;
  phoneNumber: string;
  code: string;
}): Promise<{ verifiedAt: string }> {
  const otpResult = await query<{
    id: string;
    code_hash: string;
    attempts: number;
    max_attempts: number;
  }>(
    `SELECT id, code_hash, attempts, max_attempts
     FROM phone_otps
     WHERE id = $1
       AND phone_number = $2
       AND purpose = 'phone_verification'
       AND consumed_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [input.backendRequestId, input.phoneNumber],
  );

  if (!otpResult.rows.length) {
    throw new LocalPhoneVerificationError(400, PHONE_VERIFICATION_VERIFY_FAILURE_MESSAGE);
  }

  const otp = otpResult.rows[0];
  const newAttempts = otp.attempts + 1;
  const valid = await verifyPassword(input.code, otp.code_hash);

  if (!valid) {
    await query("UPDATE phone_otps SET attempts = $1 WHERE id = $2", [newAttempts, otp.id]);

    if (newAttempts >= otp.max_attempts) {
      await query("UPDATE phone_otps SET consumed_at = now() WHERE id = $1", [otp.id]);
      throw new LocalPhoneVerificationError(429, PHONE_VERIFICATION_ATTEMPT_LIMIT_MESSAGE);
    }

    throw new LocalPhoneVerificationError(400, PHONE_VERIFICATION_VERIFY_FAILURE_MESSAGE);
  }

  const verifiedAt = new Date().toISOString();
  await query("UPDATE phone_otps SET attempts = $1, consumed_at = now() WHERE id = $2", [newAttempts, otp.id]);
  return { verifiedAt };
}

/** Generate a 6-digit OTP. In non-production, OTP_DEV_CODE overrides for testing. */
function generateOtpCode(): string {
  const devCode = process.env.OTP_DEV_CODE;
  if (devCode && process.env.NODE_ENV !== "production") {
    return devCode;
  }
  return String(randomInt(100000, 1000000));
}

function isSecureContext(request: { protocol: string; headers: Record<string, string | string[] | undefined> }): boolean {
  const proto = request.headers["x-forwarded-proto"];
  const firstProto = Array.isArray(proto) ? proto[0] : proto;
  return request.protocol === "https" || firstProto === "https";
}

export async function otpRoutes(app: FastifyInstance): Promise<void> {
  let sms: SmsProvider | null = null;
  let smsProviderInitError: Error | null = null;
  try {
    sms = createSmsProvider();
  } catch (error) {
    smsProviderInitError = error instanceof Error ? error : new Error(String(error));
    app.log.warn(
      {
        err: smsProviderInitError,
        otpProvider: process.env.OTP_PROVIDER ?? "console",
        smsProvider: process.env.SMS_PROVIDER ?? null,
      },
      "OTP provider unavailable; OTP routes will return service unavailable",
    );
  }
  const otpProvider = process.env.OTP_PROVIDER ?? "console";
  const whatsappMode =
    otpProvider === "whatsapp"
      ? (process.env.WHATSAPP_OUTBOUND_MODE ?? (process.env.NODE_ENV === "production" ? "live" : "simulate"))
      : null;
  app.log.info(
    {
      otpProvider,
      smsProvider: otpProvider === "sms" ? process.env.SMS_PROVIDER ?? "twilio" : null,
      whatsappMode,
      whatsappAccountNumber: otpProvider === "whatsapp" ? process.env.WHATSAPP_ACCOUNT_NUMBER ?? null : null,
    },
    "OTP provider configured",
  );

  /**
   * POST /api/auth/otp/request
   * Sends a 6-digit OTP to the given phone number.
   * Always returns a generic success message (no account enumeration).
   */
  app.post(
    "/api/auth/otp/request",
    { config: { public: true } },
    async (request, reply) => {
      const genericSuccess = { ok: true, message: OTP_REQUEST_SUCCESS_MESSAGE };
      const { phoneNumber } = request.body as { phoneNumber?: unknown };
      const requestIp = request.ip;
      const userAgent = getHeaderValue(request.headers["user-agent"]);

      if (typeof phoneNumber !== "string") {
        // Return generic to avoid enumeration
        return reply.send(genericSuccess);
      }

      const normalized = normalizePhone(phoneNumber);
      if (!normalized) {
        return reply.send(genericSuccess);
      }

      if (!sms) {
        request.log.warn(
          {
            err: smsProviderInitError,
            otpProvider: process.env.OTP_PROVIDER ?? "console",
            phoneNumber: maskPhoneForLogs(normalized),
          },
          "OTP request rejected because provider is unavailable",
        );
        return reply.code(503).send({ error: OTP_SEND_FAILURE_MESSAGE });
      }

      const latestRequestResult = await query<{ created_at: string }>(
        `SELECT created_at
         FROM phone_otps
         WHERE phone_number = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalized],
      );

      const latestRequestAt = latestRequestResult.rows[0]?.created_at;
      if (latestRequestAt) {
        const elapsedMs = Date.now() - new Date(latestRequestAt).getTime();
        if (elapsedMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
          request.log.warn(
            { phoneNumber: maskPhoneForLogs(normalized), requestIp, cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS },
            "OTP request blocked by resend cooldown",
          );
          return reply.code(429).send({ error: OTP_SEND_FAILURE_MESSAGE });
        }
      }

      const phoneDailyResult = await query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM phone_otps
         WHERE phone_number = $1
           AND created_at >= date_trunc('day', now())`,
        [normalized],
      );
      const phoneDailyCount = phoneDailyResult.rows[0]?.total ?? 0;
      if (phoneDailyCount >= OTP_DAILY_LIMIT_PER_PHONE) {
        request.log.warn(
          { phoneNumber: maskPhoneForLogs(normalized), requestIp, phoneDailyCount, phoneDailyLimit: OTP_DAILY_LIMIT_PER_PHONE },
          "OTP request blocked by daily phone limit",
        );
        return reply.code(429).send({ error: OTP_SEND_FAILURE_MESSAGE });
      }

      const ipDailyResult = await query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM phone_otps
         WHERE request_ip = $1
           AND created_at >= date_trunc('day', now())`,
        [requestIp],
      );
      const ipDailyCount = ipDailyResult.rows[0]?.total ?? 0;
      if (ipDailyCount >= OTP_DAILY_LIMIT_PER_IP) {
        request.log.warn(
          { phoneNumber: maskPhoneForLogs(normalized), requestIp, ipDailyCount, ipDailyLimit: OTP_DAILY_LIMIT_PER_IP },
          "OTP request blocked by daily IP limit",
        );
        return reply.code(429).send({ error: OTP_SEND_FAILURE_MESSAGE });
      }

      const code = generateOtpCode();
      const codeHash = await hashPassword(code);
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
      const otpId = randomUUID();

      await query(
        `INSERT INTO phone_otps
           (id, phone_number, code_hash, purpose, expires_at, attempts, max_attempts, request_ip, user_agent, created_at)
         VALUES ($1, $2, $3, 'login', $4, 0, $5, $6, $7, now())`,
        [
          otpId,
          normalized,
          codeHash,
          expiresAt.toISOString(),
          OTP_MAX_ATTEMPTS,
          requestIp,
          userAgent,
        ],
      );

      try {
        await sms.sendOtp(normalized, code);
      } catch (error) {
        try {
          await query("DELETE FROM phone_otps WHERE id = $1", [otpId]);
        } catch (cleanupError) {
          request.log.error(
            { err: cleanupError, otpId, phoneNumber: maskPhoneForLogs(normalized) },
            "OTP request cleanup failed after provider error",
          );
        }

        request.log.error(
          {
            err: error,
            otpProvider: process.env.OTP_PROVIDER ?? "console",
            smsProvider: process.env.OTP_PROVIDER === "sms" ? process.env.SMS_PROVIDER ?? "twilio" : null,
            phoneNumber: maskPhoneForLogs(normalized),
          },
          "OTP request send failed",
        );

        return reply.code(503).send({ error: OTP_SEND_FAILURE_MESSAGE });
      }

      try {
        await query(
          "UPDATE phone_otps SET consumed_at = now() WHERE phone_number = $1 AND id <> $2 AND consumed_at IS NULL",
          [normalized, otpId],
        );
      } catch (cleanupError) {
        request.log.warn(
          { err: cleanupError, otpId, phoneNumber: maskPhoneForLogs(normalized) },
          "OTP request old-code cleanup failed",
        );
      }

      request.log.info(
        {
          otpProvider: process.env.OTP_PROVIDER ?? "console",
          smsProvider: process.env.OTP_PROVIDER === "sms" ? process.env.SMS_PROVIDER ?? "twilio" : null,
          phoneNumber: maskPhoneForLogs(normalized),
          phoneDailyCount: phoneDailyCount + 1,
          ipDailyCount: ipDailyCount + 1,
        },
        "OTP request sent",
      );

      return reply.send(genericSuccess);
    },
  );

  /**
   * POST /api/auth/phone-verification/request
   * Starts an authenticated phone-verification flow through the SMS API.
   */
  app.post(
    "/api/auth/phone-verification/request",
    async (request, reply) => {
      const authUser = request.user;
      if (!authUser) {
        return reply.code(401).send({ error: "غير مصرح" });
      }

      const { phoneNumber } = request.body as { phoneNumber?: unknown };
      if (typeof phoneNumber !== "string") {
        return reply.code(400).send({ error: "رقم الهاتف مطلوب" });
      }

      const normalized = normalizePhone(phoneNumber);
      if (!normalized) {
        return reply.code(400).send({ error: "رقم الهاتف غير صالح" });
      }

      try {
        const useSmsApi = isSmsApiPhoneVerificationConfigured();
        const localRequestId = randomUUID();
        let backendRequestId = "";
        let backend = PHONE_VERIFICATION_BACKEND_SMS_API;
        let expiresAt = "";

        if (useSmsApi) {
          const verification = await startSmsApiPhoneVerification(normalized);
          backendRequestId = verification.requestId;
          expiresAt = verification.expiresAt;
        } else if (isInitialStageWhatsAppPhoneVerificationEnabled()) {
          if (!sms) {
            throw new SmsApiConfigError();
          }
          const localVerification = await createLocalPhoneVerificationOtp({
            sms,
            phoneNumber: normalized,
            requestIp: request.ip,
            userAgent: getHeaderValue(request.headers["user-agent"]),
          });
          backendRequestId = localVerification.backendRequestId;
          backend = PHONE_VERIFICATION_BACKEND_LOCAL_WHATSAPP;
          expiresAt = localVerification.expiresAt;
        } else {
          throw new SmsApiConfigError();
        }

        await query(
          `INSERT INTO phone_verification_requests
             (id, user_id, phone_number, sms_api_request_id, verification_backend, status, expires_at, request_ip, user_agent, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, now(), now())`,
          [
            localRequestId,
            authUser.id,
            normalized,
            backendRequestId,
            backend,
            expiresAt,
            request.ip,
            getHeaderValue(request.headers["user-agent"]),
          ],
        );

        return reply.send({
          ok: true,
          requestId: localRequestId,
          phoneNumber: normalized,
          expiresAt,
          message: PHONE_VERIFICATION_REQUEST_SUCCESS_MESSAGE,
        });
      } catch (error) {
        const mapped = mapPhoneVerificationError(error);
        if (mapped) {
          request.log.warn(
            { err: error, userId: authUser.id, phoneNumber: maskPhoneForLogs(normalized) },
            "phone_verification_request_failed",
          );
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }

        request.log.error(
          { err: error, userId: authUser.id, phoneNumber: maskPhoneForLogs(normalized) },
          "phone_verification_request_unexpected_failure",
        );
        return reply.code(503).send({ error: PHONE_VERIFICATION_REQUEST_FAILURE_MESSAGE });
      }
    },
  );

  /**
   * POST /api/auth/otp/verify
   * Verify OTP code and return access token. Creates account on first login.
   */
  app.post(
    "/api/auth/otp/verify",
    { config: { public: true } },
    async (request, reply) => {
      const body = request.body as { phoneNumber?: unknown; code?: unknown };
      const requestIp = request.ip;
      const userAgent = getHeaderValue(request.headers["user-agent"]);

      if (typeof body.phoneNumber !== "string" || typeof body.code !== "string") {
        return reply.code(400).send({ error: "رقم الهاتف والرمز مطلوبان" });
      }

      if (!/^\d{6}$/.test(body.code)) {
        return reply.code(400).send({ error: "الرمز يجب أن يكون 6 أرقام" });
      }

      const normalized = normalizePhone(body.phoneNumber);
      if (!normalized) {
        return reply.code(400).send({ error: "رقم الهاتف غير صالح" });
      }

      // Find latest active, unexpired OTP for this phone
      const otpResult = await query<{
        id: string;
        code_hash: string;
        attempts: number;
        max_attempts: number;
      }>(
        `SELECT id, code_hash, attempts, max_attempts
         FROM phone_otps
         WHERE phone_number = $1
           AND consumed_at IS NULL
           AND expires_at > now()
         ORDER BY created_at DESC
         LIMIT 1`,
        [normalized],
      );

      if (!otpResult.rows.length) {
        await recordOtpAudit({
          action: "otp.verify.failed",
          ip: requestIp,
          userAgent,
          details: { phoneNumber: normalized, reason: "not_found_or_expired" },
        });
        return reply.code(401).send({ error: "الرمز غير صحيح أو انتهت صلاحيته" });
      }

      const otp = otpResult.rows[0];
      const newAttempts = otp.attempts + 1;

      // Increment attempts
      await query("UPDATE phone_otps SET attempts = $1 WHERE id = $2", [newAttempts, otp.id]);

      // Enforce max attempts
      if (newAttempts >= otp.max_attempts) {
        await query("UPDATE phone_otps SET consumed_at = now() WHERE id = $1", [otp.id]);
        await recordOtpAudit({
          action: "otp.verify.failed",
          ip: requestIp,
          userAgent,
          details: { phoneNumber: normalized, reason: "max_attempts", attempts: newAttempts },
        });
        return reply.code(401).send({ error: "تجاوزت الحد الأقصى للمحاولات، طلب رمز جديد" });
      }

      // Verify bcrypt hash
      const valid = await verifyPassword(body.code, otp.code_hash);
      if (!valid) {
        await recordOtpAudit({
          action: "otp.verify.failed",
          ip: requestIp,
          userAgent,
          details: { phoneNumber: normalized, reason: "invalid_code", attempts: newAttempts },
        });
        return reply.code(401).send({ error: "الرمز غير صحيح أو انتهت صلاحيته" });
      }

      // Upsert user by phone_number
      const username = "u_" + randomUUID().replace(/-/g, "").slice(0, 12);
      const upsertResult = await query<{
        id: string;
        role: string;
        full_name: string;
        phone_number: string;
        profile_completed: boolean;
      }>(
        `INSERT INTO users
           (email, phone_number, phone, role, status, full_name, name, username, profile_completed, phone_verified_at)
         VALUES (NULL, $1, $1, 'public', 'active', $2, $2, $3, false, now())
         ON CONFLICT ON CONSTRAINT users_phone_number_unique DO UPDATE SET
           last_login = now(),
           phone_verified_at = now(),
           full_name = CASE
             WHEN users.full_name IS NULL OR btrim(users.full_name) = '' THEN EXCLUDED.full_name
             ELSE users.full_name
           END,
           name = CASE
             WHEN users.name IS NULL OR btrim(users.name) = '' THEN EXCLUDED.name
             ELSE users.name
           END
         RETURNING id, role, full_name, phone_number, profile_completed`,
        [normalized, OTP_DEFAULT_NAME, username],
      );

      if (!upsertResult.rows.length) {
        return reply.code(500).send({ error: "خطأ في إنشاء الحساب" });
      }

      const user = upsertResult.rows[0];

      const accessToken = signAccessToken({
        sub: user.id,
        role: user.role as UserRole,
        // Use phone_number as email placeholder for JWT compatibility
        email: user.phone_number,
      });
      const refreshToken = signRefreshToken({ sub: user.id });

      // Store session
      await query(
        "INSERT INTO sessions (user_id, token, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, now() + interval '7 days')",
        [user.id, refreshToken, requestIp, userAgent],
      );

      await query("UPDATE phone_otps SET consumed_at = now() WHERE id = $1", [otp.id]);
      await recordOtpAudit({
        userId: user.id,
        action: "otp.verify.success",
        ip: requestIp,
        userAgent,
        details: { phoneNumber: normalized },
      });

      // Set auth cookies
      const secure = isSecureContext(request as any);
      const csrfToken = randomUUID();
      reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
        path: "/api/auth",
        httpOnly: true,
        sameSite: "strict",
        secure,
        maxAge: REFRESH_COOKIE_TTL_SEC,
      });
      reply.setCookie(CSRF_COOKIE_NAME, csrfToken, {
        path: "/",
        httpOnly: false,
        sameSite: "strict",
        secure,
        maxAge: REFRESH_COOKIE_TTL_SEC,
      });

      return reply.send({
        accessToken,
        expiresIn: 86400,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          role: user.role,
          profileCompleted: Boolean(user.profile_completed),
        },
      });
    },
  );

  /**
   * POST /api/auth/phone-verification/verify
   * Completes the authenticated phone-verification flow and updates the Watany user record.
   */
  app.post(
    "/api/auth/phone-verification/verify",
    async (request, reply) => {
      const authUser = request.user;
      if (!authUser) {
        return reply.code(401).send({ error: "غير مصرح" });
      }

      const body = request.body as { requestId?: unknown; code?: unknown };
      if (typeof body.requestId !== "string" || typeof body.code !== "string") {
        return reply.code(400).send({ error: "معرّف الطلب والرمز مطلوبان" });
      }

      if (!/^\d{6}$/.test(body.code)) {
        return reply.code(400).send({ error: "الرمز يجب أن يكون 6 أرقام" });
      }

      const verificationRequest = await query<{
        id: string;
        phone_number: string;
        sms_api_request_id: string;
        verification_backend: string;
        status: string;
        expires_at: string | null;
        verified_at: string | null;
      }>(
        `SELECT id, phone_number, sms_api_request_id, verification_backend, status, expires_at, verified_at
         FROM phone_verification_requests
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [body.requestId, authUser.id],
      );

      if (!verificationRequest.rows.length) {
        return reply.code(404).send({ error: "طلب التحقق غير موجود" });
      }

      const pending = verificationRequest.rows[0];
      if (pending.verified_at) {
        return reply.code(409).send({ error: "تم تأكيد هذا الرقم سابقاً" });
      }

      try {
        const verification = pending.verification_backend === PHONE_VERIFICATION_BACKEND_LOCAL_WHATSAPP
          ? await verifyLocalPhoneVerificationOtp({
            backendRequestId: pending.sms_api_request_id,
            phoneNumber: pending.phone_number,
            code: body.code,
          })
          : await checkSmsApiPhoneVerification(pending.sms_api_request_id, body.code);
        const verifiedAt = verification.verifiedAt || new Date().toISOString();

        const updatedUser = await query<{
          id: string;
          role: string;
          full_name: string | null;
          name: string | null;
          email: string | null;
          phone_number: string;
          profile_completed: boolean;
          phone_verified_at: string | null;
        }>(
          `UPDATE users
           SET phone_number = $1,
               phone = $1,
               phone_verified_at = $2,
               updated_at = now()
           WHERE id = $3
           RETURNING id, role, full_name, name, email, phone_number, profile_completed, phone_verified_at`,
          [pending.phone_number, verifiedAt, authUser.id],
        );

        if (!updatedUser.rows.length) {
          return reply.code(404).send({ error: "المستخدم غير موجود" });
        }

        await query(
          `UPDATE phone_verification_requests
           SET status = 'verified', verified_at = $2, updated_at = now()
           WHERE id = $1`,
          [pending.id, verifiedAt],
        );

        await recordOtpAudit({
          userId: authUser.id,
          action: "phone_verification.verify.success",
          ip: request.ip,
          userAgent: getHeaderValue(request.headers["user-agent"]),
          details: { phoneNumber: pending.phone_number, verificationRequestId: pending.id },
        });

        const user = updatedUser.rows[0];
        return reply.send({
          ok: true,
          phoneNumber: user.phone_number,
          verifiedAt,
          user: {
            id: user.id,
            role: user.role,
            phoneNumber: user.phone_number,
            profileCompleted: Boolean(user.profile_completed),
          },
          profile: mapPhoneVerificationProfile(user),
        });
      } catch (error) {
        if (isUsersPhoneNumberUniqueViolation(error)) {
          await recordOtpAudit({
            userId: authUser.id,
            action: "phone_verification.verify.conflict",
            ip: request.ip,
            userAgent: getHeaderValue(request.headers["user-agent"]),
            details: { phoneNumber: pending.phone_number, verificationRequestId: pending.id },
          });

          return reply.code(409).send({ error: PHONE_VERIFICATION_PHONE_IN_USE_MESSAGE });
        }

        await recordOtpAudit({
          userId: authUser.id,
          action: "phone_verification.verify.failed",
          ip: request.ip,
          userAgent: getHeaderValue(request.headers["user-agent"]),
          details: { phoneNumber: pending.phone_number, verificationRequestId: pending.id },
        });

        const mapped = mapPhoneVerificationError(error);
        if (mapped) {
          request.log.warn(
            { err: error, userId: authUser.id, phoneNumber: maskPhoneForLogs(pending.phone_number) },
            "phone_verification_verify_failed",
          );
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }

        request.log.error(
          { err: error, userId: authUser.id, phoneNumber: maskPhoneForLogs(pending.phone_number) },
          "phone_verification_verify_unexpected_failure",
        );
        return reply.code(503).send({ error: PHONE_VERIFICATION_REQUEST_FAILURE_MESSAGE });
      }
    },
  );

  // WATANYBOT_DUPLICATE_API_ME_DISABLED: /api/me is owned by auth-routes.ts.

  /** GET /api/me — return current user profile (kept here for tests/compat) */

  /**
   * PATCH /api/me/profile
   * Gradual profile completion — all fields optional.
   */
  app.patch("/api/me/profile", async (request, reply) => {
    const authUser = request.user;
    if (!authUser) {
      return reply.code(401).send({ error: "غير مصرح" });
    }

    const body = request.body as {
      fullName?: unknown;
      rank?: unknown;
      serviceNumber?: unknown;
      userType?: unknown;
      region?: unknown;
    };

    // Validate fullName if provided
    if (body.fullName !== undefined) {
      if (typeof body.fullName !== "string" || body.fullName.trim().length < 2 || body.fullName.trim().length > 80) {
        return reply.code(400).send({ error: "الاسم يجب أن يكون بين 2 و 80 حرفاً" });
      }
    }

    const VALID_USER_TYPES = new Set(["retired", "family_member", "widow", "beneficiary"]);
    if (body.userType !== undefined && body.userType !== null && !VALID_USER_TYPES.has(body.userType as string)) {
      return reply.code(400).send({ error: "نوع المستخدم غير صالح" });
    }

    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : null;
    const rank = typeof body.rank === "string" ? body.rank.trim() : null;
    const serviceNumber = typeof body.serviceNumber === "string" ? body.serviceNumber.trim() : null;
    const userType = typeof body.userType === "string" ? body.userType : null;
    const region = typeof body.region === "string" ? body.region.trim() : null;

    const result = await query(
      `UPDATE users
       SET full_name      = COALESCE($1, full_name),
           rank           = COALESCE($2, rank),
           service_number = COALESCE($3, service_number),
           user_type      = COALESCE($4, user_type),
           region         = COALESCE($5, region),
           profile_completed = CASE
             WHEN $1 IS NOT NULL AND length(trim($1)) > 0 THEN true
             ELSE profile_completed
           END,
           updated_at     = now()
       WHERE id = $6
       RETURNING id, email, phone_number, full_name, rank, service_number,
                 user_type, role, region, profile_completed, phone_verified_at`,
      [fullName, rank, serviceNumber, userType, region, authUser.id],
    );

    if (!result.rows.length) {
      return reply.code(404).send({ error: "المستخدم غير موجود" });
    }

    return reply.send({ user: result.rows[0] });
  });
}
