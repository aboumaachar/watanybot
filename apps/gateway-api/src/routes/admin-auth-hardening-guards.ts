import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authorizePrincipal } from "../auth/rbac.js";

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

const SUPERADMIN_ROUTE_PREFIXES = ["/api/admin/procedures"] as const;

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

function sendAuthFailure(reply: FastifyReply, statusCode: 401 | 403, reason: string) {
  const code = reason === "NO_AUTHENTICATED_PRINCIPAL" ? "UNAUTHORIZED" : "FORBIDDEN";
  return reply.code(statusCode).send({ ok: false, error: code, code });
}

export async function registerAdminAuthHardeningGuards(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    const path = normalizePath(request);
    const requiresSuperAdmin = matchesAnyPathOrChild(path, SUPERADMIN_ROUTE_PREFIXES);
    const requiresAdmin = !requiresSuperAdmin && matchesAnyPathOrChild(path, ADMIN_ROUTE_PREFIXES);

    if (!requiresSuperAdmin && !requiresAdmin) return;

    const decision = authorizePrincipal(request, { minRole: requiresSuperAdmin ? "superadmin" : "admin" });
    if (!decision.allowed) {
      return sendAuthFailure(reply, decision.statusCode === 401 ? 401 : 403, decision.reason);
    }
  });
}
