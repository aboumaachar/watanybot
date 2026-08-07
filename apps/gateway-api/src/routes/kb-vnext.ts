/**
 * KB vNext node routes — search, stats, list endpoints for FTS5 knowledge base.
 * Extracted from server.ts.
 *
 * DEPRECATED: These routes serve the v1 SQLite FTS5 KB which is superseded by KB v2.
 * Callers should migrate to:
 *   GET  /api/v2/search  — KB v2 RAG search (Python-owned, proxied)
 *   GET  /api/v2/diagnostics  — KB v2 diagnostics
 * These routes will be removed in a future release.
 */
import type { FastifyPluginAsync } from "fastify";
import type { KbSearchResult } from "../kb/kb-nodes";

interface KbVNextRoutesOptions {
  isKbNodesReady: () => boolean;
  searchKbNodes: (query: string, intent?: string | null, limit?: number) => KbSearchResult;
  getKbNodesStats: () => Record<string, unknown> | null;
  listKbNodes: (opts: { type?: string; limit?: number; offset?: number }) => { nodes: unknown[]; total: number };
}

export const kbVNextRoutes: FastifyPluginAsync<KbVNextRoutesOptions> = async (app, opts) => {
  const { isKbNodesReady, searchKbNodes, getKbNodesStats, listKbNodes } = opts;

  // GET /api/kb-nodes/search
  app.get("/api/kb-nodes/search", async (req, reply) => {
    reply.header("Deprecation", "true");
    reply.header("Link", '</api/v2/search>; rel="successor-version"');
    const q = ((req.query as Record<string, string>).q || "").trim();
    const intent = (req.query as Record<string, string>).intent || null;
    const limit = Math.min(Number((req.query as Record<string, string>).limit || "8"), 30);
    if (!q) {
      reply.code(400);
      return { error: "q required" };
    }
    if (!isKbNodesReady()) {
      reply.code(503);
      return { error: "KB nodes not loaded" };
    }
    reply.header("content-type", "application/json; charset=utf-8");
    return searchKbNodes(q, intent, limit);
  });

  // GET /api/kb-nodes/stats
  app.get("/api/kb-nodes/stats", async (_req, reply) => {
    reply.header("Deprecation", "true");
    reply.header("Link", '</api/v2/diagnostics>; rel="successor-version"');
    reply.header("content-type", "application/json; charset=utf-8");
    return { ready: isKbNodesReady(), stats: getKbNodesStats() };
  });

  // GET /api/kb-nodes/list
  app.get("/api/kb-nodes/list", async (req, reply) => {
    reply.header("Deprecation", "true");
    reply.header("Link", '</api/v2/search>; rel="successor-version"');
    const type = (req.query as Record<string, string>).type || undefined;
    const limit = Math.min(Number((req.query as Record<string, string>).limit || "200"), 500);
    const offset = Math.max(Number((req.query as Record<string, string>).offset || "0"), 0);

    if (!isKbNodesReady()) {
      reply.code(503);
      return { error: "KB nodes not loaded", nodes: [], total: 0 };
    }

    reply.header("content-type", "application/json; charset=utf-8");
    const result = listKbNodes({ type, limit, offset });
    return { ok: true, ...result };
  });
};
