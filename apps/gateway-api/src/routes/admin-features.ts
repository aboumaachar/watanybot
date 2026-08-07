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
      await persistFeatureFlags(body);
      const payload = await getFeatureFlagsPayload();
      await broadcastFeatureFlagsUpdate(payload);
      return reply.send({ ok: true, ...payload });
    },
  );
}
