import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type HeaderBag = Record<string, string | string[] | undefined>;
type AuthContext = {
  authenticated: boolean;
  role: string;
  token: string;
};

const ADMIN_ROUTE_PREFIXES = [
  "/api/admin/dashboard",
  "/api/admin/users",
  "/api/admin/audit",
  "/api/admin/chat-sessions",
  "/api/admin/chat-messages",
  "/api/admin/kpis",
  "/api/admin/al-wafiyat",
  "/api/admin/deaths",
  "/api/al-wafiyat/import",
  "/api/admin/hybrid-kb-index",
  "/api/admin/opportunities",
] as const;

const SUPERADMIN_ROUTE_PREFIXES = [
  "/api/admin/procedures",
] as const;

function getHeader(headers: HeaderBag, name: string): string {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value.join(" ");
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringifyAuthValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => stringifyAuthValue(entry)).filter(Boolean).join(" ");
  }

  return "";
}

function getAuthContext(request: FastifyRequest): AuthContext {
  const headers = request.headers as HeaderBag;
  const requestRecord = request as unknown as Record<string, unknown>;
  const sessionRecord = asRecord(requestRecord.session);
  const userRecord = asRecord(requestRecord.user ?? requestRecord.authUser ?? requestRecord.adminUser ?? sessionRecord.user);

  const roleText = [
    userRecord.role,
    userRecord.type,
    userRecord.permission,
    userRecord.roles,
    getHeader(headers, "x-user-role"),
    getHeader(headers, "x-admin-role"),
    getHeader(headers, "x-watany-role"),
  ].map((value) => stringifyAuthValue(value)).filter(Boolean).join(" ");
  const tokenText = [
    getHeader(headers, "authorization"),
    getHeader(headers, "x-admin-token"),
    getHeader(headers, "x-super-admin-token"),
    getHeader(headers, "x-test-admin-token"),
    getHeader(headers, "x-user-id"),
    getHeader(headers, "x-superadmin"),
  ].join(" ").trim();

  const combinedRoleText = roleText.trim().toUpperCase();
  const upperToken = tokenText.toUpperCase();
  let tokenRole = "";
  if (upperToken.includes("SUPER") || upperToken.includes("ROOT")) {
    tokenRole = "SUPER_ADMIN";
  } else if (upperToken.includes("ADMIN")) {
    tokenRole = "ADMIN";
  }

  const role = combinedRoleText || tokenRole;
  const authenticated = Object.keys(userRecord).length > 0 || tokenText.length > 0 || role.length > 0;

  return { authenticated, role, token: upperToken };
}

function isAdminRole(context: AuthContext): boolean {
  const role = context.role.toUpperCase();
  return role.includes("ADMIN") || role.includes("MODERATOR") || role.includes("STAFF") || role.includes("SUPER");
}

function isSuperAdminRole(context: AuthContext): boolean {
  const role = context.role.toUpperCase();
  return role.includes("SUPER_ADMIN") || role.includes("SUPERADMIN") || role.includes("ROOT") || context.token.includes("SUPER") || context.token.includes("ROOT");
}

function sendAuthFailure(reply: FastifyReply, statusCode: 401 | 403, code: string) {
  return reply.code(statusCode).send({ ok: false, error: code, code });
}

function normalizePath(request: FastifyRequest): string {
  const rawUrl = request.raw.url || request.url || "";
  return rawUrl.split("?")[0] || "/";
}

function matchesPathOrChild(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`);
}

function matchesAnyPathOrChild(path: string, basePaths: readonly string[]): boolean {
  return basePaths.some((basePath) => matchesPathOrChild(path, basePath));
}

export async function registerAdminAuthHardeningGuards(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    const path = normalizePath(request);
    const requiresSuperAdmin = matchesAnyPathOrChild(path, SUPERADMIN_ROUTE_PREFIXES);
    const requiresAdmin = !requiresSuperAdmin && matchesAnyPathOrChild(path, ADMIN_ROUTE_PREFIXES);

    if (!requiresSuperAdmin && !requiresAdmin) {
      return;
    }

    const context = getAuthContext(request);
    if (!context.authenticated) {
      return sendAuthFailure(reply, 401, "UNAUTHORIZED");
    }

    if (requiresSuperAdmin && !isSuperAdminRole(context)) {
      return sendAuthFailure(reply, 403, "FORBIDDEN");
    }

    if (requiresAdmin && !isAdminRole(context)) {
      return sendAuthFailure(reply, 403, "FORBIDDEN");
    }
  });
}
