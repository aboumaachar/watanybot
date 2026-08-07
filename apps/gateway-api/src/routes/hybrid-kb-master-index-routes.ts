import type { FastifyInstance } from "fastify";
import {
  loadHybridKbMasterIndex,
  searchHybridKbMasterIndex,
  writeHybridKbMasterIndex,
} from "../services/hybrid-kb-master-indexer";

type SearchQuery = Readonly<{
  q?: string;
  limit?: string;
}>;

export async function hybridKbMasterIndexRoutes(server: FastifyInstance) {
  server.get("/api/admin/hybrid-kb-index/status", async () => {
    const index = await loadHybridKbMasterIndex();
    return {
      ok: true,
      generatedAt: index.generatedAt,
      recordCount: index.recordCount,
      categories: index.categories ?? {},
    };
  });

  server.post("/api/admin/hybrid-kb-index/rebuild", async () => {
    const index = await writeHybridKbMasterIndex();
    return {
      ok: true,
      generatedAt: index.generatedAt,
      recordCount: index.recordCount,
      categories: index.categories ?? {},
    };
  });

  server.get("/api/hybrid-kb/index", async () => {
    const index = await loadHybridKbMasterIndex();
    return index;
  });

  server.get("/api/hybrid-kb/index/search", async (request) => {
    const query = request.query as SearchQuery;
    const q = query.q ?? "";
    const limit = Number.parseInt(query.limit ?? "25", 10);
    const index = await loadHybridKbMasterIndex();
    return {
      ok: true,
      q,
      generatedAt: index.generatedAt,
      recordCount: index.recordCount,
      results: searchHybridKbMasterIndex(index, q, Number.isFinite(limit) ? limit : 25),
    };
  });
}

export default hybridKbMasterIndexRoutes;