import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac";
import { civilianEmployerPortalService } from "./civilian-jobs.employer-portal.service";


function watanySafeStringField(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function watanySafeStringArrayField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => watanySafeStringField(item)).filter(Boolean);
}
export async function registerCivilianJobsEmployerPortalRoutes(app: FastifyInstance) {
  app.get("/api/civilian-jobs/employers", async () => ({ employers: civilianEmployerPortalService.listEmployers() }));
  app.post("/api/civilian-jobs/employers", async (request) => {
    const body = request.body as any;
    return { employer: civilianEmployerPortalService.submitEmployer({
      id: String(body.id || `emp-${Date.now()}`),
      organizationName: String(body.organizationName || ""),
      contactName: String(body.contactName || ""),
      phone: body.phone ? String(body.phone) : undefined,
      email: body.email ? String(body.email) : undefined,
      website: body.website ? String(body.website) : undefined,
      sector: body.sector ? String(body.sector) : undefined,
      locationLabel: body.locationLabel ? String(body.locationLabel) : undefined,
      veteranFriendly: Boolean(body.veteranFriendly),
    }) };
  });
  app.get("/api/admin/civilian-jobs/employers", { preHandler: [requireRole("admin")] }, async () => ({ employers: civilianEmployerPortalService.listEmployers() }));
  app.post("/api/admin/civilian-jobs/employers/:id/approve", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const params = request.params as { id: string };
    const employer = civilianEmployerPortalService.approveEmployer(params.id);
    if (!employer) return reply.code(404).send({ error: "EMPLOYER_NOT_FOUND" });
    return { employer };
  });
  app.get("/api/civilian-jobs/employer-needs", async () => ({ needs: civilianEmployerPortalService.listNeeds() }));
  app.post("/api/civilian-jobs/employer-needs", { preHandler: [requireRole("accredited")] }, async (request) => {
    const body = request.body as any;
    return { need: civilianEmployerPortalService.submitNeed({
      id: String(body.id || `need-${Date.now()}`),
      employerId: String(body.employerId || ""),
      title: String(body.title || ""),
      description: String(watanySafeStringField(body.description)),
      neededSkillIds: Array.isArray(body.neededSkillIds) ? body.neededSkillIds.map(String) : [],
      locationLabel: body.locationLabel ? String(body.locationLabel) : undefined,
      workMode: body.workMode || "PROJECT",
    }) };
  });
}