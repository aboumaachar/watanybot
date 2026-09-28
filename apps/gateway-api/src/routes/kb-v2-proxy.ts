/**
 * KB v2 proxy routes — forwards 8 endpoints to the Python backend.
 * Extracted from server.ts.
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { request } from "undici";
import { randomUUID } from "node:crypto";
import { query } from "../lib/db.js";

interface KbV2ProxyRoutesOptions {
  getPythonBase: () => string;
}

type JsonUpstreamResponse = {
  statusCode: number;
  body: { json: () => Promise<unknown> };
};

type SearchV2Hit = {
  source: string;
  id: string;
  title: string;
  body: string;
  domain: string;
  score: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function sendUpstreamJson(res: JsonUpstreamResponse, reply: FastifyReply): Promise<unknown> {
  const data = await res.body.json();
  reply.code(res.statusCode);
  reply.header("content-type", "application/json; charset=utf-8");
  return data;
}

function toFiniteScore(value: unknown): number {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

async function localSearchFallback(
  app: FastifyInstance,
  q: string,
  limit: number,
  domain: string,
): Promise<{ items: SearchV2Hit[]; total: number; query: string }> {
  const query = q.trim();
  const encoded = encodeURIComponent(query);
  const localLimit = Math.min(Math.max(limit, 1), 50);
  const [legalRes, procedureRes, kbRes] = await Promise.all([
    app.inject({ method: "GET", url: `/api/legal/content?q=${encoded}&limit=${localLimit}` }),
    app.inject({ method: "GET", url: `/api/v2/procedures/search?q=${encoded}&limit=${localLimit}` }),
    app.inject({ method: "GET", url: `/api/kb/live-search?q=${encoded}&limit=${localLimit}` }),
  ]);

  const hits: SearchV2Hit[] = [];
  if (legalRes.statusCode >= 200 && legalRes.statusCode < 300) {
    const body = asRecord(legalRes.json());
    for (const raw of Array.isArray(body.items) ? body.items : []) {
      const item = asRecord(raw);
      if (!item.id || !item.title) continue;
      hits.push({
        source: String(item.source ?? "law_nodes"),
        id: String(item.id),
        title: String(item.title),
        body: String(item.body ?? ""),
        domain: String(item.domain ?? "legal"),
        score: toFiniteScore(item.score),
      });
    }
  }

  if (procedureRes.statusCode >= 200 && procedureRes.statusCode < 300) {
    const body = asRecord(procedureRes.json());
    for (const raw of Array.isArray(body.items) ? body.items : []) {
      const item = asRecord(raw);
      if (!item.id) continue;
      hits.push({
        source: "procedures",
        id: String(item.id),
        title: String(item.title_clean ?? item.title_ar ?? item.title ?? ""),
        body: String(item.summary_clean ?? item.summary_lb ?? item.summary ?? ""),
        domain: String(item.domain ?? "procedures"),
        score: toFiniteScore(item.score),
      });
    }
  }

  if (kbRes.statusCode >= 200 && kbRes.statusCode < 300) {
    const body = asRecord(kbRes.json());
    for (const raw of Array.isArray(body.documents) ? body.documents : []) {
      const item = asRecord(raw);
      if (!item.id || !item.title) continue;
      hits.push({
        source: String(item.sourceType ?? "kb"),
        id: String(item.id),
        title: String(item.title),
        body: String(item.excerpt ?? ""),
        domain: String(item.kbId ?? item.sourceType ?? "general"),
        score: toFiniteScore(item.score),
      });
    }
  }

  const wantedDomain = domain.trim().toLowerCase();
  const deduped = new Map<string, SearchV2Hit>();
  for (const hit of hits) {
    if (wantedDomain && hit.domain.toLowerCase() !== wantedDomain) continue;
    const key = `${hit.source}:${hit.id}`;
    const current = deduped.get(key);
    if (!current || hit.score > current.score) deduped.set(key, hit);
  }
  const items = [...deduped.values()].sort((a, b) => b.score - a.score).slice(0, localLimit);
  return { items, total: items.length, query };
}

type TicketV2Row = {
  id: string; status: string; priority: string; category: string; title_lb: string;
  description: string; intent: string; domain: string; assigned_to: string;
  escalation_reason: string; history: unknown; created_at: Date | string;
  updated_at: Date | string; resolved_at: Date | string | null;
};

function ticketUserId(req: FastifyRequest): string | null {
  return String((req as FastifyRequest & { user?: { id?: string } }).user?.id || "").trim() || null;
}

function mapTicketRow(row: TicketV2Row) {
  const iso = (value: Date | string | null) => value ? new Date(value).toISOString() : undefined;
  return {
    id: row.id, status: row.status, priority: row.priority, category: row.category,
    title_lb: row.title_lb, description: row.description, intent: row.intent, domain: row.domain,
    assigned_to: row.assigned_to, escalation_reason: row.escalation_reason,
    history: Array.isArray(row.history) ? row.history : [], created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!, resolved_at: iso(row.resolved_at),
  };
}

async function createLocalTicket(req: FastifyRequest, reply: FastifyReply) {
  const userId = ticketUserId(req);
  if (!userId) return reply.code(401).send({ error: "Authentication required" });
  const body = asRecord(req.body);
  const title = String(body.title_lb ?? "").trim();
  if (!title) return reply.code(400).send({ error: "title_lb required" });
  const id = `ticket_${randomUUID()}`;
  const history = [{ event: "created", at: new Date().toISOString(), by: userId }];
  const result = await query<TicketV2Row>(`
    INSERT INTO tickets
      (id, requester_user_id, status, priority, category, title_lb, description, intent, domain, assigned_to, escalation_reason, history)
    VALUES ($1,$2,'open',$3,$4,$5,$6,$7,$8,'',$9,$10::jsonb)
    RETURNING id,status,priority,category,title_lb,description,intent,domain,assigned_to,escalation_reason,history,created_at,updated_at,resolved_at
  `, [id, userId, String(body.priority ?? "normal"), String(body.category ?? "other"), title,
      String(body.description ?? ""), String(body.intent ?? ""), String(body.domain ?? ""),
      String(body.escalation_reason ?? ""), JSON.stringify(history)]);
  return reply.code(201).send(mapTicketRow(result.rows[0]));
}

async function listLocalTickets(req: FastifyRequest, reply: FastifyReply) {
  const userId = ticketUserId(req);
  if (!userId) return reply.code(401).send({ error: "Authentication required" });
  const q = req.query as Record<string,string>;
  const params: unknown[] = [userId];
  const clauses = ['requester_user_id = $1'];
  if (q.status) { params.push(q.status); clauses.push(`status = $${params.length}`); }
  if (q.category) { params.push(q.category); clauses.push(`category = $${params.length}`); }
  const result = await query<TicketV2Row>(`
    SELECT id,status,priority,category,title_lb,description,intent,domain,assigned_to,escalation_reason,history,created_at,updated_at,resolved_at
    FROM tickets WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 100
  `, params);
  return reply.send({ tickets: result.rows.map(mapTicketRow), total: result.rowCount });
}

async function getLocalTicket(req: FastifyRequest & { params: { id: string } }, reply: FastifyReply) {
  const userId = ticketUserId(req);
  if (!userId) return reply.code(401).send({ error: "Authentication required" });
  const result = await query<TicketV2Row>(`
    SELECT id,status,priority,category,title_lb,description,intent,domain,assigned_to,escalation_reason,history,created_at,updated_at,resolved_at
    FROM tickets WHERE id = $1 AND requester_user_id = $2 LIMIT 1
  `, [req.params.id, userId]);
  if (!result.rows[0]) return reply.code(404).send({ error: "Ticket not found" });
  return reply.send(mapTicketRow(result.rows[0]));
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
      return await sendUpstreamJson(res, reply);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.warn({ err }, "kb_v2_chat_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable", detail: message };
    }
  });

  // GET /api/v2/search
  app.get("/api/v2/search", async (req: FastifyRequest, reply: FastifyReply) => {
    const q = ((req.query as Record<string, string>).q || "").trim();
    const rawLimit = Number((req.query as Record<string, string>).limit || "10");
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 10;
    const domain = (req.query as Record<string, string>).domain || "";
    if (q.length < 2) {
      return reply.code(422).send({ error: "q must contain at least 2 characters" });
    }
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (domain) params.set("domain", domain);
    try {
      const res = await request(`${kbV2Base()}/api/v2/search?${params}`, { method: "GET" });
      return await sendUpstreamJson(res, reply);
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_search_proxy_failed_using_local_fallback");
      const fallback = await localSearchFallback(app, q, limit, domain);
      reply.header("x-watany-kb-v2-source", "node-fallback");
      return reply.send(fallback);
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
      return await sendUpstreamJson(res, reply);
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
      return await sendUpstreamJson(res, reply);
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
      return await sendUpstreamJson(res, reply);
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_ticket_create_proxy_failed_using_local_fallback");
      return await createLocalTicket(req, reply);
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
      return await sendUpstreamJson(res, reply);
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_ticket_list_proxy_failed_using_local_fallback");
      return await listLocalTickets(req, reply);
    }
  });

  // GET /api/v2/tickets/:id — Get ticket
  app.get<{ Params: { id: string } }>("/api/v2/tickets/:id", async (req, reply) => {
    const id = req.params.id;
    try {
      const res = await request(`${kbV2Base()}/api/v2/tickets/${encodeURIComponent(id)}`, { method: "GET" });
      return await sendUpstreamJson(res, reply);
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_ticket_get_proxy_failed_using_local_fallback");
      return await getLocalTicket(req as FastifyRequest & { params: { id: string } }, reply);
    }
  });

  // GET /api/v2/diagnostics — KB v2 health
  app.get("/api/v2/diagnostics", async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const res = await request(`${kbV2Base()}/api/v2/diagnostics`, { method: "GET" });
      return await sendUpstreamJson(res, reply);
    } catch (err: unknown) {
      app.log.warn({ err }, "kb_v2_diagnostics_proxy_failed");
      reply.code(502);
      return { error: "KB v2 backend unavailable" };
    }
  });
};
