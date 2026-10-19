import type { FastifyInstance } from "fastify";
import {
  cloneUniversalJobTemplate,
  createUniversalJobApplication,
  createUniversalJobTemplate,
  getUniversalJobApplicationForManager,
  getUniversalJobProfileAutofill,
  getUniversalJobTemplateById,
  getUniversalJobTemplateBySlug,
  listUniversalJobApplicationHistory,
  listUniversalJobApplications,
  listUniversalJobPreviousAutofill,
  listUniversalJobTemplates,
  publishUniversalJobTemplate,
  updateUniversalJobApplication,
  updateUniversalJobTemplate,
} from "./universal-job-applications.repository.js";
import type { UniversalJobApplicationInput, UniversalJobApplicationStatus, UniversalJobFollowUpStatus, UniversalJobManagerContext } from "./universal-job-applications.types.js";

const clean = (value: unknown): string => String(value ?? "").trim();
const APP_STATUSES = new Set(["pending", "reviewing", "shortlisted", "approved", "rejected", "hired", "withdrawn"]);
const FOLLOW_UP_STATUSES = new Set(["not_contacted", "to_contact", "contacted", "interview_scheduled", "interview_completed", "waiting_documents", "follow_up_required", "closed", "no_response", "withdrawn"]);

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "UNIVERSAL_JOB_APPLICATION_UNAVAILABLE";
}

function managerFor(request: any): UniversalJobManagerContext | null {
  const id = clean(request.user?.id);
  const role = clean(request.user?.role).toLowerCase();
  if (!id || !["accredited", "admin", "superadmin"].includes(role)) return null;
  return { userId: id, role };
}

function requireManager(request: any, reply: any): UniversalJobManagerContext | null {
  const manager = managerFor(request);
  if (!manager) {
    reply.code(request.user?.id ? 403 : 401).send({ error: request.user?.id ? "FORBIDDEN" : "UNAUTHORIZED" });
    return null;
  }
  return manager;
}

function sendRepositoryError(request: any, reply: any, error: unknown, context: string) {
  const code = errorCode(error);
  if (code === "FORBIDDEN") return reply.code(403).send({ error: code });
  if (code === "NOT_FOUND" || code === "TEMPLATE_NOT_FOUND" || code === "USER_NOT_FOUND") return reply.code(404).send({ error: code });
  if (code === "IDEMPOTENCY_KEY_REUSED" || code === "IDEMPOTENCY_CONFLICT" || code === "APPLICATION_STALE_VERSION") return reply.code(409).send({ error: code });
  if (code === "AUTOFILL_UNAVAILABLE" || code.startsWith("MISSING_REQUIRED_FIELD") || code.startsWith("INVALID_") || code === "NO_UPDATES") return reply.code(400).send({ error: code });
  if (code.startsWith("ADDRESS_DATA_UNAVAILABLE")) return reply.code(503).send({ error: "ADDRESS_DATA_UNAVAILABLE" });
  request.log.error({ err: error }, context);
  return reply.code(503).send({ error: "UNIVERSAL_JOB_APPLICATION_UNAVAILABLE" });
}

export async function registerUniversalJobApplicationRoutes(app: FastifyInstance) {
  app.get("/api/jobs/application-templates/slug/:slug", async (request: any, reply) => {
    try {
      const item = await getUniversalJobTemplateBySlug(clean(request.params?.slug));
      return item ? reply.send({ item }) : reply.code(404).send({ error: "TEMPLATE_NOT_FOUND" });
    } catch (error) {
      return sendRepositoryError(request, reply, error, "universal_job_template_public_get_failed");
    }
  });

  app.get("/api/jobs/application-templates/:slug/autofill/profile", async (request: any, reply) => {
    const userId = clean(request.user?.id);
    if (!userId) return reply.code(401).send({ error: "UNAUTHORIZED" });
    try {
      const values = await getUniversalJobProfileAutofill(clean(request.params?.slug), userId);
      return reply.send({ values });
    } catch (error) {
      return sendRepositoryError(request, reply, error, "universal_job_profile_autofill_failed");
    }
  });

  app.get("/api/jobs/application-templates/:slug/autofill/previous", async (request: any, reply) => {
    const userId = clean(request.user?.id);
    if (!userId) return reply.code(401).send({ error: "UNAUTHORIZED" });
    try {
      const items = await listUniversalJobPreviousAutofill(clean(request.params?.slug), userId);
      return reply.send({ items });
    } catch (error) {
      return sendRepositoryError(request, reply, error, "universal_job_previous_autofill_failed");
    }
  });

  app.post("/api/jobs/application-templates/:slug/applications", async (request: any, reply) => {
    try {
      const result = await createUniversalJobApplication(clean(request.params?.slug), (request.body ?? {}) as UniversalJobApplicationInput, {
        userId: request.user?.id,
        trackingToken: firstHeader(request.headers["x-job-tracking-token"]),
        idempotencyKey: firstHeader(request.headers["idempotency-key"]) || firstHeader(request.headers["x-job-idempotency-key"]),
      });
      return reply.code(result.idempotent ? 200 : 201).send(result);
    } catch (error) {
      return sendRepositoryError(request, reply, error, "universal_job_application_create_failed");
    }
  });

  app.get("/api/jobs/application-templates/manage", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try { return reply.send({ items: await listUniversalJobTemplates(manager) }); }
    catch (error) { return sendRepositoryError(request, reply, error, "universal_job_template_list_failed"); }
  });

  app.post("/api/jobs/application-templates/manage", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try { return reply.code(201).send({ item: await createUniversalJobTemplate(request.body ?? {}, manager) }); }
    catch (error) { return sendRepositoryError(request, reply, error, "universal_job_template_create_failed"); }
  });

  app.get("/api/jobs/application-templates/manage/:id", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try {
      const item = await getUniversalJobTemplateById(clean(request.params?.id));
      if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
      if (!["admin", "superadmin"].includes(manager.role) && item.ownerUserId !== manager.userId) return reply.code(403).send({ error: "FORBIDDEN" });
      return reply.send({ item });
    } catch (error) { return sendRepositoryError(request, reply, error, "universal_job_template_detail_failed"); }
  });

  app.patch("/api/jobs/application-templates/manage/:id", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try {
      const item = await updateUniversalJobTemplate(clean(request.params?.id), request.body ?? {}, manager);
      return item ? reply.send({ item }) : reply.code(404).send({ error: "NOT_FOUND" });
    } catch (error) { return sendRepositoryError(request, reply, error, "universal_job_template_update_failed"); }
  });

  app.post("/api/jobs/application-templates/manage/:id/publish", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try {
      const item = await publishUniversalJobTemplate(clean(request.params?.id), manager);
      return item ? reply.send({ item }) : reply.code(404).send({ error: "NOT_FOUND" });
    } catch (error) { return sendRepositoryError(request, reply, error, "universal_job_template_publish_failed"); }
  });

  app.post("/api/jobs/application-templates/manage/:id/clone", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try { return reply.code(201).send({ item: await cloneUniversalJobTemplate(clean(request.params?.id), request.body ?? {}, manager) }); }
    catch (error) { return sendRepositoryError(request, reply, error, "universal_job_template_clone_failed"); }
  });

  app.get("/api/jobs/application-template-applications", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try {
      return reply.send(await listUniversalJobApplications({
        templateId: request.query?.template_id,
        q: request.query?.q,
        status: request.query?.status,
        followUpStatus: request.query?.follow_up_status,
        mohafazaId: request.query?.mohafaza_id,
        cazaId: request.query?.caza_id,
        villageId: request.query?.village_id,
        accredited: request.query?.accredited,
        minExperience: request.query?.min_experience,
        page: request.query?.page,
        pageSize: request.query?.page_size,
      }, manager));
    } catch (error) { return sendRepositoryError(request, reply, error, "universal_job_application_list_failed"); }
  });

  app.get("/api/jobs/application-template-applications/:id", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try {
      const item = await getUniversalJobApplicationForManager(clean(request.params?.id), manager);
      return item ? reply.send({ item }) : reply.code(404).send({ error: "NOT_FOUND" });
    } catch (error) { return sendRepositoryError(request, reply, error, "universal_job_application_detail_failed"); }
  });

  app.get("/api/jobs/application-template-applications/:id/history", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    try {
      const items = await listUniversalJobApplicationHistory(clean(request.params?.id), manager);
      return items.length ? reply.send({ items }) : reply.code(404).send({ error: "NOT_FOUND" });
    } catch (error) { return sendRepositoryError(request, reply, error, "universal_job_application_history_failed"); }
  });

  app.patch("/api/jobs/application-template-applications/:id", async (request: any, reply) => {
    const manager = requireManager(request, reply);
    if (!manager) return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const allowed = new Set(["status", "followUpStatus", "adminNotes", "expectedVersion"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) return reply.code(400).send({ error: "INVALID_MUTABLE_FIELD" });
    const status = body.status === undefined ? undefined : clean(body.status).toLowerCase();
    const followUpStatus = body.followUpStatus === undefined ? undefined : clean(body.followUpStatus).toLowerCase();
    if (status !== undefined && !APP_STATUSES.has(status)) return reply.code(400).send({ error: "INVALID_STATUS" });
    if (followUpStatus !== undefined && !FOLLOW_UP_STATUSES.has(followUpStatus)) return reply.code(400).send({ error: "INVALID_FOLLOW_UP_STATUS" });
    const expectedVersion = body.expectedVersion === undefined ? undefined : Number(body.expectedVersion);
    try {
      const item = await updateUniversalJobApplication(clean(request.params?.id), {
        status: status as UniversalJobApplicationStatus | undefined,
        followUpStatus: followUpStatus as UniversalJobFollowUpStatus | undefined,
        adminNotes: body.adminNotes === undefined ? undefined : clean(body.adminNotes),
        expectedVersion,
      }, manager);
      return item ? reply.send({ item }) : reply.code(404).send({ error: "NOT_FOUND" });
    } catch (error) { return sendRepositoryError(request, reply, error, "universal_job_application_update_failed"); }
  });
}
