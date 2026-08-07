/**
 * Chat session routes — hybrid human/AI support sessions.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb, ChatMessage, ChatSession } from "../types/domain";
import { makeId } from "../lib/helpers";

interface ChatSessionRoutesOptions {
  pluginDb: PluginDb;
}

export const chatSessionRoutes: FastifyPluginAsync<ChatSessionRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/chat-sessions", async () => {
    const rows = pluginDb
      .prepare("SELECT * FROM chat_sessions ORDER BY created_at DESC")
      .all() as Array<Record<string, unknown>>;
    const sessions = rows.map((row) => ({
      id: String(row.id),
      status: String(row.status) as "open" | "in_progress" | "closed",
      messages: JSON.parse(String(row.messages)) as ChatMessage[],
      note: row.note ? String(row.note) : undefined,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }));
    return { sessions } as const;
  });

  app.get<{ Params: { id: string } }>("/api/chat-sessions/:id", async (req, reply) => {
    const id = req.params.id;
    const row = pluginDb
      .prepare("SELECT * FROM chat_sessions WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) {
      reply.code(404);
      return { error: "not found" } as const;
    }
    return {
      id: String(row.id),
      status: String(row.status) as "open" | "in_progress" | "closed",
      messages: JSON.parse(String(row.messages)) as ChatMessage[],
      note: row.note ? String(row.note) : undefined,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  });

  app.post<{ Body: { messages: ChatMessage[]; note?: string } }>(
    "/api/chat-sessions",
    async (req) => {
      const body = req.body || { messages: [] };
      const now = Date.now();
      const item = {
        id: makeId("chat"),
        status: "open",
        messages: body.messages || [],
        note: body.note,
        createdAt: now,
        updatedAt: now,
      };
      pluginDb
        .prepare("INSERT INTO chat_sessions (id, status, messages, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(item.id, item.status, JSON.stringify(item.messages), item.note || "", item.createdAt, item.updatedAt);
      return item;
    },
  );

  app.patch<{ Body: Partial<ChatSession>; Params: { id: string } }>(
    "/api/chat-sessions/:id",
    async (req, reply) => {
      const id = req.params.id;
      const patch = req.body || {};
      const row = pluginDb
        .prepare("SELECT * FROM chat_sessions WHERE id = ?")
        .get(id) as Record<string, unknown> | undefined;
      if (!row) {
        reply.code(404);
        return { error: "not found" } as const;
      }
      const current = {
        id: String(row.id),
        status: String(row.status) as "open" | "in_progress" | "closed",
        messages: JSON.parse(String(row.messages)) as ChatMessage[],
        note: row.note ? String(row.note) : undefined,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      };
      const updated = {
        ...current,
        ...patch,
        messages: patch.messages ?? current.messages,
        note: patch.note ?? current.note,
        updatedAt: Date.now(),
      };
      pluginDb
        .prepare("UPDATE chat_sessions SET status = ?, messages = ?, note = ?, updated_at = ? WHERE id = ?")
        .run(updated.status, JSON.stringify(updated.messages), updated.note || "", updated.updatedAt, updated.id);
      return updated;
    },
  );
};
