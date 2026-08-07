import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { historyRoutes } from "../routes/history";
import type { PluginDb, PluginDbStatement } from "../types/domain";

function createHistoryPluginDb(): PluginDb {
  const history: Array<Record<string, unknown>> = [];

  return {
    prepare(sql: string): PluginDbStatement {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.startsWith("select * from chat_history")) {
        return {
          all: (limit: number) => [...history].sort((left, right) => Number(right.ts) - Number(left.ts)).slice(0, limit),
          get: () => undefined,
          run: () => ({ changes: 0 }),
        };
      }

      if (normalized.startsWith("insert or replace into chat_history")) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id: unknown, role: unknown, ts: unknown, text: unknown, citations: unknown, intents: unknown, attachments: unknown, meta: unknown) => {
            const next = { id, role, ts, text, citations, intents, attachments, meta };
            const existingIndex = history.findIndex((row) => row.id === id);

            if (existingIndex >= 0) {
              history[existingIndex] = next;
            } else {
              history.unshift(next);
            }

            return { changes: 1, lastInsertRowid: String(id) };
          },
        };
      }

      throw new Error(`Unexpected SQL in history test DB: ${sql}`);
    },
  };
}

describe("history routes", () => {
  it("returns only the requested session history even when newer messages from other sessions exist", async () => {
    const app = Fastify();
    app.register(historyRoutes, { pluginDb: createHistoryPluginDb() });
    await app.ready();

    await app.inject({
      method: "POST",
      url: "/api/history",
      payload: { id: "session-a-old", role: "user", ts: 1000, text: "old a", meta: { sessionId: "session-a" } },
    });
    await app.inject({
      method: "POST",
      url: "/api/history",
      payload: { id: "session-b-new", role: "user", ts: 3000, text: "new b", meta: { sessionId: "session-b" } },
    });
    await app.inject({
      method: "POST",
      url: "/api/history",
      payload: { id: "session-a-new", role: "assistant", ts: 2000, text: "new a", meta: { sessionId: "session-a" } },
    });

    const response = await app.inject({ method: "GET", url: "/api/history?sessionId=session-a&limit=2" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        expect.objectContaining({ id: "session-a-new", text: "new a", meta: { sessionId: "session-a" } }),
        expect.objectContaining({ id: "session-a-old", text: "old a", meta: { sessionId: "session-a" } }),
      ],
    });

    await app.close();
  });

  it("keeps the original unscoped history listing when no session filter is provided", async () => {
    const app = Fastify();
    app.register(historyRoutes, { pluginDb: createHistoryPluginDb() });
    await app.ready();

    await app.inject({
      method: "POST",
      url: "/api/history",
      payload: { id: "global-1", role: "user", ts: 1000, text: "first" },
    });
    await app.inject({
      method: "POST",
      url: "/api/history",
      payload: { id: "global-2", role: "assistant", ts: 2000, text: "second", meta: { sessionId: "session-a" } },
    });

    const response = await app.inject({ method: "GET", url: "/api/history?limit=2" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        expect.objectContaining({ id: "global-2", text: "second" }),
        expect.objectContaining({ id: "global-1", text: "first" }),
      ],
    });

    await app.close();
  });

  it("round-trips WAT-012 reply and reaction fields through history meta", async () => {
    const app = Fastify();
    app.register(historyRoutes, { pluginDb: createHistoryPluginDb() });
    await app.ready();

    await app.inject({
      method: "POST",
      url: "/api/history",
      payload: {
        id: "message-with-actions",
        role: "user",
        ts: 4000,
        text: "موافق، بدي رد على هالرسالة",
        replyTo: {
          id: "assistant-1",
          role: "assistant",
          text: "هذا رد سابق",
        },
        reactions: [{ emoji: "👍", count: 1, reactedByMe: true }],
        deliveryStatus: "read",
        deletedForMeAt: 4100,
        deletedForEveryoneAt: 4200,
        deletedForEveryoneBy: "user",
        meta: { sessionId: "session-actions" },
      },
    });

    const response = await app.inject({ method: "GET", url: "/api/history?sessionId=session-actions&limit=1" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        expect.objectContaining({
          id: "message-with-actions",
          replyTo: {
            id: "assistant-1",
            role: "assistant",
            text: "هذا رد سابق",
          },
          reactions: [{ emoji: "👍", count: 1, reactedByMe: true }],
          deliveryStatus: "read",
          deletedForMeAt: 4100,
          deletedForEveryoneAt: 4200,
          deletedForEveryoneBy: "user",
          meta: { sessionId: "session-actions" },
        }),
      ],
    });

    await app.close();
  });
});