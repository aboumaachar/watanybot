/**
 * Admin user management API — list, update role/status, audit log.
 */
import type { FastifyInstance } from "fastify";
import { query } from "../lib/db.js";
import { requireRole } from "../auth/rbac.js";
import { broadcastToAdmins } from "../ws/admin-ws.js";
import { createWSEvent } from "../ws/events.js";

export async function adminUsersRoutes(app: FastifyInstance): Promise<void> {
  /* ────────────────────────────────────────────
     Users CRUD
     ──────────────────────────────────────────── */

  /** GET /api/admin/users — list all users with optional search */
  app.get("/api/admin/users", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { search, role, status, limit = 100, offset = 0 } = request.query as {
      search?: string;
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };

    try {
      let sql = "SELECT id, email, name, role, status, phone, rank, military_id, created_at FROM users WHERE 1=1";
      const params: unknown[] = [];
      let idx = 1;

      if (search) {
        sql += ` AND (name ILIKE $${idx} OR email ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }
      if (role) {
        sql += ` AND role = $${idx}`;
        params.push(role);
        idx++;
      }
      if (status) {
        sql += ` AND status = $${idx}`;
        params.push(status);
        idx++;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
      params.push(Number(limit), Number(offset));

      const result = await query(sql, params);

      // Get total count
      const countResult = await query("SELECT COUNT(*) as total FROM users");
      const total = countResult.rows[0]?.total ?? 0;

      return reply.send({ users: result.rows, total });
    } catch (err: any) {
      app.log.warn({ err: err.message }, "admin_users_list_fallback");
      return reply.send({ users: [], total: 0 });
    }
  });

  /** PUT /api/admin/users/:id/role — change user role */
  app.put("/api/admin/users/:id/role", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: string };
    const adminUser = (request as any).user;

    const valid = ["public", "accredited", "driver", "moderator", "admin", "superadmin"];
    if (!valid.includes(role)) {
      return reply.code(400).send({ error: "صلاحية غير صالحة" });
    }

    // Only superadmin can promote to admin/superadmin
    if ((role === "admin" || role === "superadmin") && adminUser?.role !== "superadmin") {
      return reply.code(403).send({ error: "فقط المشرف العام يمكنه ترقية المستخدمين إلى مشرف" });
    }

    try {
      const result = await query(
        "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role, status",
        [role, id],
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: "المستخدم غير موجود" });
      }

      // Audit log
      await query(
        "INSERT INTO audit_log (user_id, action, resource, details) VALUES ($1, $2, $3, $4)",
        [adminUser?.id ?? null, "user.role_change", "users", JSON.stringify({ targetUserId: id, newRole: role })],
      );

      broadcastToAdmins(createWSEvent("user", { action: "role_change", userId: id, newRole: role }));

      return reply.send({ user: result.rows[0] });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  /** PUT /api/admin/users/:id/status — ban/unban user */
  app.put("/api/admin/users/:id/status", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const adminUser = (request as any).user;

    const valid = ["active", "banned", "suspended"];
    if (!valid.includes(status)) {
      return reply.code(400).send({ error: "حالة غير صالحة" });
    }

    try {
      const result = await query(
        "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role, status",
        [status, id],
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: "المستخدم غير موجود" });
      }

      await query(
        "INSERT INTO audit_log (user_id, action, resource, details) VALUES ($1, $2, $3, $4)",
        [adminUser?.id ?? null, "user.status_change", "users", JSON.stringify({ targetUserId: id, newStatus: status })],
      );

      broadcastToAdmins(createWSEvent("user", { action: "status_change", userId: id, newStatus: status }));

      return reply.send({ user: result.rows[0] });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  /* ────────────────────────────────────────────
     Audit Log
     ──────────────────────────────────────────── */

  /** GET /api/admin/audit — paginated audit log */
  app.get("/api/admin/audit", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { action, search, limit = 50, offset = 0 } = request.query as {
      action?: string;
      search?: string;
      limit?: number;
      offset?: number;
    };

    try {
      let sql = `SELECT al.id, al.user_id, al.action, al.resource, al.details, al.created_at,
                        u.name as user_name, u.email as user_email
                 FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
                 WHERE 1=1`;
      const params: unknown[] = [];
      let idx = 1;

      if (action) {
        sql += ` AND al.action = $${idx}`;
        params.push(action);
        idx++;
      }
      if (search) {
        sql += ` AND (al.details::text ILIKE $${idx} OR al.action ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
      }

      sql += ` ORDER BY al.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
      params.push(Number(limit), Number(offset));

      const result = await query(sql, params);

      const countResult = await query("SELECT COUNT(*) as total FROM audit_log");
      const total = countResult.rows[0]?.total ?? 0;

      return reply.send({ entries: result.rows, total });
    } catch (err: any) {
      app.log.warn({ err: err.message }, "admin_audit_fallback");
      return reply.send({ entries: [], total: 0 });
    }
  });

  /* ────────────────────────────────────────────
     Chat Sessions (for monitor)
     ──────────────────────────────────────────── */

  /** GET /api/admin/chat-sessions — list chat sessions */
  app.get("/api/admin/chat-sessions", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };

    try {
      const result = await query(
        `SELECT cs.id, cs.user_id, cs.channel, cs.started_at, cs.last_message_at, cs.message_count, cs.status,
                u.name as user_name, u.email as user_email
         FROM chat_sessions cs LEFT JOIN users u ON cs.user_id = u.id
         ORDER BY cs.last_message_at DESC LIMIT $1 OFFSET $2`,
        [Number(limit), Number(offset)],
      );
      return reply.send({ sessions: result.rows });
    } catch (err: any) {
      app.log.warn({ err: err.message }, "admin_chat_sessions_fallback");
      return reply.send({ sessions: [] });
    }
  });

  /** GET /api/admin/chat-sessions/:id/messages — get messages in a session */
  app.get("/api/admin/chat-sessions/:id/messages", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await query(
        `SELECT id, session_id, role, content, flagged, created_at
         FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
        [id],
      );
      return reply.send({ messages: result.rows });
    } catch (err: any) {
      app.log.warn({ err: err.message }, "admin_chat_messages_fallback");
      return reply.send({ messages: [] });
    }
  });

  /** POST /api/admin/chat-messages/:id/flag — flag a message */
  app.post("/api/admin/chat-messages/:id/flag", { preHandler: [requireRole("moderator")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const adminUser = (request as any).user;

    try {
      await query("UPDATE chat_messages SET flagged = true WHERE id = $1", [id]);
      await query(
        "INSERT INTO audit_log (user_id, action, resource, details) VALUES ($1, $2, $3, $4)",
        [adminUser?.id ?? null, "moderation.flag", "chat_messages", JSON.stringify({ messageId: id, reason: reason ?? "admin_flagged" })],
      );

      broadcastToAdmins(createWSEvent("moderation", { action: "flag", messageId: id, reason }));

      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  /* ────────────────────────────────────────────
     KPI endpoint for real-time metrics
     ──────────────────────────────────────────── */

  /** GET /api/admin/kpis — real-time KPIs from PostgreSQL */
  app.get("/api/admin/kpis", { preHandler: [requireRole("admin")] }, async (_request, reply) => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [usersResult, chatResult, flaggedResult, recentResult] = await Promise.all([
        query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM users"),
        query(`SELECT COUNT(*) as total FROM chat_sessions WHERE started_at >= $1`, [today]),
        query("SELECT COUNT(*) as total FROM chat_messages WHERE flagged = true"),
        query("SELECT COUNT(*) as total FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
      ]);

      return reply.send({
        kpis: {
          totalUsers: usersResult.rows[0]?.total ?? 0,
          activeUsers: usersResult.rows[0]?.active ?? 0,
          dailyConversations: chatResult.rows[0]?.total ?? 0,
          flaggedMessages: flaggedResult.rows[0]?.total ?? 0,
          newUsersWeek: recentResult.rows[0]?.total ?? 0,
        },
      });
    } catch {
      return reply.send({
        kpis: {
          totalUsers: 0,
          activeUsers: 0,
          dailyConversations: 0,
          flaggedMessages: 0,
          newUsersWeek: 0,
        },
      });
    }
  });
}
