/**
 * bootstrap/security.ts
 * Registers the global security-headers hook on the Fastify instance.
 * Call registerSecurityHeaders(app) once, before any route registration.
 */
import type { FastifyInstance } from "fastify";
import { isDev } from "../lib/config";

const EMBEDDABLE_RE = /^\/api\/v2\/procedures\/docs\/[^/]+\/preview(?:\?.*)?$/u;

const CSP_EMBEDDABLE =
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; " +
  "base-uri 'self'; " +
  "frame-ancestors 'self' http://localhost:5174 http://127.0.0.1:5174 http://localhost:5176 http://127.0.0.1:5176; " +
  "form-action 'self'; object-src 'none'";

const CSP_DEFAULT =
  "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'";

export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook("onSend", async (request, reply, payload) => {
    const url = request.raw.url || "";
    const isEmbeddable =
      url.startsWith("/api/v2/procedures/reference/") || EMBEDDABLE_RE.test(url);

    if (isEmbeddable) {
      reply.header("Content-Security-Policy", CSP_EMBEDDABLE);
    } else if (!reply.hasHeader("Content-Security-Policy")) {
      reply.header("Content-Security-Policy", CSP_DEFAULT);
    }

    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");

    if (!reply.hasHeader("X-Frame-Options")) {
      reply.header("X-Frame-Options", isEmbeddable ? "SAMEORIGIN" : "DENY");
    }

    if (!isDev) {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    return payload;
  });
}
