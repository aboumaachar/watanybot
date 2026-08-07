import type { FastifyInstance } from "fastify";
import { findFreelancerSkills, getApprovedFreelancerSkills } from "./civilian-jobs.skill-registry";
export async function registerCivilianJobsMatchingRoutes(app: FastifyInstance) {
  app.get("/api/opportunities/skills", async (req) => {
    const query = (req.query as { q?: string }).q ?? "";
    return { items: query ? findFreelancerSkills(query) : getApprovedFreelancerSkills() };
  });
  // APEX_DUPLICATE_ROUTE_REPAIR_v1: /api/opportunities/freelancers/search is owned by civilian-jobs.freelancer-marketplace.routes.ts.
}
