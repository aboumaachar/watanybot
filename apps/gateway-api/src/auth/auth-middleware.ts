/**
 * JWT auth middleware for Fastify.
 *
 * Attaches `request.user` with { id, role, email } on every authenticated request.
 * Routes that don't need auth can opt-out via the `public` decorator.
 */
import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import type { UserRole, JWTPayload } from "@watany/types";
import { requireRole } from "./rbac.js";
import { query } from "../lib/db.js";

const JWT_EXPIRES_IN_SEC = Number(process.env.JWT_EXPIRES_IN_SEC || "86400"); // 24h
const JWT_REFRESH_EXPIRES_IN_SEC = Number(process.env.JWT_REFRESH_EXPIRES_IN_SEC || "604800"); // 7d

const SUPERADMIN_ROUTE_PREFIXES = [
  "/api/superadmin",
  "/api/admin/payments",
  "/api/admin/procedures",
  "/api/admin/recruitment",
  "/api/admin-authority",
] as const;

const ADMIN_AUTH_ROUTE_PREFIXES = [
  "/api/admin",
  "/api/superadmin",
  "/api/admin-authority",
  "/admin",
  "/admin-authority",
] as const;

function resolveDefaultProtectedRole(url: string): UserRole | null {
  if (SUPERADMIN_ROUTE_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return "superadmin";
  }

  if (url.startsWith("/api/admin")) {
    return "admin";
  }

  return null;
}

function requireJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  return jwtSecret;
}

function getJwtSecret(): string | null {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  return jwtSecret || null;
}

function isAdministrativePath(url: string): boolean {
  return ADMIN_AUTH_ROUTE_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`));
}

async function resolveFreshAdminUser(payload: JWTPayload): Promise<AuthUser | null> {
  try {
    if (typeof payload.sid !== "string" || !payload.sid.trim()) {
      return null;
    }

    const result = await query<{ id: string; email: string; role: UserRole }>(
      "SELECT id, email, role FROM users WHERE id = $1 AND status = 'active'",
      [payload.sub],
    );
    const user = result.rows[0];
    if (!user) return null;

    const session = await query<{ id: string }>(
      "SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND expires_at > now()",
      [payload.sid, user.id],
    );
    if (!session.rows[0]) return null;

    return { id: user.id, email: user.email, role: user.role, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  sessionId?: string;
}

export async function createAuthSession(input: {
  userId: string;
  refreshToken: string;
  ip?: string;
  userAgent?: string;
}): Promise<string> {
  const result = await query<{ id: string }>(
    "INSERT INTO sessions (user_id, token, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, now() + interval '7 days') RETURNING id",
    [input.userId, input.refreshToken, input.ip ?? null, input.userAgent ?? ""],
  );
  const sessionId = result.rows[0]?.id;
  if (!sessionId) {
    throw new Error("AUTH_SESSION_CREATION_FAILED");
  }
  return sessionId;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/** Sign a JWT access token. */
export function signAccessToken(payload: { sub: string; role: UserRole; email: string; sid?: string }): string {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: JWT_EXPIRES_IN_SEC });
}

/** Sign a JWT refresh token. */
export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, requireJwtSecret(), { expiresIn: JWT_REFRESH_EXPIRES_IN_SEC });
}

/** Verify and decode a JWT token. Returns null on failure. */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, requireJwtSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Register the auth preHandler on the Fastify instance.
 * Skips routes decorated with `{ public: true }`.
 */
export function registerAuthHook(app: FastifyInstance): void {
  app.decorateRequest("user", undefined);

  app.addHook("onRoute", (routeOptions) => {
    const requiredRole = resolveDefaultProtectedRole(routeOptions.url);
    if (!requiredRole) {
      return;
    }

    const routeConfig = ((routeOptions as { config?: { public?: boolean } }).config) || {};
    if (routeConfig.public === true) {
      return;
    }

    const preHandler = (routeOptions as { preHandler?: unknown }).preHandler;
    if (preHandler) {
      return;
    }

    (routeOptions as { preHandler?: unknown }).preHandler = [requireRole(requiredRole)];
  });

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip health and public endpoints
    const publicPaths = [
      "/healthz",
      "/api/health",
      "/api/auth/google",
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/refresh",
      "/api/auth/otp/request",
      "/api/auth/otp/verify",
      "/api/salary/meta",
      "/api/salary/compute",
      "/api/pension/attestation",
      "/api/forms",
      "/api/search",
      "/api/chat",
      "/api/chat/stream",
      "/api/tx",
    ];

    const isPublic = publicPaths.some(p => request.url.startsWith(p));
    if (isPublic) return;

    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      // Allow unauthenticated access but don't set user
      return;
    }

    const token = authHeader.slice(7);
    const payload = (() => {
      try {
        return jwt.verify(token, jwtSecret) as JWTPayload;
      } catch {
        return null;
      }
    })();
    if (payload) {
      if (isAdministrativePath(request.url)) {
        const freshUser = await resolveFreshAdminUser(payload);
        if (freshUser) request.user = freshUser;
      } else {
        request.user = {
          id: payload.sub,
          role: payload.role,
          email: payload.email,
        };
      }
    }
  });
}
