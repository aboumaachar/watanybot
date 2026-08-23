/**
 * Admin feature flags API — global feature toggles managed by superadmin.
 *
 * GET  /api/admin/features      — fetch all flags (public, no auth required)
 * PUT  /api/admin/features      — replace all flags (superadmin only)
 */
import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac.js";
import { getFeatureFlagsPayload, persistFeatureFlags } from "../lib/feature-flags.js";
import { broadcastFeatureFlagsUpdate } from "../ws/features-ws.js";
import { appendAdminAuditEvent, createAdminAuditEvent } from "../admin-authority/adminAuthorityAudit.js";

export async function adminFeaturesRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/admin/features — anyone can read (clients need to know what's enabled) */
  app.get(
    "/api/admin/features",
    { config: { public: true } },
    async (_request, reply) => {
      const payload = await getFeatureFlagsPayload();
      return reply.send(payload);
    },
  );

  /** PUT /api/admin/features — superadmin only */
  app.put(
    "/api/admin/features",
    { preHandler: [requireRole("superadmin")] },
    async (request, reply) => {
      const body = request.body as Record<string, boolean> | null;
      if (!body || typeof body !== "object") {
        return reply.code(400).send({ error: "body must be a JSON object of id→boolean" });
      }
      // Validate: only allow boolean values
      for (const [key, val] of Object.entries(body)) {
        if (typeof val !== "boolean") {
          return reply.code(400).send({ error: `Invalid value for "${key}": must be boolean` });
        }
      }
      const before = await getFeatureFlagsPayload();
      await persistFeatureFlags(body);
      const payload = await getFeatureFlagsPayload();
      await broadcastFeatureFlagsUpdate(payload);
      const actorId = String(request.user?.id || "unknown_admin");
      const actorRole = String(request.user?.role || "unknown");
      const correlationId = request.id ? String(request.id) : `feature-controls-${Date.now()}`;
      await appendAdminAuditEvent(createAdminAuditEvent({
        eventType: "superadmin.feature_controls.updated",
        actorId,
        entityType: "feature_controls",
        entityId: "global",
        before: before.flags,
        after: {
          flags: payload.flags,
          actorRole,
          domain: "cms",
          action: "update",
          correlationId,
          sourceInterface: "web-admin.superadmin.feature-controls",
        },
        reason: "Superadmin feature-control canary mutation",
        requestId: correlationId,
        ip: request.ip ? String(request.ip) : undefined,
        userAgent: request.headers?.["user-agent"] ? String(request.headers["user-agent"]) : undefined,
      }));
      return reply.send({ ok: true, ...payload });
    },
  );
}
