import type { FastifyInstance } from "fastify";
import { getCivilianJobsPersistenceHealth, listCivilianJobAuditEvents } from "./civilian-jobs.persistence.service";

export async function registerCivilianJobsPersistenceRoutes(app: FastifyInstance) {
  app.get("/api/admin/opportunities/persistence/health", async () => {
    return getCivilianJobsPersistenceHealth();
  });

  app.get("/api/admin/opportunities/audit", async (request) => {
    const query = request.query as { entityType?: string; entityId?: string };
    return listCivilianJobAuditEvents(query.entityType, query.entityId);
  });
}