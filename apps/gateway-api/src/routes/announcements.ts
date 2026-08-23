import { FastifyInstance } from "fastify";
import path from "path";
import fs from "fs";
import { listGenericCmsEntities } from "../cms/storage/genericCmsRepository.js";

export default async function announcementsRoute(server: FastifyInstance) {
  server.get("/announcements", async (request, reply) => {
    try {
      const cmsItems = await listGenericCmsEntities("announcements", undefined, "PUBLISHED");
      if (cmsItems.length > 0) {
        return reply.send({ announcements: cmsItems.map((item) => ({ id: item.publicId, title: item.title, status: item.status, ...item.payload })) });
      }
      const dataPath = path.resolve(process.cwd(), "data/official-announcements.json");
      const raw = await fs.promises.readFile(dataPath, "utf-8");
      const json = JSON.parse(raw);
      return reply.send(json);
    } catch (err) {
      request.log.warn({ err }, "failed to load announcements seed");
      return reply.code(500).send({ announcements: [] });
    }
  });
}
