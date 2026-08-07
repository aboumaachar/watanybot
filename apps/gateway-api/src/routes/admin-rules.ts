/**
 * Admin rule management API — CRUD for content filter rules.
 */
import type { FastifyInstance } from "fastify";
import { query } from "../lib/db.js";
import { requireRole } from "../auth/rbac.js";
import { refreshRules, getActiveRules } from "../filters/content-filter.js";

export async function adminRulesRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/admin/rules — list all filter rules */
  app.get("/api/admin/rules", { preHandler: [requireRole("admin")] }, async (_request, reply) => {
    try {
      const result = await query(
        "SELECT id, name, pattern, severity, action, enabled, description, created_at, updated_at FROM filter_rules ORDER BY created_at",
      );
      return reply.send({ rules: result.rows });
    } catch {
      // Fallback to in-memory defaults
      return reply.send({ rules: getActiveRules() });
    }
  });

  /** POST /api/admin/rules — create a new filter rule */
  app.post("/api/admin/rules", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { name, pattern, severity, action, enabled, description } = request.body as {
      name: string;
      pattern: string;
      severity: string;
      action: string;
      enabled?: boolean;
      description?: string;
    };

    if (!name || !pattern || !severity || !action) {
      return reply.code(400).send({ error: "name, pattern, severity, action مطلوبين" });
    }

    // Validate regex
    try {
      new RegExp(pattern);
    } catch {
      return reply.code(400).send({ error: "نمط التعبير العادي غير صالح" });
    }

    const result = await query(
      `INSERT INTO filter_rules (name, pattern, severity, action, enabled, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, pattern, severity, action, enabled ?? true, description ?? null],
    );

    await refreshRules();
    return reply.code(201).send({ rule: result.rows[0] });
  });

  /** PUT /api/admin/rules/:id — update a filter rule */
  app.put("/api/admin/rules/:id", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, pattern, severity, action, enabled, description } = request.body as {
      name?: string;
      pattern?: string;
      severity?: string;
      action?: string;
      enabled?: boolean;
      description?: string;
    };

    // Validate regex if provided
    if (pattern) {
      try {
        new RegExp(pattern);
      } catch {
        return reply.code(400).send({ error: "نمط التعبير العادي غير صالح" });
      }
    }

    const result = await query(
      `UPDATE filter_rules SET
        name = COALESCE($2, name),
        pattern = COALESCE($3, pattern),
        severity = COALESCE($4, severity),
        action = COALESCE($5, action),
        enabled = COALESCE($6, enabled),
        description = COALESCE($7, description),
        updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, name ?? null, pattern ?? null, severity ?? null, action ?? null, enabled ?? null, description ?? null],
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: "القاعدة غير موجودة" });
    }

    await refreshRules();
    return reply.send({ rule: result.rows[0] });
  });

  /** DELETE /api/admin/rules/:id — delete a filter rule */
  app.delete("/api/admin/rules/:id", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query("DELETE FROM filter_rules WHERE id = $1", [id]);

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: "القاعدة غير موجودة" });
    }

    await refreshRules();
    return reply.send({ ok: true });
  });
}
