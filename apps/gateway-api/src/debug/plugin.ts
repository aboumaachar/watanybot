/**
 * Debug Plugin for Fastify
 * Adds request/response logging, error tracking, and debug routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { debugConsole } from "./console";

interface DebugPluginOptions {
  enabled?: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
  trackPerformance?: boolean;
}

export async function debugPlugin(
  app: FastifyInstance,
  options: DebugPluginOptions = {}
) {
  const {
    enabled = true,
    logRequests = true,
    logResponses = true,
    trackPerformance = true,
  } = options;

  if (!enabled) {
    app.log.info("Debug plugin disabled");
    return;
  }

  debugConsole.info("Debug plugin initialized");

  // Request logging
  if (logRequests) {
    app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
      const { method, url, headers } = request;
      debugConsole.debug(`→ ${method} ${url}`, {
        headers: {
          "user-agent": headers["user-agent"],
          "content-type": headers["content-type"],
        },
      });
    });
  }

  // Performance tracking
  if (trackPerformance) {
    app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
      (request as any).startTime = Date.now();
    });

    app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = (request as any).startTime;
      if (startTime) {
        const duration = Date.now() - startTime;
        debugConsole.trackPerformance({
          route: request.url,
          method: request.method,
          duration,
          timestamp: new Date().toISOString(),
          statusCode: reply.statusCode,
        });
      }
    });
  }

  // Response logging
  if (logResponses) {
    app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
      const { method, url } = request;
      const { statusCode } = reply;
      const level = statusCode >= 400 ? "warn" : "info";
      debugConsole.log(level, `← ${method} ${url} ${statusCode}`);
    });
  }

  // Error handler
  app.setErrorHandler((error: any, request, reply) => {
    debugConsole.error(
      `Error in ${request.method} ${request.url}`,
      {
        statusCode: error?.statusCode || 500,
        message: error?.message || 'Unknown error',
      },
      error
    );

    reply.status(error?.statusCode || 500).send({
      ok: false,
      error: error?.message || 'Unknown error',
      ...(process.env.NODE_ENV === "development" && { stack: error?.stack }),
    });
  });

  // Debug routes
  app.get("/api/debug/logs", async (request, reply) => {
    const query = request.query as any;
    const logs = debugConsole.getLogs({
      level: query.level,
      since: query.since ? new Date(query.since) : undefined,
      limit: query.limit ? Number(query.limit) : 100,
    });

    return reply.send({ ok: true, logs, count: logs.length });
  });

  app.get("/api/debug/performance", async (request, reply) => {
    const query = request.query as any;
    const performance = debugConsole.getPerformance({
      route: query.route,
      minDuration: query.minDuration ? Number(query.minDuration) : undefined,
      limit: query.limit ? Number(query.limit) : 50,
    });

    return reply.send({ ok: true, performance, count: performance.length });
  });

  app.get("/api/debug/stats", async (request, reply) => {
    const stats = debugConsole.getStats();
    return reply.send({ ok: true, stats });
  });

  // New: aggregated error mapping for quick triage
  app.get("/api/debug/errors", async (request, reply) => {
    const query = request.query as any;
    const since = query.since ? new Date(query.since) : undefined;
    const limitPerGroup = query.limitPerGroup ? Number(query.limitPerGroup) : 5;

    try {
      const map = (debugConsole as any).getErrorMap({ since, limitPerGroup });
      return reply.send({ ok: true, count: map.length, errors: map });
    } catch (err: any) {
      debugConsole.error("Failed to build error map", { err: err.message }, err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // Acknowledge / unacknowledge error groups
  app.post("/api/debug/errors/:key/ack", async (request, reply) => {
    const key = decodeURIComponent((request.params as any).key);
    const body = request.body as any;
    try {
      const ack = (debugConsole as any).ackError(key, body?.by);
      return reply.send({ ok: true, key, ack });
    } catch (err: any) {
      debugConsole.error("Failed to ack error", { key, err: err.message }, err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // Preferred: DELETE for unack (avoids empty-body JSON parsing issues)
  app.delete("/api/debug/errors/:key", async (request, reply) => {
    const key = decodeURIComponent((request.params as any).key);
    try {
      (debugConsole as any).unackError(key);
      return reply.send({ ok: true, key });
    } catch (err: any) {
      debugConsole.error("Failed to unack error", { key, err: err.message }, err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // Back-compat: keep POST /unack but accept JSON body (clients should prefer DELETE)
  app.post("/api/debug/errors/:key/unack", async (request, reply) => {
    const key = decodeURIComponent((request.params as any).key);
    try {
      (debugConsole as any).unackError(key);
      return reply.send({ ok: true, key });
    } catch (err: any) {
      debugConsole.error("Failed to unack error", { key, err: err.message }, err);
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // Dev helper: emit an error log entry (dev-only)
  app.post("/api/debug/emit-error", async (request, reply) => {
    const body = request.body as any || {};
    const message = body.message || `dev-error-${Date.now()}`;
    const route = body.route || body.requestUrl || "/dev/emit";
    debugConsole.error(message, { route, payload: body.payload || null }, new Error(message));
    return reply.send({ ok: true, emitted: true, message });
  });

  app.post("/api/debug/clear", async (request, reply) => {
    debugConsole.clear();
    return reply.send({ ok: true, message: "Debug logs cleared" });
  });

  // Query functions and inspect discrepancies
  app.post("/api/debug/query", async (request, reply) => {
    const body = request.body as any;
    const { type, params } = body;

    try {
      let result: any;

      switch (type) {
        case "kb-check":
          // Check if KB is loaded
          const kb = (app as any).kb;
          result = {
            loaded: !!kb,
            hasTransactions: !!kb?.transactions,
            transactionCount: kb?.transactions?.length || 0,
            hasMetadata: !!kb?.meta,
            metadata: kb?.meta,
          };
          break;

        case "salary-check":
          // Check salary KB
          const salaryKb = (app as any).kb;
          result = {
            loaded: !!salaryKb,
            hasSalariesIndex: !!salaryKb?.salariesIndex,
            indexSize: salaryKb?.salariesIndex
              ? Object.keys(salaryKb.salariesIndex).length
              : 0,
            hasReferenceSalaries: !!salaryKb?.referenceSalaries,
            referenceCount: salaryKb?.referenceSalaries?.length || 0,
          };
          break;

        case "env-check":
          // Check environment variables
          result = {
            port: process.env.PORT,
            host: process.env.HOST,
            nodeEnv: process.env.NODE_ENV,
            usePython: process.env.USE_PYTHON_API,
            pythonUrl: process.env.PYTHON_API_URL,
            kbPath: process.env.KB_SQLITE_PATH,
            runtimeKbPath: process.env.RUNTIME_KB_JSON,
          };
          break;

        case "memory-check":
          // Check memory usage
          const mem = process.memoryUsage();
          result = {
            rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(mem.external / 1024 / 1024)}MB`,
          };
          break;

        case "routes-check":
          // List all registered routes
          const routes = app.printRoutes({ commonPrefix: false });
          result = { routes };
          break;

        case "discrepancy-check":
          // Check for common discrepancies
          const discrepancies = [];
          const appKb = (app as any).kb;

          if (!appKb) {
            discrepancies.push("KB not loaded (app.kb is null/undefined)");
          }

          if (appKb && !appKb.salariesIndex) {
            discrepancies.push("Salary index missing in KB");
          }

          if (!process.env.PORT) {
            discrepancies.push("PORT environment variable not set");
          }

          result = {
            discrepancies,
            hasIssues: discrepancies.length > 0,
            count: discrepancies.length,
          };
          break;

        default:
          return reply.code(400).send({
            ok: false,
            error: "Invalid query type",
            supportedTypes: [
              "kb-check",
              "salary-check",
              "env-check",
              "memory-check",
              "routes-check",
              "discrepancy-check",
            ],
          });
      }

      debugConsole.info(`Debug query executed: ${type}`, result);
      return reply.send({ ok: true, type, result });
    } catch (error: any) {
      debugConsole.error(`Debug query failed: ${type}`, { error: error.message }, error);
      return reply.code(500).send({
        ok: false,
        error: error.message,
      });
    }
  });

  debugConsole.info("Debug routes registered", {
    routes: [
      "GET /api/debug/logs",
      "GET /api/debug/performance",
      "GET /api/debug/stats",
      "POST /api/debug/clear",
      "POST /api/debug/query",
    ],
  });
}
