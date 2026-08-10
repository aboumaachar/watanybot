/**
 * Auth route handlers — register, login, logout, refresh, me.
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { query } from "../lib/db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken, signRefreshToken, verifyToken } from "./auth-middleware.js";
import type { UserRole } from "@watany/types";
import { effectiveUserRole, isConfiguredAdminEmail } from "./admin-policy.js";

const REFRESH_COOKIE_NAME = "watany_refresh";
const CSRF_COOKIE_NAME = "watany_csrf";
const REFRESH_COOKIE_TTL_SEC = 60 * 60 * 24 * 7;
const DEV_ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const DEV_ADMIN_EMAIL = process.env.DEV_ADMIN_EMAIL?.trim() || "";
const DEV_ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD?.trim() || "";
const DEV_ADMIN_FALLBACK_FLAG = "ALLOW_DEV_ADMIN_FALLBACK";
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  exp?: string;
  iss?: string;
  name?: string;
  sub?: string;
};

type AuthenticatedUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
  username: string;
};

function buildGeneratedUsername(): string {
  return `u_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() || "";
}

function isVerifiedGoogleEmail(value: string | boolean | undefined): boolean {
  return value === true || value === "true";
}

function normalizeGoogleDisplayName(name: string | undefined, email: string): string {
  const nextName = name?.trim();
  if (nextName) {
    return nextName;
  }

  return email.split("@")[0] || "مستخدم موطني";
}

async function verifyGoogleCredential(credential: string): Promise<GoogleTokenInfo | null> {
  const googleClientId = getGoogleClientId();
  if (!googleClientId) {
    throw new Error("GOOGLE_AUTH_NOT_CONFIGURED");
  }

  const response = await fetch(`${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) {
    return null;
  }

  const tokenInfo = await response.json() as GoogleTokenInfo;
  const expiresAt = Number(tokenInfo.exp || "0");
  const isExpired = !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000);

  if (
    tokenInfo.aud !== googleClientId
    || !tokenInfo.sub
    || !tokenInfo.email
    || !GOOGLE_ISSUERS.has(tokenInfo.iss || "")
    || !isVerifiedGoogleEmail(tokenInfo.email_verified)
    || isExpired
  ) {
    return null;
  }

  return tokenInfo;
}

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybePgError = error as { code?: string; message?: string };
  const message = maybePgError.message?.toLowerCase() || "";

  return maybePgError.code === "3D000"
    || maybePgError.code === "28P01"
    || maybePgError.code === "ECONNREFUSED"
    || message.includes("database")
    || message.includes("password authentication failed")
    || message.includes("connect econnrefused");
}

function isSecureRequest(request: FastifyRequest): boolean {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return request.protocol === "https" || proto === "https" || process.env.NODE_ENV === "production";
}

function normalizeHost(value: string | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.startsWith("[")) {
    const closingIndex = trimmed.indexOf("]");
    return closingIndex === -1 ? trimmed : trimmed.slice(1, closingIndex);
  }

  return trimmed.split(":")[0];
}

function isLoopbackHost(hostname: string | null): boolean {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1";
}

function isLoopbackIp(clientIp: string): boolean {
  if (clientIp === "::1") {
    return true;
  }

  const ipv4Address = clientIp.startsWith("::ffff:")
    ? clientIp.slice("::ffff:".length)
    : clientIp;
  const ipv4Loopback = [127, 0, 0, 1].join(".");

  return ipv4Address === ipv4Loopback;
}

function isLocalRequest(request: FastifyRequest): boolean {
  const forwardedFor = request.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const clientIp = (firstForwarded?.split(",")[0]?.trim() || request.ip || "").toLowerCase();
  const hostname = normalizeHost(request.hostname) ?? normalizeHost(request.headers.host);

  return isLoopbackHost(hostname) && isLoopbackIp(clientIp);
}

function isDevAdminFallbackEnabled(request: FastifyRequest): boolean {
  return process.env.NODE_ENV === "development"
    && process.env[DEV_ADMIN_FALLBACK_FLAG] === "true"
    && isLocalRequest(request);
}

function getLoginUnavailableMessage(request: FastifyRequest): string {
  if (isDevAdminFallbackEnabled(request)) {
    return "قاعدة بيانات تسجيل الدخول غير مهيأة محلياً. تم تفعيل حساب الطوارئ المحلي لهذا الجهاز فقط.";
  }

  return "خدمة تسجيل الدخول غير متاحة حالياً";
}

function refreshCookieOptions(request: FastifyRequest, rememberMe = true) {
  return {
    path: "/api/auth",
    httpOnly: true,
    sameSite: "strict" as const,
    secure: isSecureRequest(request),
    ...(rememberMe ? { maxAge: REFRESH_COOKIE_TTL_SEC } : {}),
  };
}

function csrfCookieOptions(request: FastifyRequest, rememberMe = true) {
  return {
    path: "/",
    httpOnly: false,
    sameSite: "strict" as const,
    secure: isSecureRequest(request),
    ...(rememberMe ? { maxAge: REFRESH_COOKIE_TTL_SEC } : {}),
  };
}

function setSessionCookies(reply: FastifyReply, request: FastifyRequest, refreshToken: string, rememberMe = true) {
  const csrfToken = randomUUID();
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(request, rememberMe));
  reply.setCookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions(request, rememberMe));
}

function clearSessionCookies(reply: FastifyReply, request: FastifyRequest) {
  reply.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(request));
  reply.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions(request));
}

function getRefreshTokenFromRequest(request: FastifyRequest): string | null {
  return request.cookies[REFRESH_COOKIE_NAME] || null;
}

function ensureCsrfForCookieSession(request: FastifyRequest, reply: FastifyReply): boolean {
  const cookieRefreshToken = request.cookies[REFRESH_COOKIE_NAME];
  if (!cookieRefreshToken) {
    return true;
  }

  const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
  const csrfHeader = request.headers["x-csrf-token"];
  const csrfValue = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

  if (!csrfCookie || !csrfValue || csrfCookie !== csrfValue) {
    reply.code(403).send({ error: "CSRF token missing or invalid" });
    return false;
  }

  return true;
}

async function logoutUserFromRefreshToken(refreshToken: string): Promise<string | undefined> {
  const refreshPayload = verifyToken(refreshToken);
  if (!refreshPayload) {
    return undefined;
  }

  if (refreshPayload.sub !== DEV_ADMIN_ID) {
    await query("DELETE FROM sessions WHERE token = $1 OR user_id = $2", [refreshToken, refreshPayload.sub]);
  }

  return refreshPayload.sub;
}

async function logoutUserFromAccessHeader(request: FastifyRequest): Promise<string | undefined> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return undefined;
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    return undefined;
  }

  if (payload.sub !== DEV_ADMIN_ID) {
    await query("DELETE FROM sessions WHERE user_id = $1", [payload.sub]);
  }

  return payload.sub;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/auth/register */
  app.post("/api/auth/register", async (request, reply) => {
    const { email, password, fullName, username, phoneNumber, rememberMe = true } = request.body as {
      email: string;
      password: string;
      fullName: string;
      username: string;
      phoneNumber?: string;
      rememberMe?: boolean;
    };

    if (!email || !password || !fullName || !username) {
      return reply.code(400).send({ error: "email, password, fullName, username مطلوبة" });
    }

    if (isConfiguredAdminEmail(email)) {
      return reply.code(403).send({ error: "هذا البريد مخصص لحساب إداري مُدار" });
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      return reply.code(400).send({ error: "صيغة البريد الإلكتروني غير صحيحة" });
    }

    // Password strength: minimum 8 characters
    if (password.length < 8) {
      return reply.code(400).send({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    }

    // Check duplicate by email or username
    const existing = await query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email, username],
    );
    if ((existing.rowCount ?? 0) > 0) {
      return reply.code(409).send({ error: "البريد الإلكتروني أو اسم المستخدم مسجل مسبقاً" });
    }

    const hash = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (email, username, full_name, name, password_hash, phone_number, phone)
       VALUES ($1, $2, $3, $3, $4, $5, $5)
       RETURNING id, role, username, full_name`,
      [email, username, fullName, hash, phoneNumber || null],
    );

    const user = result.rows[0];
    const accessToken = signAccessToken({ sub: user.id, role: user.role as UserRole, email });
    const refreshToken = signRefreshToken({ sub: user.id });
    setSessionCookies(reply, request, refreshToken, rememberMe);

    // Store session
    await query(
      "INSERT INTO sessions (user_id, token, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, now() + interval '7 days')",
      [user.id, refreshToken, request.ip, request.headers["user-agent"] || ""],
    );

    // Audit
    await query(
      "INSERT INTO audit_log (user_id, action, resource, ip, user_agent) VALUES ($1, $2, $3, $4, $5)",
      [user.id, "auth.register", "users", request.ip, request.headers["user-agent"] || ""],
    );

    return reply.code(201).send({
      accessToken,
      expiresIn: 86400, // 24h
      user: { id: user.id, email, username: user.username, fullName: user.full_name, role: user.role },
    });
  });

  /** POST /api/auth/login */
  app.post("/api/auth/login", async (request, reply) => {
    const { email, password, rememberMe = true } = request.body as { email: string; password: string; rememberMe?: boolean };

    if (!email || !password) {
      return reply.code(400).send({ error: "email و password مطلوبين" });
    }

    const isDevMode = process.env.NODE_ENV !== "production";
    const devAdminFallbackEnabled = isDevAdminFallbackEnabled(request);
    const hasDebugAdminCredentials = Boolean(DEV_ADMIN_EMAIL && DEV_ADMIN_PASSWORD);
    const isTestAdmin = hasDebugAdminCredentials && email === DEV_ADMIN_EMAIL && password === DEV_ADMIN_PASSWORD;

    if (devAdminFallbackEnabled && isTestAdmin) {
      const testUser = {
        id: DEV_ADMIN_ID,
        email: DEV_ADMIN_EMAIL,
        name: "Test Admin",
        role: "superadmin" as UserRole,
      };
      const accessToken = signAccessToken({ sub: testUser.id, role: testUser.role, email: testUser.email });
      const refreshToken = signRefreshToken({ sub: testUser.id });
      setSessionCookies(reply, request, refreshToken, rememberMe);

      app.log.info({ email }, "dev_mode_test_admin_login");

      return reply.send({
        accessToken,
        expiresIn: 86400,
        user: testUser,
      });
    }

    try {
      // Allow login by email OR username for admin fallbacks and convenience.
      const result = await query(
        `SELECT
           id,
           email,
           password_hash,
           COALESCE(NULLIF(full_name, ''), NULLIF(name, ''), split_part(email, '@', 1)) AS full_name,
           COALESCE(NULLIF(username, ''), split_part(email, '@', 1)) AS username,
           role,
           status
         FROM users
         WHERE email = $1 OR username = $1`,
        [email],
      );

      if ((result.rowCount ?? 0) === 0) {
        return reply.code(401).send({ error: "بريد إلكتروني أو كلمة مرور خاطئة" });
      }

      const user = result.rows[0];

      if (user.status === "banned") {
        return reply.code(403).send({ error: "تم حظر هذا الحساب" });
      }

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return reply.code(401).send({ error: "بريد إلكتروني أو كلمة مرور خاطئة" });
      }

      const role = effectiveUserRole(user.email, user.role as UserRole);
      if (role !== user.role) {
        await query("UPDATE users SET role = $1 WHERE id = $2", [role, user.id]);
      }
      const accessToken = signAccessToken({ sub: user.id, role, email: user.email });
      const refreshToken = signRefreshToken({ sub: user.id });
      setSessionCookies(reply, request, refreshToken, rememberMe);

      await query(
        "INSERT INTO sessions (user_id, token, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, now() + interval '7 days')",
        [user.id, refreshToken, request.ip, request.headers["user-agent"] || ""],
      );

      await query("UPDATE users SET last_login = now() WHERE id = $1", [user.id]);

      await query(
        "INSERT INTO audit_log (user_id, action, resource, ip, user_agent) VALUES ($1, $2, $3, $4, $5)",
        [user.id, "auth.login", "sessions", request.ip, request.headers["user-agent"] || ""],
      );

      return reply.send({
        accessToken,
        expiresIn: 86400,
        user: { id: user.id, email: user.email, username: user.username, fullName: user.full_name, role },
      });
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        request.log.warn({ err: error, devAdminFallbackEnabled }, "auth_login_database_unavailable");
        return reply.code(503).send({
          error: isDevMode ? getLoginUnavailableMessage(request) : "خدمة تسجيل الدخول غير متاحة حالياً",
        });
      }

      throw error;
    }
  });

  /** POST /api/auth/google */
  app.get("/api/auth/google/config", async (_request, reply) => {
    const clientId = getGoogleClientId();
    return reply.send({
      enabled: Boolean(clientId),
      clientId,
    });
  });

  /** POST /api/auth/google */
  app.post("/api/auth/google", async (request, reply) => {
    const { credential, rememberMe = true } = request.body as { credential?: string; rememberMe?: boolean };
    const isDevMode = process.env.NODE_ENV !== "production";
    request.log.info({ hasCredential: Boolean(credential?.trim()), rememberMe }, "google_auth_start");

    if (!credential?.trim()) {
      return reply.code(400).send({ error: "بيانات Google غير مكتملة" });
    }

    let googleIdentity: GoogleTokenInfo | null;
    try {
      googleIdentity = await verifyGoogleCredential(credential.trim());
    } catch (error) {
      if (error instanceof Error && error.message === "GOOGLE_AUTH_NOT_CONFIGURED") {
        return reply.code(503).send({ error: "تسجيل الدخول عبر Google غير مهيأ حالياً" });
      }

      throw error;
    }

    if (!googleIdentity?.email) {
      return reply.code(401).send({ error: "تعذر التحقق من حساب Google" });
    }

    request.log.info({
      googleSubPresent: Boolean(googleIdentity.sub),
      emailPresent: Boolean(googleIdentity.email),
    }, "google_auth_google_payload_verified");

    const email = googleIdentity.email.trim().toLowerCase();
    const fullName = normalizeGoogleDisplayName(googleIdentity.name, email);

    try {
      const existingUserResult = await query<AuthenticatedUserRow>(
        `SELECT
           id,
           email,
           COALESCE(NULLIF(full_name, ''), NULLIF(name, ''), split_part(email, '@', 1)) AS full_name,
           COALESCE(NULLIF(username, ''), split_part(email, '@', 1)) AS username,
           role,
           status
         FROM public.users
         WHERE email = $1`,
        [email],
      );

      let user = existingUserResult.rows[0] as AuthenticatedUserRow | undefined;
      if (user?.status === "banned") {
        return reply.code(403).send({ error: "تم حظر هذا الحساب" });
      }

      if (user) {
        const role = effectiveUserRole(email, user.role);
        await query(
          `UPDATE public.users
           SET last_login = now(), role = $3,
               full_name = CASE
                 WHEN full_name IS NULL OR btrim(full_name) = '' THEN $2
                 ELSE full_name
               END,
               name = CASE
                 WHEN name IS NULL OR btrim(name) = '' THEN $2
                 ELSE name
               END
           WHERE id = $1`,
          [user.id, fullName, role],
        );
        user.role = role;
      } else {
        const createdUserResult = await query<AuthenticatedUserRow>(
          `INSERT INTO public.users (email, username, full_name, name, password_hash, role, status, last_login)
           VALUES ($1, $2, $3, $3, '', $4, 'active', now())
           RETURNING id, email, full_name, username, role, status`,
          [email, buildGeneratedUsername(), fullName, effectiveUserRole(email, "public")],
        );

        user = createdUserResult.rows[0];
      }

      const role = effectiveUserRole(user.email, user.role);
      const accessToken = signAccessToken({ sub: user.id, role, email: user.email });
      const refreshToken = signRefreshToken({ sub: user.id });
      setSessionCookies(reply, request, refreshToken, rememberMe);

      await query(
        "INSERT INTO public.sessions (user_id, token, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, now() + interval '7 days')",
        [user.id, refreshToken, request.ip, request.headers["user-agent"] || ""],
      );

      await query(
        "INSERT INTO audit_log (user_id, action, resource, details, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)",
        [user.id, "auth.login.google", "sessions", { googleSub: googleIdentity.sub }, request.ip, request.headers["user-agent"] || ""],
      );

      const responsePayload = {
        accessToken,
        expiresIn: 86400,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          role,
        },
      };

      request.log.info({
        userId: user.id,
        userRole: user.role,
        responseKeys: Object.keys(responsePayload),
      }, "google_auth_success_response");

      return reply.send(responsePayload);
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        request.log.warn({ err: error }, "auth_google_database_unavailable");
        return reply.code(503).send({
          error: isDevMode ? getLoginUnavailableMessage(request) : "خدمة تسجيل الدخول غير متاحة حالياً",
        });
      }

      throw error;
    }
  });

  /** POST /api/auth/refresh */
  app.post("/api/auth/refresh", async (request, reply) => {
    if (!ensureCsrfForCookieSession(request, reply)) {
      return reply;
    }

    const refreshToken = getRefreshTokenFromRequest(request);
    if (!refreshToken) {
      return reply.code(401).send({ error: "جلسة التحديث غير موجودة" });
    }

    const payload = verifyToken(refreshToken);
    if (!payload) {
      return reply.code(401).send({ error: "توكن غير صالح أو منتهي الصلاحية" });
    }

    const isDevAdminSession = isDevAdminFallbackEnabled(request) && payload.sub === DEV_ADMIN_ID;

    if (!isDevAdminSession) {
      const session = await query(
        "SELECT id FROM sessions WHERE token = $1 AND expires_at > now()",
        [refreshToken],
      );
      if ((session.rowCount ?? 0) === 0) {
        clearSessionCookies(reply, request);
        return reply.code(401).send({ error: "الجلسة منتهية" });
      }
    }

    let u: { id: string; email: string; role: UserRole };
    if (isDevAdminSession) {
      u = { id: DEV_ADMIN_ID, email: DEV_ADMIN_EMAIL, role: "superadmin" };
    } else {
      const user = await query("SELECT id, email, role FROM users WHERE id = $1", [payload.sub]);
      if ((user.rowCount ?? 0) === 0) {
        clearSessionCookies(reply, request);
        return reply.code(401).send({ error: "المستخدم غير موجود" });
      }
      u = user.rows[0] as { id: string; email: string; role: UserRole };
      u.role = effectiveUserRole(u.email, u.role);
    }

    const newAccess = signAccessToken({ sub: u.id, role: u.role, email: u.email });
    const newRefresh = signRefreshToken({ sub: u.id });
    setSessionCookies(reply, request, newRefresh, true);

    // Rotate refresh token
    if (!isDevAdminSession) {
      await query("UPDATE sessions SET token = $1, expires_at = now() + interval '7 days' WHERE token = $2", [
        newRefresh,
        refreshToken,
      ]);
    }

    return reply.send({
      accessToken: newAccess,
      expiresIn: 86400,
    });
  });

  /** POST /api/auth/logout */
  app.post("/api/auth/logout", async (request, reply) => {
    if (!ensureCsrfForCookieSession(request, reply)) {
      return reply;
    }

    const refreshToken = getRefreshTokenFromRequest(request);
    const userId = refreshToken
      ? await logoutUserFromRefreshToken(refreshToken)
      : await logoutUserFromAccessHeader(request);

    if (userId) {
      await query(
        "INSERT INTO audit_log (user_id, action, resource, ip) VALUES ($1, $2, $3, $4)",
        [userId, "auth.logout", "sessions", request.ip],
      );
    }

    clearSessionCookies(reply, request);
    return reply.send({ ok: true });
  });

  async function sendAuthenticatedProfile(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: "غير مصرح" });
    }

    const result = await query(
      "SELECT id, email, name, phone, role, rank, military_id, region, status, created_at, last_login FROM users WHERE id = $1",
      [user.id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: "المستخدم غير موجود" });
    }

    return reply.send({ user: result.rows[0] });
  }

  /** GET /api/auth/me — return current user profile */
  app.get("/api/auth/me", sendAuthenticatedProfile);

  /** GET /api/me — compatibility alias used by current web-user profile loader */
  app.get("/api/me", sendAuthenticatedProfile);
}
