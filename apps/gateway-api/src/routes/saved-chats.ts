/**
 * Saved chats routes — list, create, delete.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb, SavedChatItem } from "../types/domain";
import { makeId, normalizeText, mapSavedRow, requireAuth } from "../lib/helpers";

interface SavedChatsRoutesOptions {
  pluginDb: PluginDb;
}

const VALID_SAVED_CHAT_STATUSES = new Set<SavedChatItem["status"]>(["active", "closed", "archived", "deleted_for_me"]);

function resolveSavedChatTimeline(status: SavedChatItem["status"], existing?: SavedChatItem) {
  const now = Date.now();

  if (status === "active") {
    return {
      updatedAt: now,
      closedAt: undefined,
      archivedAt: undefined,
      deletedForMeAt: undefined,
    };
  }

  if (status === "closed") {
    return {
      updatedAt: now,
      closedAt: existing?.closedAt ?? now,
      archivedAt: existing?.archivedAt,
      deletedForMeAt: undefined,
    };
  }

  if (status === "archived") {
    return {
      updatedAt: now,
      closedAt: existing?.closedAt,
      archivedAt: existing?.archivedAt ?? now,
      deletedForMeAt: undefined,
    };
  }

  return {
    updatedAt: now,
    closedAt: existing?.closedAt,
    archivedAt: existing?.archivedAt,
    deletedForMeAt: existing?.deletedForMeAt ?? now,
  };
}

export const savedChatsRoutes: FastifyPluginAsync<SavedChatsRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/saved", async (_req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) return { items: [] } as const;
    const userId = "default";
    const rows = pluginDb
      .prepare("SELECT * FROM saved_chats WHERE user_id = ? ORDER BY COALESCE(updated_at, ts) DESC")
      .all(userId) as Array<Record<string, unknown>>;
    return { items: rows.map(mapSavedRow) } as const;
  });

  app.post<{ Body: { text?: string } }>("/api/saved", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) return { error: "unauthorized" } as const;
    const text = normalizeText(req.body?.text);
    if (!text) {
      reply.code(400);
      return { error: "text required" } as const;
    }
    const userId = "default";
    const now = Date.now();
    const item: SavedChatItem = {
      id: makeId("saved"),
      text,
      ts: now,
      status: "active",
      updatedAt: now,
    };
    pluginDb.prepare("INSERT INTO saved_chats (id, user_id, text, ts, status, updated_at, closed_at, archived_at, deleted_for_me_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      item.id,
      userId,
      item.text,
      item.ts,
      item.status,
      item.updatedAt,
      null,
      null,
      null,
    );
    return item;
  });

  app.patch<{ Params: { id: string }; Body: { status?: SavedChatItem["status"] } }>("/api/saved/:id", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) return { error: "unauthorized" } as const;

    const userId = "default";
    const id = req.params.id;
    const nextStatus = req.body?.status;

    if (!nextStatus || !VALID_SAVED_CHAT_STATUSES.has(nextStatus)) {
      reply.code(400);
      return { error: "saved chat status invalid" } as const;
    }

    const row = pluginDb.prepare("SELECT * FROM saved_chats WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | undefined;
    if (!row) {
      reply.code(404);
      return { error: "saved chat not found" } as const;
    }

    const current = mapSavedRow(row);
    const timeline = resolveSavedChatTimeline(nextStatus, current);
    const updated: SavedChatItem = {
      ...current,
      status: nextStatus,
      updatedAt: timeline.updatedAt,
      closedAt: timeline.closedAt,
      archivedAt: timeline.archivedAt,
      deletedForMeAt: timeline.deletedForMeAt,
    };

    pluginDb.prepare("UPDATE saved_chats SET text = ?, status = ?, updated_at = ?, closed_at = ?, archived_at = ?, deleted_for_me_at = ? WHERE id = ? AND user_id = ?").run(
      updated.text,
      updated.status,
      updated.updatedAt,
      updated.closedAt ?? null,
      updated.archivedAt ?? null,
      updated.deletedForMeAt ?? null,
      id,
      userId,
    );

    return updated;
  });

  app.delete<{ Params: { id: string } }>("/api/saved/:id", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) return { error: "unauthorized" } as const;
    const userId = "default";
    const id = req.params.id;
    const result = pluginDb.prepare("DELETE FROM saved_chats WHERE id = ? AND user_id = ?").run(id, userId);
    if (result.changes === 0) {
      reply.code(404);
      return { error: "saved chat not found" } as const;
    }
    return { ok: true } as const;
  });
};
