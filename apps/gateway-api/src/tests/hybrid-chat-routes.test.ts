import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { hybridChatRoutes } from "../routes/hybrid-chat";

describe("hybrid chat routes social/work policy", () => {
  it("enforces social-mode bypass on /api/chat/hybrid", async () => {
    const app = Fastify();
    await app.register(hybridChatRoutes);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/chat/hybrid",
      payload: {
        message: "chat with my group",
        conversationId: "route-social-conv",
        contextual: {
          chatMode: "social",
          pageContext: "community",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      mode: string;
      sources: unknown[];
      confidence: number;
      followUps: string[];
      actions: Array<{ kind: string; label: string }>;
      conversationId: string;
      answer: string;
    };

    expect(payload.mode).toBe("clarification-required");
    expect(payload.sources).toEqual([]);
    expect(payload.confidence).toBe(0);
    expect(payload.followUps).toContain("Continue in the social thread");
    expect(payload.actions).toEqual([
      { kind: "clear_context", label: "Switch back to assistant context" },
    ]);
    expect(payload.conversationId).toBe("route-social-conv");
    expect(payload.answer.toLowerCase()).toContain("social");

    await app.close();
  });

  it("enforces work-mode bypass on /api/kb/hybrid-chat", async () => {
    const app = Fastify();
    await app.register(hybridChatRoutes);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/kb/hybrid-chat",
      payload: {
        message: "help with tasks",
        contextual: {
          chatMode: "work",
          pageContext: "jobs",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      mode: string;
      sources: unknown[];
      confidence: number;
      followUps: string[];
      answer: string;
    };

    expect(payload.mode).toBe("clarification-required");
    expect(payload.sources).toEqual([]);
    expect(payload.confidence).toBe(0);
    expect(payload.followUps).toContain("Continue in work chat");
    expect(payload.answer.toLowerCase()).toContain("work");

    await app.close();
  });
});
