import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { requireRole } from "../auth/rbac.js";
import {
  createRecruitmentAnnouncement,
  deleteRecruitmentAnnouncement,
  listPublicRecruitmentAnnouncements,
  listRecruitmentAnnouncements,
  updateRecruitmentAnnouncement,
} from "./service.js";
import {
  createRecruitmentAnnouncementBodySchema,
  listRecruitmentAnnouncementsQuerySchema,
  recruitmentEntityParamsSchema,
  updateRecruitmentAnnouncementBodySchema,
} from "./schemas.js";

function validationError(reply: any, error: unknown) {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "invalid_payload",
      details: error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      })),
    });
  }
  return null;
}

export async function recruitmentRoutes(app: FastifyInstance): Promise<void> {
  const superadminOnly = { preHandler: [requireRole("superadmin")] };

  app.get("/api/recruitment/announcements", async (_request, reply) => {
    return reply.send({ announcements: listPublicRecruitmentAnnouncements() });
  });

  app.get("/api/admin/recruitment/announcements", superadminOnly, async (request, reply) => {
    try {
      const query = listRecruitmentAnnouncementsQuerySchema.parse(request.query ?? {});
      return reply.send({ announcements: listRecruitmentAnnouncements(query) });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "list_recruitment_announcements_failed" });
    }
  });

  app.post("/api/admin/recruitment/announcements", superadminOnly, async (request, reply) => {
    try {
      const body = createRecruitmentAnnouncementBodySchema.parse(request.body);
      const actor = request.user?.id || "superadmin";
      const announcement = createRecruitmentAnnouncement({
        title: body.title,
        apparatusName: body.apparatusName,
        announcementNumber: body.announcementNumber ?? undefined,
        startDate: body.startDate ?? undefined,
        endDate: body.endDate ?? undefined,
        status: body.status,
        conditions: body.conditions,
        requiredDocuments: body.requiredDocuments,
        eligibleCategories: body.eligibleCategories,
        applicationLocation: body.applicationLocation ?? undefined,
        applicationMethod: body.applicationMethod ?? undefined,
        sourceName: body.sourceName ?? undefined,
        sourceUrl: body.sourceUrl ?? undefined,
        notes: body.notes ?? undefined,
      }, actor);
      return reply.code(201).send({ announcement });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "create_recruitment_announcement_failed" });
    }
  });

  app.patch("/api/admin/recruitment/announcements/:id", superadminOnly, async (request, reply) => {
    try {
      const { id } = recruitmentEntityParamsSchema.parse(request.params ?? {});
      const body = updateRecruitmentAnnouncementBodySchema.parse(request.body);
      const announcement = updateRecruitmentAnnouncement(id, {
        title: body.title,
        apparatusName: body.apparatusName,
        announcementNumber: body.announcementNumber ?? undefined,
        startDate: body.startDate ?? undefined,
        endDate: body.endDate ?? undefined,
        status: body.status,
        conditions: body.conditions,
        requiredDocuments: body.requiredDocuments,
        eligibleCategories: body.eligibleCategories,
        applicationLocation: body.applicationLocation ?? undefined,
        applicationMethod: body.applicationMethod ?? undefined,
        sourceName: body.sourceName ?? undefined,
        sourceUrl: body.sourceUrl ?? undefined,
        notes: body.notes ?? undefined,
      });
      if (!announcement) {
        return reply.code(404).send({ error: "recruitment_announcement_not_found" });
      }
      return reply.send({ announcement });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "update_recruitment_announcement_failed" });
    }
  });

  app.delete("/api/admin/recruitment/announcements/:id", superadminOnly, async (request, reply) => {
    try {
      const { id } = recruitmentEntityParamsSchema.parse(request.params ?? {});
      const removed = deleteRecruitmentAnnouncement(id);
      if (!removed) {
        return reply.code(404).send({ error: "recruitment_announcement_not_found" });
      }
      return reply.code(204).send();
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "delete_recruitment_announcement_failed" });
    }
  });
}