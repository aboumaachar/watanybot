import type { FastifyInstance } from "fastify";
import { createCivilianOpportunityApplication, getCivilianOpportunity, listCivilianOpportunities, listCivilianOpportunitySources } from "./civilian-jobs.service";
import type { CivilianJobsRepository } from "./civilian-jobs.repository";

export async function registerCivilianJobsRoutes(app: FastifyInstance, options: { repository?: CivilianJobsRepository } = {}) {
  app.get("/api/opportunities", async (request) => {
    const query = (request.query || {}) as Record<string, string | undefined>;
    return { items: listCivilianOpportunities({ type: query.type as never, location: query.location, category: query.category, audience: query.audience, q: query.q }) };
  });

  app.get("/api/opportunities/sources", async () => {
    return { items: listCivilianOpportunitySources() };
  });

  app.get("/api/opportunities/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const item = getCivilianOpportunity(params.id);
    if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
    return { item };
  });

  app.post("/api/opportunities/:id/apply", async (request, reply) => {
    const params = request.params as { id: string };
    const body = (request.body || {}) as Record<string, string | undefined>;
    try {
      const application = await createCivilianOpportunityApplication({
        opportunityId: params.id,
        applicantName: body.applicantName || "",
        applicantPhone: body.applicantPhone || "",
        applicantType: (body.applicantType || "VETERAN") as never,
        note: body.note,
        cvUrl: body.cvUrl
      }, options.repository);
      return reply.code(201).send({ item: application });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "APPLICATION_FAILED" });
    }
  });
}