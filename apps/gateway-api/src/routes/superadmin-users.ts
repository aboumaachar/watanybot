import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getSuperadminUsersDashboard, setSuperadminUserRole } from "../superadmin/superadmin-users.service";
import {
  isSuperadminLike,
  SUPERADMIN_USER_MANAGEMENT_POLICY,
} from "../superadmin/superadmin-users.policy";
import { buildIpAuditRecord } from "../middleware/ip-audit";

function hasSuperadminAccess(req: FastifyRequest): boolean {
  // Dev-only guard: accepted via x-watany-role header in non-production.
  // In production, replace with the real Watany JWT/RBAC guard (request.user).
  if (process.env.NODE_ENV !== "production") {
    const devRole = req.headers["x-watany-role"];
    if (isSuperadminLike(devRole)) return true;
  }
  // Production path: real JWT user must have superadmin role.
  const user = (req as FastifyRequest & { user?: { role?: string } }).user;
  return isSuperadminLike(user?.role);
}

async function guardSuperadmin(request: FastifyRequest, reply: FastifyReply) {
  if (!hasSuperadminAccess(request)) {
    return reply.status(403).send({
      error: "SUPERADMIN_REQUIRED",
      policy: SUPERADMIN_USER_MANAGEMENT_POLICY,
      message: "Superadmin user management is restricted to SUPERADMIN only.",
    });
  }
}

export async function registerSuperadminUsersRoutes(app: FastifyInstance) {
  // GET /api/superadmin/users
  app.get<{ Querystring: { q?: string; status?: string; role?: string } }>(
    "/api/superadmin/users",
    { preHandler: [guardSuperadmin] },
    async (request, reply) => {
      const { q, status, role } = request.query;
      const dashboard = await getSuperadminUsersDashboard({ q, status, role });
      return reply.send(dashboard);
    }
  );

  // GET /api/superadmin/users/active
  app.get(
    "/api/superadmin/users/active",
    { preHandler: [guardSuperadmin] },
    async (_request, reply) => {
      const dashboard = await getSuperadminUsersDashboard({});
      return reply.send(dashboard.activeUsers);
    }
  );

  // PATCH /api/superadmin/users/:userId/role
  app.patch<{ Params: { userId: string }; Body: { role?: string } }>(
    "/api/superadmin/users/:userId/role",
    { preHandler: [guardSuperadmin] },
    async (request, reply) => {
      const role = request.body?.role;
      if (!role) {
        return reply.status(400).send({ error: "ROLE_REQUIRED" });
      }

      try {
        const user = await setSuperadminUserRole(request.params.userId, role);
        return reply.send({ ok: true, user });
      } catch (error) {
        const message = error instanceof Error ? error.message : "ROLE_ASSIGNMENT_FAILED";
        const statusCode = message === "USER_NOT_FOUND" ? 404 : 400;
        return reply.status(statusCode).send({ error: message });
      }
    }
  );

  // GET /api/superadmin/users/birthdays
  app.get(
    "/api/superadmin/users/birthdays",
    { preHandler: [guardSuperadmin] },
    async (_request, reply) => {
      const dashboard = await getSuperadminUsersDashboard({});
      return reply.send(dashboard.birthdays);
    }
  );

  // POST /api/superadmin/users/:userId/ip-audit-preview
  app.post<{ Params: { userId: string } }>(
    "/api/superadmin/users/:userId/ip-audit-preview",
    { preHandler: [guardSuperadmin] },
    async (request, reply) => {
      return reply.send({
        record: buildIpAuditRecord(request, request.params.userId),
        note: "Preview only. Persist through the real IP audit database adapter.",
      });
    }
  );

  // POST /api/superadmin/users/:userId/action
  app.post<{ Params: { userId: string } }>(
    "/api/superadmin/users/:userId/action",
    { preHandler: [guardSuperadmin] },
    async (_request, reply) => {
      return reply.status(501).send({
        error: "USER_ACTIONS_NOT_WIRED",
        message:
          "vBulletin-like user actions (ban/suspend/warn/reset) require connection to the real Watany user/auth database first.",
      });
    }
  );
}
