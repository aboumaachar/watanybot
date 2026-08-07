import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";

export default async function announcementsRoute(server: FastifyInstance) {
  server.get("/announcements", async (request, reply) => {
    try {
      const dataPath = path.resolve(process.cwd(), "apps/gateway-api/data/official-announcements.json");
      const raw = await fs.promises.readFile(dataPath, "utf-8");
      const json = JSON.parse(raw);
      return reply.send(json);
    } catch (err) {
      request.log.warn({ err }, "failed to load announcements seed");
      return reply.code(500).send({ announcements: [] });
    }
  });
}
