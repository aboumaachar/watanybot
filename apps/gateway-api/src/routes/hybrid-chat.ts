import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { runHybridKbChat, type HybridChatRequest } from "../services/chat/hybrid-chat.service";

async function handleHybridChat(request: FastifyRequest<{ Body: HybridChatRequest }>, reply: FastifyReply) {
  const body = request.body || { message: "" };
  const result = await runHybridKbChat(body);
  return reply.send(result);
}

export async function hybridChatRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/chat/hybrid", handleHybridChat);
  app.post("/api/kb/hybrid-chat", handleHybridChat);
}

export default hybridChatRoutes;