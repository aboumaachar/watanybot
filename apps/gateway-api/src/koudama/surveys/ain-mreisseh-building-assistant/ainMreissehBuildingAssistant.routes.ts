import type { FastifyInstance } from "fastify";
import {
  createAinMreissehBuildingAssistantApplication,
  listAinMreissehBuildingAssistantApplications,
  getAinMreissehBuildingAssistantApplication,
  listAinMreissehBuildingAssistantApplicationHistory,
  updateAinMreissehBuildingAssistantApplication,
} from "./ainMreissehBuildingAssistant.repository.js";
import {
  type AinMreissehBuildingAssistantAdminPatch,
  type AinMreissehBuildingAssistantApplicationInput,
} from "./ainMreissehBuildingAssistant.types.js";

function requireAdminOrSuperadmin(request: any, reply: any): boolean {
  const role = String(request.user?.role ?? "").toUpperCase();
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    reply.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "INVALID_APPLICATION";
}

export async function registerAinMreissehBuildingAssistantRoutes(app: FastifyInstance) {
  app.post("/api/jobs/ain-mreisseh-building-assistant/applications", async (request: any, reply) => {
    try {
      const item = await createAinMreissehBuildingAssistantApplication((request.body ?? {}) as AinMreissehBuildingAssistantApplicationInput);
      return reply.code(201).send({ item });
    } catch (error) {
      const code = errorCode(error);
      const clientErrors = new Set([
        "MISSING_REQUIRED_FIELD",
        "INVALID_PHONE",
        "INVALID_EMAIL",
        "INVALID_START_DATE",
        "INVALID_ADDRESS_LOCATOR_SELECTION",
        "INVALID_VILLAGE_ID",
        "ADDRESS_LOCATOR_DATA_UNAVAILABLE",
      ]);
      if (clientErrors.has(code)) return reply.code(400).send({ error: code });
      request.log.error({ err: error }, "ain_mreisseh_application_create_failed");
      return reply.code(503).send({ error: "application_unavailable" });
    }
  });

  app.get("/api/superadmin/ain-mreisseh-building-assistant/applications", async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;
    const result = await listAinMreissehBuildingAssistantApplications({
      q: request.query?.q,
      status: request.query?.status,
      followUpStatus: request.query?.follow_up_status,
      page: request.query?.page,
      pageSize: request.query?.page_size,
    });
    return reply.send(result);
  });

  app.get("/api/superadmin/ain-mreisseh-building-assistant/applications/:id", async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;
    const item = await getAinMreissehBuildingAssistantApplication(String(request.params?.id ?? ""));
    if (!item) return reply.code(404).send({ error: "not_found" });
    return reply.send({ item });
  });

  app.get("/api/superadmin/ain-mreisseh-building-assistant/applications/:id/history", async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;
    const history = await listAinMreissehBuildingAssistantApplicationHistory(String(request.params?.id ?? ""));
    if (!history.length) return reply.code(404).send({ error: "not_found" });
    return reply.send({ items: history });
  });

  app.patch("/api/superadmin/ain-mreisseh-building-assistant/applications/:id", async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;
    const body = (request.body ?? {}) as AinMreissehBuildingAssistantAdminPatch;
    const allowedFields = new Set(["status", "followUpStatus", "adminNotes", "expectedUpdatedAt"]);
    const unknownField = Object.keys(request.body ?? {}).find((field) => !allowedFields.has(field));
    if (unknownField) return reply.code(400).send({ error: "invalid_mutable_field" });
    const allowedStatus = new Set(["pending", "approved", "rejected"]);
    const allowedFollowUp = new Set(["not_contacted", "to_contact", "contacted", "confirmed", "no_response", "withdrawn"]);
    const status = body.status === undefined ? undefined : String(body.status).toLowerCase() as AinMreissehBuildingAssistantAdminPatch["status"];
    const followUpStatus = body.followUpStatus === undefined
      ? undefined
      : String(body.followUpStatus).toLowerCase() as AinMreissehBuildingAssistantAdminPatch["followUpStatus"];
    if (status !== undefined && !allowedStatus.has(status)) return reply.code(400).send({ error: "invalid_status" });
    if (followUpStatus !== undefined && !allowedFollowUp.has(followUpStatus)) return reply.code(400).send({ error: "invalid_follow_up_status" });
    if (body.adminNotes !== undefined && typeof body.adminNotes !== "string") return reply.code(400).send({ error: "invalid_admin_notes" });

    try {
      if (body.expectedUpdatedAt !== undefined && (typeof body.expectedUpdatedAt !== "string" || !body.expectedUpdatedAt.trim())) return reply.code(400).send({ error: "invalid_expected_updated_at" });
      const item = await updateAinMreissehBuildingAssistantApplication(String(request.params?.id ?? ""), {
        status,
        followUpStatus,
        adminNotes: body.adminNotes,
        expectedUpdatedAt: body.expectedUpdatedAt,
      }, String(request.user?.id || "unknown_admin"));
      if (!item) return reply.code(404).send({ error: "not_found" });
      return reply.send({ item });
    } catch (error) {
      if (errorCode(error) === "NO_UPDATES") return reply.code(400).send({ error: "no_changes" });
      if (errorCode(error) === "APPLICATION_STALE_VERSION") return reply.code(409).send({ error: "APPLICATION_STALE_VERSION" });
      request.log.error({ err: error }, "ain_mreisseh_application_update_failed");
      return reply.code(503).send({ error: "application_unavailable" });
    }
  });
}
