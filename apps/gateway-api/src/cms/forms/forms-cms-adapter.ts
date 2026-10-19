import type { FastifyInstance } from "fastify";
import { registerGenericCmsRoutes } from "../storage/genericCmsRoutes.js";

export function registerFormsCmsRoutes(app: FastifyInstance): void {
  registerGenericCmsRoutes(app, {
    domain: "forms",
    entityType: "cms.forms",
    auditEntityType: "form",
    title: "Forms",
    defaultLocale: "ar",
  });
}