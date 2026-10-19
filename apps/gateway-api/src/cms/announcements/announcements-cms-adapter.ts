import type { FastifyInstance } from "fastify";
import { registerGenericCmsRoutes } from "../storage/genericCmsRoutes.js";

export function registerAnnouncementsCmsRoutes(app: FastifyInstance): void {
  registerGenericCmsRoutes(app, {
    domain: "announcements",
    entityType: "cms.announcements",
    auditEntityType: "announcement",
    title: "Announcements",
    defaultLocale: "ar",
  });
}