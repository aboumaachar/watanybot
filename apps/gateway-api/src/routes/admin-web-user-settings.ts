import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac.js";
import {
  getPublishedWebUserSettingsPayload,
  persistPublishedWebUserSettings,
} from "../lib/web-user-settings.js";
import { sanitizePublishedWebUserSettings } from "@watany/shared/web-user-settings";

export async function adminWebUserSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/web-user/settings", async (_request, reply) => {
    const payload = await getPublishedWebUserSettingsPayload();
    return reply.send(payload);
  });

  app.get(
    "/api/admin/web-user/settings",
    { preHandler: [requireRole("superadmin")] },
    async (_request, reply) => {
      const payload = await getPublishedWebUserSettingsPayload();
      return reply.send(payload);
    },
  );

  app.put(
    "/api/admin/web-user/settings",
    { preHandler: [requireRole("superadmin")] },
    async (request, reply) => {
      const body = request.body;
      const settings = sanitizePublishedWebUserSettings(body);
      await persistPublishedWebUserSettings(settings);
      const payload = await getPublishedWebUserSettingsPayload();
      return reply.send({ ok: true, ...payload });
    },
  );
}