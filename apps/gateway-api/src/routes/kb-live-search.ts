import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { searchKbLive } from "../services/kb/kb-search.service";

type LiveSearchQuery = {
  q?: string;
  limit?: string | number;
};

export async function kbLiveSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/kb/live-search", async (request: FastifyRequest<{ Querystring: LiveSearchQuery }>, reply: FastifyReply) => {
    const query = String(request.query.q || "");
    const rawLimit = Number(request.query.limit || 8);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 8;
    const result = await searchKbLive(query, { limit });
    return reply.send(result);
  });
}

export default kbLiveSearchRoutes;