/**
 * Chat history routes — GET/POST for chat exchange records.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb, ChatHistoryMessage } from "../types/domain";


function watanySafeStringField(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function watanySafeStringArrayField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => watanySafeStringField(item)).filter(Boolean);
}
interface HistoryRoutesOptions {
  pluginDb: PluginDb;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseHistoryMeta(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(watanySafeStringField(value));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function parseReplyPreview(value: unknown): ChatHistoryMessage["replyTo"] | undefined {
  if (!isRecord(value)) return undefined;
  const { id, role, text } = value;
  if (typeof id !== "string" || typeof role !== "string" || typeof text !== "string") {
    return undefined;
  }
  return { id, role, text };
}

function parseReactions(value: unknown): ChatHistoryMessage["reactions"] | undefined {
  if (!Array.isArray(value)) return undefined;

  const reactions = value
    .map((item) => {
      if (!isRecord(item)) return undefined;
      const { emoji, count, reactedByMe } = item;
      if (typeof emoji !== "string" || typeof count !== "number" || !Number.isFinite(count)) return undefined;
      return reactedByMe === true ? {
        emoji,
        count,
        reactedByMe: true,
      } : {
        emoji,
        count,
      };
    })
    .filter((item): item is NonNullable<ChatHistoryMessage["reactions"]>[number] => Boolean(item));

  return reactions.length ? reactions : undefined;
}

function parseDeletedForMeAt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseDeliveryStatus(value: unknown): ChatHistoryMessage["deliveryStatus"] | undefined {
  return value === "sending" || value === "sent" || value === "read" ? value : undefined;
}

function parseDeletedForEveryoneAt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseDeletedForEveryoneBy(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function sanitizeHistoryMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;

  const next = { ...meta };
  delete next.replyTo;
  delete next.reactions;
  delete next.deliveryStatus;
  delete next.deletedForMeAt;
  delete next.deletedForEveryoneAt;
  delete next.deletedForEveryoneBy;

  return Object.keys(next).length ? next : undefined;
}

export const historyRoutes: FastifyPluginAsync<HistoryRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/history", async (req) => {
    const query = req.query as { limit?: string; sessionId?: string };
    const limit = Math.max(1, Math.min(200, Number(query.limit || "50")));
    const sessionId = typeof query.sessionId === "string" ? query.sessionId.trim() : "";
    const fetchLimit = sessionId ? 5000 : limit;
    const rows = pluginDb
      .prepare("SELECT * FROM chat_history ORDER BY ts DESC LIMIT ?")
      .all(fetchLimit) as Array<Record<string, unknown>>;
    const items = rows.map((row) => {
      const meta = parseHistoryMeta(row.meta);
      const replyTo = parseReplyPreview(meta?.replyTo);
      const reactions = parseReactions(meta?.reactions);
      const deliveryStatus = parseDeliveryStatus(meta?.deliveryStatus);
      const deletedForMeAt = parseDeletedForMeAt(meta?.deletedForMeAt);
      const deletedForEveryoneAt = parseDeletedForEveryoneAt(meta?.deletedForEveryoneAt);
      const deletedForEveryoneBy = parseDeletedForEveryoneBy(meta?.deletedForEveryoneBy);

      return {
      id: String(row.id),
      role: String(row.role),
      ts: Number(row.ts),
      text: String(row.text),
      replyTo,
      reactions,
      deliveryStatus,
      deletedForMeAt,
      deletedForEveryoneAt,
      deletedForEveryoneBy,
      citations: row.citations ? JSON.parse(String(row.citations)) : undefined,
      intents: row.intents ? JSON.parse(String(row.intents)) : undefined,
      attachments: row.attachments ? JSON.parse(String(row.attachments)) : undefined,
      meta: sanitizeHistoryMeta(meta),
      };
    });
    const filteredItems = sessionId
      ? items.filter((item) => item.meta?.sessionId === sessionId)
      : items;

    return { items: filteredItems.slice(0, limit) } as const;
  });

  app.post<{ Body: ChatHistoryMessage }>("/api/history", async (req, reply) => {
    const body = req.body;
    if (!body || !body.id || !body.role || !body.text || !Number.isFinite(body.ts)) {
      reply.code(400);
      return { error: "id, role, ts, text required" } as const;
    }

    const persistedMeta: Record<string, unknown> = isRecord(body.meta)
      ? { ...body.meta }
      : {};

    if (body.replyTo) {
      persistedMeta.replyTo = body.replyTo;
    }

    if (Array.isArray(body.reactions) && body.reactions.length > 0) {
      persistedMeta.reactions = body.reactions;
    }

    if (body.deliveryStatus === "sending" || body.deliveryStatus === "sent" || body.deliveryStatus === "read") {
      persistedMeta.deliveryStatus = body.deliveryStatus;
    }

    if (typeof body.deletedForMeAt === "number" && Number.isFinite(body.deletedForMeAt)) {
      persistedMeta.deletedForMeAt = body.deletedForMeAt;
    }

    if (typeof body.deletedForEveryoneAt === "number" && Number.isFinite(body.deletedForEveryoneAt)) {
      persistedMeta.deletedForEveryoneAt = body.deletedForEveryoneAt;
    }

    if (typeof body.deletedForEveryoneBy === "string" && body.deletedForEveryoneBy.trim()) {
      persistedMeta.deletedForEveryoneBy = body.deletedForEveryoneBy;
    }

    pluginDb
      .prepare("INSERT OR REPLACE INTO chat_history (id, role, ts, text, citations, intents, attachments, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        body.id,
        body.role,
        body.ts,
        body.text,
        body.citations ? JSON.stringify(body.citations) : null,
        body.intents ? JSON.stringify(body.intents) : null,
        body.attachments ? JSON.stringify(body.attachments) : null,
        Object.keys(persistedMeta).length ? JSON.stringify(persistedMeta) : null,
      );
    return { ok: true } as const;
  });
};
