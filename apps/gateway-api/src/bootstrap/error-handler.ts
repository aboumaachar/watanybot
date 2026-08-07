/**
 * bootstrap/error-handler.ts
 * Registers the global Fastify error handler.
 * Call registerErrorHandler(app) before app.listen().
 */
import type { FastifyInstance } from "fastify";
import { isDev } from "../lib/config";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: any, request, reply) => {
    app.log.error(
      { err: error, url: request.url, method: request.method },
      "unhandled_route_error",
    );
    const statusCode = error?.statusCode || 500;
    reply.status(statusCode).send({
      error:
        statusCode >= 500
          ? "Internal Server Error"
          : error?.message || "Unknown error",
      statusCode,
      ...(isDev && { stack: error?.stack }),
    });
  });
}
