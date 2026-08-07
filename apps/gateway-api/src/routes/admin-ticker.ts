import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac.js";
import { randomUUID } from "crypto";

export async function adminTickerRoutes(app: FastifyInstance): Promise<void> {
  // list existing ticker items
  app.get("/api/admin/ticker/items", { preHandler: [requireRole("admin")] }, async (_req, reply) => {
    const rows = app.pluginDb.prepare("SELECT * FROM ticker_items ORDER BY priority DESC, created_at DESC").all();
    return reply.send({ items: rows });
  });

  // create new item
  app.post("/api/admin/ticker/items", { preHandler: [requireRole("admin")] }, async (req, reply) => {
    const {
      type,
      title,
      body,
      link_type,
      link_id,
      priority,
      starts_at,
      ends_at,
      created_by,
    } = req.body as any;
    if (!type || !title) {
      return reply.code(400).send({ error: "type and title required" });
    }
    // normalize synonyms
    const normType = type === "announcement" ? "announce" : type;
    const now = Date.now();
    const id = randomUUID();
    app.pluginDb
      .prepare(
        `INSERT INTO ticker_items (id,type,title,body,link_type,link_id,priority,starts_at,ends_at,created_at,updated_at,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        id,
        type,
        title,
        body || null,
        link_type || null,
        link_id || null,
        priority ?? 50,
        starts_at || null,
        ends_at || null,
        now,
        now,
        created_by || null,
      );
    const item = app.pluginDb.prepare("SELECT * FROM ticker_items WHERE id = ?").get(id);
    return reply.code(201).send({ item });
  });

  // edit/disable/expire
  app.patch<{ Params: { id: string }; Body: any }>(
    "/api/admin/ticker/items/:id",
    { preHandler: [requireRole("admin")] },
    async (req, reply) => {
      const { id } = req.params;
      const fields = req.body as any;
      if (fields.type === "announcement") fields.type = "announce";
      const assignments: string[] = [];
      const params: any[] = [];
      for (const key of [
        "type",
        "title",
        "body",
        "link_type",
        "link_id",
        "priority",
        "starts_at",
        "ends_at",
        "created_by",
      ]) {
        if (key in fields) {
          assignments.push(`${key} = ?`);
          params.push(fields[key]);
        }
      }
      if (assignments.length === 0) {
        return reply.code(400).send({ error: "nothing to update" });
      }
      params.push(Date.now(), id);
      const sql = `UPDATE ticker_items SET ${assignments.join(",")} , updated_at = ? WHERE id = ? RETURNING *`;
      const result = app.pluginDb.prepare(sql).get(...params);
      if (!result) {
        reply.code(404);
        return { error: "not found" };
      }
      return { item: result };
    },
  );

  // delete an item
  app.delete("/api/admin/ticker/items/:id", { preHandler: [requireRole("admin")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = app.pluginDb.prepare("DELETE FROM ticker_items WHERE id = ?").run(id);
    if (res.changes === 0) {
      reply.code(404);
      return { error: "not found" };
    }
    return { ok: true };
  });

  // recompute top faqs from analytics events
  app.post("/api/admin/ticker/recompute-faq", { preHandler: [requireRole("admin")] }, async (_req, reply) => {
    const rows = app.pluginDb
      .prepare(
        `SELECT text_hash, event_text, COUNT(*) as cnt
         FROM analytics_events
         WHERE event_type = 'chat_question' AND created_at > ?
         GROUP BY text_hash, event_text
         ORDER BY cnt DESC
         LIMIT 10`
      )
      .all(Date.now() - 24 * 60 * 60 * 1000) as Array<any>;
    const now = Date.now();
    for (const r of rows) {
      // upsert faq items keyed by hash
      const existing = app.pluginDb
        .prepare("SELECT id FROM ticker_items WHERE type = 'faq' AND link_type = 'hash' AND link_id = ?")
        .get(r.text_hash) as any;
      const id = existing ? existing.id : randomUUID();
      app.pluginDb
        .prepare(
          `INSERT OR REPLACE INTO ticker_items
           (id,type,title,priority,link_type,link_id,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?)`
        )
        .run(id, "faq", r.event_text, 50, "hash", r.text_hash, now, now);
    }
    return reply.send({ ok: true });
  });
}
