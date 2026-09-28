/**
 * Admin feature flags API — global feature toggles managed by superadmin.
 *
 * GET  /api/admin/features      — fetch all flags (public, no auth required)
 * PUT  /api/admin/features      — replace all flags (superadmin only)
 */
import type { FastifyInstance } from "fastify";
import { FEATURES } from "@watany/shared/features";
import { requireRole } from "../auth/rbac.js";
import { getFeatureFlagsPayload, persistFeatureFlags } from "../lib/feature-flags.js";
import { query } from "../lib/db.js";
import { broadcastFeatureFlagsUpdate } from "../ws/features-ws.js";
import { appendAdminAuditEvent, createAdminAuditEvent } from "../admin-authority/adminAuthorityAudit.js";

const USER_FEATURE_IDS = new Set(FEATURES.map((feature) => feature.id));

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const parsed = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => right.time - left.time);
  return parsed[0]?.value ?? null;
}

export async function adminFeaturesRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/features — effective user-facing flags (global + authenticated user overrides). */
  app.get(
    "/api/features",
    { config: { public: true } },
    async (request, reply) => {
      const globalPayload = await getFeatureFlagsPayload();
      const userId = request.user?.id;
      if (!isUuid(userId)) return reply.send({ ...globalPayload, scope: "global" });

      try {
        const overrides = await query<{ feature_id: string; enabled: boolean; updated_at: string }>(
          "SELECT feature_id, enabled, updated_at FROM user_feature_overrides WHERE user_id = $1 ORDER BY feature_id",
          [userId],
        );
        const flags = { ...globalPayload.flags };
        for (const row of overrides.rows) {
          if (USER_FEATURE_IDS.has(row.feature_id as any)) flags[row.feature_id] = row.enabled;
        }
        return reply.send({
          flags,
          lastUpdatedAt: latestTimestamp([globalPayload.lastUpdatedAt, ...overrides.rows.map((row) => row.updated_at)]),
          scope: "user",
        });
      } catch (error: any) {
        if (error?.code === "42P01") return reply.send({ ...globalPayload, scope: "global", overrideStatus: "migration_pending" });
        throw error;
      }
    },
  );

  /** GET /api/admin/features — global published flags only. */
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
