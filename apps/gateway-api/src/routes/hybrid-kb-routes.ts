import type { FastifyInstance } from "fastify";
import { kbLiveSearchRoutes } from "./kb-live-search";
import { hybridChatRoutes } from "./hybrid-chat";

export async function hybridKbRoutes(app: FastifyInstance): Promise<void> {
  await app.register(kbLiveSearchRoutes);
  await app.register(hybridChatRoutes);
}

export default hybridKbRoutes;