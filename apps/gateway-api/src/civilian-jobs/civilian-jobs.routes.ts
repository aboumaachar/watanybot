import type { FastifyInstance } from "fastify";
import { createCivilianOpportunityApplication, getCivilianOpportunity, listCivilianOpportunities, listCivilianOpportunitySources } from "./civilian-jobs.service";
import type { CivilianJobsRepository } from "./civilian-jobs.repository";

export async function registerCivilianJobsRoutes(app: FastifyInstance, options: { repository?: CivilianJobsRepository } = {}) {
  app.get("/api/opportunities", async (request) => {
    const q = (request.query || {}) as Record<string, string | undefined>;
    const items = await listCivilianOpportunities({ type: q.type as never, location: q.location, category: q.category, audience: q.audience, q: q.q }, options.repository);
    return { items };
  });

  app.get("/api/opportunities/sources", async () => {
    return { items: await listCivilianOpportunitySources(options.repository) };
  });

  app.get("/api/opportunities/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await getCivilianOpportunity(id, options.repository);
    if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
    return { item };
  });

  app.post("/api/opportunities/:id/apply", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as Record<string, string | undefined>;
    try {
      const application = await createCivilianOpportunityApplication({
        opportunityId: id,
        applicantName: body.applicantName || "",
        applicantPhone: body.applicantPhone || "",
        applicantType: (body.applicantType || "VETERAN") as never,
        note: body.note,
        cvUrl: body.cvUrl,
      }, options.repository);
      return reply.code(201).send({ item: application });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "APPLICATION_FAILED" });
    }
  });
}
