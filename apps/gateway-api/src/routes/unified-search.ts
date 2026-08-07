import type { FastifyInstance } from "fastify";
import { searchCache, cacheKey } from "../lib/cache.js";
import { requireRole } from "../auth/rbac.js";

/**
 * GET /api/search/unified
 * Merges results from KB FTS, v2 semantic search and tx search into one response.
 *
 * Query params:
 *  - q: search query (required)
 *  - limit: max results per source (default 5, max 20)
 *  - sources: comma-separated list of sources to query (default: all)
 *             options: kb, v2, tx
 */
export async function unifiedSearchRoutes(app: FastifyInstance) {
  app.get("/api/search/unified", async (req, reply) => {
    const query = ((req.query as any).q || "").trim();
    if (!query) {
      reply.code(400);
      return { error: "q required" };
    }

    const limit = Math.min(Math.max(Number((req.query as any).limit || "5"), 1), 20);
    const sourcesParam = ((req.query as any).sources || "kb,v2,tx") as string;
    const sources = sourcesParam.split(",").map((s: string) => s.trim().toLowerCase());

    // Check cache
    const ck = cacheKey("unified", { q: query, limit, sources: sources.join(",") });
    const cached = searchCache.get(ck);
    if (cached) {
      reply.header("x-cache", "HIT");
      return cached;
    }

    const results: Record<string, unknown[]> = {};
    const errors: string[] = [];

    // Fan out parallel searches
    const tasks: Promise<void>[] = [];

    if (sources.includes("kb")) {
      tasks.push(
        (async () => {
          try {
            const kbRes = await app.inject({
              method: "GET",
              url: `/api/kb-nodes/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            });
            const body = JSON.parse(kbRes.body);
            results.kb = body.hits || body.results || [];
          } catch (err: any) {
            errors.push(`kb: ${err.message}`);
            results.kb = [];
          }
        })()
      );
    }

    if (sources.includes("v2")) {
      tasks.push(
        (async () => {
          try {
            const v2Res = await app.inject({
              method: "GET",
              url: `/api/v2/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            });
            const body = JSON.parse(v2Res.body);
            results.v2 = body.hits || body.results || [];
          } catch (err: any) {
            errors.push(`v2: ${err.message}`);
            results.v2 = [];
          }
        })()
      );
    }

    if (sources.includes("tx")) {
      tasks.push(
        (async () => {
          try {
            const txRes = await app.inject({
              method: "GET",
              url: `/api/tx/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            });
            const body = JSON.parse(txRes.body);
            results.tx = body.hits || body.results || body.items || [];
          } catch (err: any) {
            errors.push(`tx: ${err.message}`);
            results.tx = [];
          }
        })()
      );
    }

    await Promise.allSettled(tasks);

    const response = {
      query,
      sources: Object.keys(results),
      results,
      total: Object.values(results).reduce((sum, arr) => sum + arr.length, 0),
      errors: errors.length ? errors : undefined,
    };

    // Cache for 60s
    searchCache.set(ck, response);
    reply.header("x-cache", "MISS");
    return response;
  });

  // GET /api/cache/stats — expose cache stats for admin monitoring
  app.get("/api/cache/stats", { preHandler: [requireRole("admin")] }, async (_req, reply) => {
    return {
      search: searchCache.stats,
    };
  });

  // POST /api/cache/clear — admin cache purge
  app.post("/api/cache/clear", { preHandler: [requireRole("admin")] }, async (_req, reply) => {
    searchCache.clear();
    return { ok: true, message: "Search cache cleared" };
  });
}
