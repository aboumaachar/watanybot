import type { FastifyInstance } from "fastify";
import {
  createMiddleEastSecurityApplication,
  getMiddleEastSecurityApplication,
  listMiddleEastSecurityApplicationHistory,
  listMiddleEastSecurityApplications,
  updateMiddleEastSecurityApplication,
} from "./middleEastSecurity.repository.js";
import type {
  MiddleEastSecurityAdminPatch,
  MiddleEastSecurityInput,
} from "./middleEastSecurity.types.js";

const CLIENT_ERRORS = new Set([
  "MISSING_REQUIRED_FIELD",
  "INVALID_BIRTH_DATE",
  "INVALID_AGE_YEARS",
  "INVALID_LOCATION",
  "INVALID_PROFICIENCY",
  "INVALID_PHONE",
  "INVALID_ADDRESS_HIERARCHY",
  "INVALID_MOHAFAZA",
  "INVALID_CAZA_HIERARCHY",
  "INVALID_VILLAGE_HIERARCHY",
  "INVALID_ADDRESS_LABEL",
  "ADDRESS_DATA_UNAVAILABLE",
  "MISSING_SECURITY_TRAINING_DETAILS",
  "MISSING_NGO_DETAILS",
]);
const CONFLICT_ERRORS = new Set(["IDEMPOTENCY_KEY_REUSED", "IDEMPOTENCY_CONFLICT", "APPLICATION_STALE_VERSION"]);
const FOLLOW_UP_STATUSES = new Set(["not_contacted", "to_contact", "contacted", "confirmed", "no_response", "withdrawn"]);
const STATUSES = new Set(["pending", "approved", "rejected"]);

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "MES_APPLICATION_UNAVAILABLE";
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function requireAdminOrSuperadmin(request: any, reply: any): boolean {
  const role = String(request.user?.role ?? "").toUpperCase();
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    reply.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}

async function mesAdminPreHandler(request: any, reply: any): Promise<void> {
  requireAdminOrSuperadmin(request, reply);
}

export async function registerMiddleEastSecurityRoutes(app: FastifyInstance) {
  app.post("/api/jobs/middle-east-security/applications", async (request: any, reply) => {
    try {
      const result = await createMiddleEastSecurityApplication(
        (request.body ?? {}) as MiddleEastSecurityInput,
        {
          userId: request.user?.id,
          trackingToken: firstHeader(request.headers["x-mes-tracking-token"]),
          idempotencyKey: firstHeader(request.headers["idempotency-key"]) || firstHeader(request.headers["x-mes-idempotency-key"]),
        },
      );
      return reply.code(result.idempotent ? 200 : 201).send(result);
    } catch (error) {
      const code = errorCode(error);
      if (code.startsWith("ADDRESS_DATA_UNAVAILABLE")) return reply.code(503).send({ error: "address_data_unavailable" });
      if (CLIENT_ERRORS.has(code)) return reply.code(400).send({ error: code });
      if (CONFLICT_ERRORS.has(code)) return reply.code(409).send({ error: code });
      request.log.error({ err: error }, "middle_east_security_application_create_failed");
      return reply.code(503).send({ error: "application_unavailable" });
    }
  });

  app.get("/api/superadmin/middle-east-security/applications", { preHandler: [mesAdminPreHandler] }, async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;
    try {
      const result = await listMiddleEastSecurityApplications({
        q: request.query?.q,
        status: request.query?.status,
        followUpStatus: request.query?.follow_up_status,
        page: request.query?.page,
        pageSize: request.query?.page_size,
      });
      return reply.send(result);
    } catch (error) {
      const code = errorCode(error);
      if (code === "INVALID_STATUS" || code === "INVALID_FOLLOW_UP_STATUS") return reply.code(400).send({ error: code });
      request.log.error({ err: error }, "middle_east_security_application_list_failed");
      return reply.code(503).send({ error: "applications_unavailable" });
    }
  });

  app.get("/api/superadmin/middle-east-security/applications/:id", { preHandler: [mesAdminPreHandler] }, async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;
    try {
      const item = await getMiddleEastSecurityApplication(String(request.params?.id ?? ""));
      return item ? reply.send({ item }) : reply.code(404).send({ error: "not_found" });
    } catch (error) {
      request.log.error({ err: error }, "middle_east_security_application_detail_failed");
      return reply.code(503).send({ error: "application_unavailable" });
    }
  });

  app.get("/api/superadmin/middle-east-security/applications/:id/history", { preHandler: [mesAdminPreHandler] }, async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;
    try {
      const items = await listMiddleEastSecurityApplicationHistory(String(request.params?.id ?? ""));
      return items.length ? reply.send({ items }) : reply.code(404).send({ error: "not_found" });
    } catch (error) {
      request.log.error({ err: error }, "middle_east_security_application_history_failed");
      return reply.code(503).send({ error: "history_unavailable" });
    }
  });

  app.patch("/api/superadmin/middle-east-security/applications/:id", { preHandler: [mesAdminPreHandler] }, async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const allowedFields = new Set(["status", "followUpStatus", "adminNotes", "expectedVersion"]);
    const unknownField = Object.keys(body).find((field) => !allowedFields.has(field));
    if (unknownField) return reply.code(400).send({ error: "invalid_mutable_field" });

    const status = body.status === undefined ? undefined : String(body.status).toLowerCase();
    const followUpStatus = body.followUpStatus === undefined ? undefined : String(body.followUpStatus).toLowerCase();
    if (status !== undefined && !STATUSES.has(status)) return reply.code(400).send({ error: "invalid_status" });
    if (followUpStatus !== undefined && !FOLLOW_UP_STATUSES.has(followUpStatus)) {
      return reply.code(400).send({ error: "invalid_follow_up_status" });
    }
    if (body.adminNotes !== undefined && typeof body.adminNotes !== "string") {
      return reply.code(400).send({ error: "invalid_admin_notes" });
    }
    const expectedVersion = body.expectedVersion === undefined ? undefined : Number(body.expectedVersion);
    if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
      return reply.code(400).send({ error: "invalid_expected_version" });
    }

    try {
      const item = await updateMiddleEastSecurityApplication(
        String(request.params?.id ?? ""),
        {
          status: status as MiddleEastSecurityAdminPatch["status"],
          followUpStatus: followUpStatus as MiddleEastSecurityAdminPatch["followUpStatus"],
          adminNotes: body.adminNotes as string | undefined,
          expectedVersion,
        },
        { id: request.user?.id, role: request.user?.role },
      );
      return item ? reply.send({ item }) : reply.code(404).send({ error: "not_found" });
    } catch (error) {
      const code = errorCode(error);
      if (code === "NO_UPDATES" || code === "INVALID_STATUS" || code === "INVALID_FOLLOW_UP_STATUS" || code === "INVALID_EXPECTED_VERSION") {
        return reply.code(400).send({ error: code === "NO_UPDATES" ? "no_changes" : code });
      }
      if (code === "APPLICATION_STALE_VERSION") return reply.code(409).send({ error: code });
      request.log.error({ err: error }, "middle_east_security_application_update_failed");
      return reply.code(503).send({ error: "application_unavailable" });
    }
  });
}
