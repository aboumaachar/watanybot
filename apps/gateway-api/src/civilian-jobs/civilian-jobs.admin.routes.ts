/**
 * Admin routes for Civilian Jobs & Services — Wave 02.
 *
 * Boundary: these routes manage ONLY civilian opportunities.
 * Military recruitment announcements (إعلانات التطويع) are managed
 * by the recruitment module and must never be touched here.
 */
import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac.js";
import {
  adminListOpportunities,
  adminGetOpportunity,
  adminCreateOpportunity,
  adminUpdateOpportunity,
  adminPublishOpportunity,
  adminArchiveOpportunity,
  adminRejectOpportunity,
  listCivilianOpportunityApplications,
  adminUpdateApplicationStatus,
  listCivilianOpportunitySources,
  adminUpdateSource,
} from "./civilian-jobs.admin.service.js";

export async function registerCivilianJobsAdminRoutes(app: FastifyInstance) {
  // ── Opportunities ────────────────────────────────────────────────

  app.get(
    "/api/admin/opportunities",
    { preHandler: [requireRole("admin")] },
    async (request) => {
      const q = (request.query || {}) as Record<string, string | undefined>;
      return { items: adminListOpportunities({ status: q.status as never, q: q.q }) };
    },
  );

  app.get(
    "/api/admin/opportunities/:id",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = adminGetOpportunity(id);
      if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
      return { item };
    },
  );

  app.post(
    "/api/admin/opportunities",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      try {
        const body = (request.body || {}) as Record<string, unknown>;
        const item = adminCreateOpportunity(body);
        return reply.code(201).send({ item });
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : "CREATE_FAILED" });
      }
    },
  );

  app.patch(
    "/api/admin/opportunities/:id",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const body = (request.body || {}) as Record<string, unknown>;
        const item = adminUpdateOpportunity(id, body);
        if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
        return { item };
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : "UPDATE_FAILED" });
      }
    },
  );

  app.post(
    "/api/admin/opportunities/:id/publish",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = adminPublishOpportunity(id);
      if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
      return { item };
    },
  );

  app.post(
    "/api/admin/opportunities/:id/archive",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = adminArchiveOpportunity(id);
      if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
      return { item };
    },
  );

  app.post(
    "/api/admin/opportunities/:id/reject",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = adminRejectOpportunity(id);
      if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
      return { item };
    },
  );

  // ── Applications ─────────────────────────────────────────────────

  app.get(
    "/api/admin/opportunities/applications",
    { preHandler: [requireRole("admin")] },
    async () => {
      return { items: listCivilianOpportunityApplications() };
    },
  );

  app.patch(
    "/api/admin/opportunities/applications/:id/status",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body || {}) as { status?: string };
      try {
        const item = adminUpdateApplicationStatus(id, body.status || "");
        if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
        return { item };
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : "UPDATE_FAILED" });
      }
    },
  );

  // ── Sources ───────────────────────────────────────────────────────

  app.get(
    "/api/admin/opportunities/sources",
    { preHandler: [requireRole("admin")] },
    async () => {
      return { items: listCivilianOpportunitySources() };
    },
  );

  app.patch(
    "/api/admin/opportunities/sources/:id",
    { preHandler: [requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const body = (request.body || {}) as Record<string, unknown>;
        const item = adminUpdateSource(id, body);
        if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
        return { item };
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : "UPDATE_FAILED" });
      }
    },
  );
}
