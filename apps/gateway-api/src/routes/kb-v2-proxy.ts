/**
 * KB v2 proxy routes — forwards 8 endpoints to the Python backend.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { request } from "undici";

interface KbV2ProxyRoutesOptions {
  getPythonBase: () => string;
}

export const kbV2ProxyRoutes: FastifyPluginAsync<KbV2ProxyRoutesOptions> = async (app, { getPythonBase }) => {
  const kbV2Base = () => getPythonBase().replace(/\/$/, "");

  // POST /api/v2/chat
  app.post("/api/v2/chat", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    if (!body.question) {
      reply.code(400);
      return { error: "question required" };
    }
    try {
      const res = await request(`${kbV2Base()}/api/v2/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.body.json() as Record<string, unknown>;
      reply.header("content-type", "application/json; charset=utf-8");
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.warn({ err }, "kb_v2_chat_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable", detail: message };
    }
  });

  // GET /api/v2/search
  app.get("/api/v2/search", async (req: FastifyRequest, reply: FastifyReply) => {
    const q = (req.query as Record<string, string>).q || "";
    const limit = (req.query as Record<string, string>).limit || "10";
    const domain = (req.query as Record<string, string>).domain || "";
    const params = new URLSearchParams({ q, limit });
    if (domain) params.set("domain", domain);
    try {
      const res = await request(`${kbV2Base()}/api/v2/search?${params}`, { method: "GET" });
      const data = await res.body.json() as Record<string, unknown>;
      reply.header("content-type", "application/json; charset=utf-8");
      return data;
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_search_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable" };
    }
  });

  // POST /api/v2/intent
  app.post("/api/v2/intent", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const res = await request(`${kbV2Base()}/api/v2/intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body || {}),
      });
      const data = await res.body.json() as Record<string, unknown>;
      reply.header("content-type", "application/json; charset=utf-8");
      return data;
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_intent_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable" };
    }
  });

  // POST /api/v2/salary/compute
  app.post("/api/v2/salary/compute", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const res = await request(`${kbV2Base()}/api/v2/salary/compute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body || {}),
      });
      const data = await res.body.json() as Record<string, unknown>;
      reply.header("content-type", "application/json; charset=utf-8");
      return data;
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_salary_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable" };
    }
  });

  // POST /api/v2/tickets — Create ticket
  app.post("/api/v2/tickets", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const res = await request(`${kbV2Base()}/api/v2/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body || {}),
      });
      const data = await res.body.json() as Record<string, unknown>;
      reply.header("content-type", "application/json; charset=utf-8");
      reply.code(201);
      return data;
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_ticket_create_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable" };
    }
  });

  // GET /api/v2/tickets — List tickets
  app.get("/api/v2/tickets", async (req: FastifyRequest, reply: FastifyReply) => {
    const status = (req.query as Record<string, string>).status || "";
    const category = (req.query as Record<string, string>).category || "";
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    try {
      const res = await request(`${kbV2Base()}/api/v2/tickets?${params}`, { method: "GET" });
      const data = await res.body.json() as Record<string, unknown>;
      reply.header("content-type", "application/json; charset=utf-8");
      return data;
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_ticket_list_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable" };
    }
  });

  // GET /api/v2/tickets/:id — Get ticket
  app.get<{ Params: { id: string } }>("/api/v2/tickets/:id", async (req, reply) => {
    const id = req.params.id;
    try {
      const res = await request(`${kbV2Base()}/api/v2/tickets/${encodeURIComponent(id)}`, { method: "GET" });
      const data = await res.body.json() as Record<string, unknown>;
      reply.header("content-type", "application/json; charset=utf-8");
      return data;
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_ticket_get_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable" };
    }
  });

  // GET /api/v2/diagnostics — KB v2 health
  app.get("/api/v2/diagnostics", async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const res = await request(`${kbV2Base()}/api/v2/diagnostics`, { method: "GET" });
      const data = await res.body.json() as Record<string, unknown>;
      reply.header("content-type", "application/json; charset=utf-8");
      return data;
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_diagnostics_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable" };
    }
  });
};
