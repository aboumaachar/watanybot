import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac";
import { listLebaneseJobSources } from "./civilian-jobs.lebanese-source-coverage";
import { simulateDailyCrawlRun } from "./civilian-jobs.daily-crawler.service";

export async function registerCivilianJobsDailyCrawlerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/opportunities/source-coverage", { preHandler: [requireRole("admin")] }, async () => {
    return { sources: listLebaneseJobSources() };
  });

  app.post("/api/admin/opportunities/crawl-runs/daily", { preHandler: [requireRole("admin")] }, async () => {
    return simulateDailyCrawlRun();
  });
}