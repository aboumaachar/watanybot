import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { kbV2ProxyRoutes } from "../routes/kb-v2-proxy";

const pythonDown = () => "http://127.0.0.1:1";

describe("KB v2 chat Node fallback", () => {
  it("maps authoritative /api/chat into the v2 response when Python is unavailable", async () => {
    const app = Fastify({ logger: false });
    app.post("/api/chat", async () => ({
      reply: "مرحبا فيك",
      debug: { chitchat: true },
      sources: [],
      intents: ["greeting"],
      menu: [],
    }));
    await app.register(kbV2ProxyRoutes, { getPythonBase: pythonDown });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/v2/chat",
      payload: { question: "مرحبا", lang: "ar" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    const body = res.json();
    expect(body).toMatchObject({
      answer_lb: "مرحبا فيك",
      answer_formal: "مرحبا فيك",
      confidence: 0.05,
      intent: "greeting",
      menu: [],
    });
    expect(body.kb_hits).toEqual([]);
    expect(body.intent_result).toEqual({});
    await app.close();
  });

  it("remains fail-closed when both Python and Node chat are unavailable", async () => {
    const app = Fastify({ logger: false });
    app.post("/api/chat", async (_req, reply) => reply.code(503).send({ error: "chat unavailable" }));
    await app.register(kbV2ProxyRoutes, { getPythonBase: pythonDown });
    await app.ready();

    const res = await app.inject({ method: "POST", url: "/api/v2/chat", payload: { question: "مرحبا" } });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: "KB v2 backend unavailable", fallback_status: 503 });
    await app.close();
  });
});
