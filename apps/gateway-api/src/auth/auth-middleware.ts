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

const JWT_EXPIRES_IN_SEC = Number(process.env.JWT_EXPIRES_IN_SEC || "86400"); // 24h
const JWT_REFRESH_EXPIRES_IN_SEC = Number(process.env.JWT_REFRESH_EXPIRES_IN_SEC || "604800"); // 7d

const SUPERADMIN_ROUTE_PREFIXES = [
  "/api/superadmin",
  "/api/admin/payments",
  "/api/admin/procedures",
  "/api/admin/recruitment",
  "/api/admin-authority",
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

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/** Sign a JWT access token. */
export function signAccessToken(payload: { sub: string; role: UserRole; email: string }): string {
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
      request.user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
      };
    }
  });
}
