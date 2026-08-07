import { randomUUID } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import { requireRole } from "../auth/rbac.js";

interface NewsItemBody {
  title: string;
  body?: string;
  category?: string;
  image_url?: string;
  source_url?: string;
  is_published?: number;
  published_at?: number;
}

export const adminNewsRoutes: FastifyPluginAsync = async (app) => {
  // GET /admin/news — list all (published + draft)
  app.get("/admin/news", { preHandler: requireRole("admin") }, async (_req, reply) => {
    const rows = app.pluginDb
      .prepare("SELECT * FROM news_items ORDER BY published_at DESC")
      .all();
    reply.send(rows);
  });

  // POST /admin/news — create
  app.post<{ Body: NewsItemBody }>(
    "/admin/news",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const { title, body, category, image_url, source_url, is_published, published_at } =
        req.body ?? {};
      if (!title?.trim()) {
        return reply.status(400).send({ error: "العنوان مطلوب" });
      }

      const now = Date.now();
      const id = randomUUID();
      app.pluginDb
        .prepare(
          `INSERT INTO news_items
            (id, title, body, category, image_url, source_url, is_published, published_at, created_at, updated_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          title.trim(),
          body ?? null,
          category ?? null,
          image_url ?? null,
          source_url ?? null,
          is_published !== undefined ? is_published : 1,
          published_at !== undefined ? published_at : now,
          now,
          now,
          (req as any).user?.phone ?? null
        );

      const row = app.pluginDb
        .prepare("SELECT * FROM news_items WHERE id = ?")
        .get(id);
      reply.status(201).send(row);
    }
  );

  // PATCH /admin/news/:id — update
  app.patch<{ Params: { id: string }; Body: Partial<NewsItemBody> }>(
    "/admin/news/:id",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const { id } = req.params;
      const existing = app.pluginDb
        .prepare("SELECT * FROM news_items WHERE id = ?")
        .get(id) as any;
      if (!existing) return reply.status(404).send({ error: "not found" });

      const { title, body, category, image_url, source_url, is_published, published_at } =
        req.body ?? {};

      app.pluginDb
        .prepare(
          `UPDATE news_items SET
            title       = COALESCE(?, title),
            body        = COALESCE(?, body),
            category    = COALESCE(?, category),
            image_url   = COALESCE(?, image_url),
            source_url  = COALESCE(?, source_url),
            is_published = COALESCE(?, is_published),
            published_at = COALESCE(?, published_at),
            updated_at  = ?
           WHERE id = ?`
        )
        .run(
          title?.trim() ?? null,
          body ?? null,
          category ?? null,
          image_url ?? null,
          source_url ?? null,
          is_published !== undefined ? is_published : null,
          published_at !== undefined ? published_at : null,
          Date.now(),
          id
        );

      const row = app.pluginDb
        .prepare("SELECT * FROM news_items WHERE id = ?")
        .get(id);
      reply.send(row);
    }
  );

  // DELETE /admin/news/:id
  app.delete<{ Params: { id: string } }>(
    "/admin/news/:id",
    { preHandler: requireRole("admin") },
    async (req, reply) => {
      const { id } = req.params;
      const changes = (
        app.pluginDb.prepare("DELETE FROM news_items WHERE id = ?").run(id)
      ).changes;
      if (!changes) return reply.status(404).send({ error: "not found" });
      reply.send({ ok: true });
    }
  );
};
