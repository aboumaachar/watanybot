import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac";
import { freelancerMarketplaceService } from "./civilian-jobs.freelancer-marketplace.service";
import type { FreelancerMarketplaceProfile, FreelancerMarketplaceSearchQuery, FreelancerSkillSuggestionStatus } from "./civilian-jobs.freelancer-marketplace.types";

export async function registerCivilianJobsFreelancerMarketplaceRoutes(app: FastifyInstance) {
  app.get("/api/opportunities/freelancers/equipment", async () => freelancerMarketplaceService.listEquipment());
  app.get("/api/opportunities/freelancers/certifications", async () => freelancerMarketplaceService.listCertifications());

  app.post<{ Body: FreelancerMarketplaceSearchQuery }>("/api/opportunities/freelancers/search", async (req) => {
    return freelancerMarketplaceService.search(req.body ?? {});
  });

  app.post<{ Body: FreelancerMarketplaceProfile }>("/api/opportunities/freelancers/profile", { preHandler: [requireRole("accredited")] }, async (req) => {
    return freelancerMarketplaceService.saveProfile(req.body);
  });

  app.post<{ Body: { rawLabel: string; submittedByUserId?: string; suggestedCategory?: string } }>("/api/opportunities/freelancers/skills/suggest", async (req) => {
    return freelancerMarketplaceService.submitMissingSkill(req.body);
  });

  app.get<{ Querystring: { status?: FreelancerSkillSuggestionStatus } }>("/api/admin/opportunities/freelancers/skills/suggestions", { preHandler: [requireRole("admin")] }, async (req) => {
    return freelancerMarketplaceService.listMissingSkillSuggestions(req.query.status);
  });

  app.patch<{ Params: { id: string }; Body: { status: FreelancerSkillSuggestionStatus; mergeIntoSkillId?: string; adminNote?: string } }>("/api/admin/opportunities/freelancers/skills/suggestions/:id", { preHandler: [requireRole("admin")] }, async (req, reply) => {
    const updated = freelancerMarketplaceService.reviewMissingSkill(req.params.id, req.body);
    if (!updated) return reply.code(404).send({ error: "Suggestion not found" });
    return updated;
  });
}