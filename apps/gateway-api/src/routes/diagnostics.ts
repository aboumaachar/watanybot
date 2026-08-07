import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { requireRole } from "../auth/rbac.js";

export interface DiagnosticsRoutesOptions {
  getRagChunkCount: () => number;
  hasKbStore: () => boolean;
  getKbStoreStats: () => Promise<unknown>;
  hasAiChat: () => boolean;
  getAiProvider: () => string | null;
  getAiModel: () => string | null;
  isKbNodesReady: () => boolean;
  getKbNodesStats: () => unknown;
}

export const diagnosticsRoutes: FastifyPluginAsync<DiagnosticsRoutesOptions> = async (
  app: FastifyInstance,
  options,
): Promise<void> => {
  const buildHealthPayload = () => {
    const ragCount = options.getRagChunkCount();
    const kbOk = options.hasKbStore() && ragCount > 0;
    const aiOk = options.hasAiChat();
    const kbNodesOk = options.isKbNodesReady();
    // APEX_WATANY_LOCAL_AI_HEALTH_SEMANTICS_BEGIN
const watanyAiRequiredForHealth =
  String(process.env.USE_AI_PROVIDER ?? '').toLowerCase() === 'true';

const watanyKbNodesRequiredForHealth =
  String(process.env.KB_NODES_REQUIRED ?? '').toLowerCase() === 'true';

const watanyCoreKbOkForHealth = Boolean(kbOk);

const watanyKbNodesOkForHealth =
  !watanyKbNodesRequiredForHealth || Boolean(kbNodesOk);

const degraded =
  !watanyCoreKbOkForHealth ||
  (watanyAiRequiredForHealth && !aiOk) ||
  !watanyKbNodesOkForHealth;
// APEX_WATANY_LOCAL_AI_HEALTH_SEMANTICS_END

    return {
      status: degraded ? "degraded" : "ok",
      uptime: Math.round(process.uptime()),
      kb: {
        sqlite: options.hasKbStore(),
        ragChunks: ragCount,
        nodes: kbNodesOk ? options.getKbNodesStats() : null,
      },
      ai: {
        enabled: aiOk,
        provider: aiOk ? options.getAiProvider() : null,
        model: aiOk ? options.getAiModel() : null,
      },
    };
  };

  const buildReadyPayload = () => {
    const ragCount = options.getRagChunkCount();
    const kbOk = options.hasKbStore() && ragCount > 0;
    const ready = true;
    return {
      ready,
      kb: kbOk,
      status: ready ? "ok" : "degraded",
      uptime: Math.round(process.uptime()),
    };
  };

  const buildVersionPayload = () => ({
    service: "watany-gateway",
    version: process.env.APP_VERSION || "0.1.0",
    uptime: Math.round(process.uptime()),
  });

  app.get("/health", async () => buildHealthPayload());
  app.get("/api/health", async () => buildHealthPayload());
  app.get("/version", async () => buildVersionPayload());
  app.get("/api/version", async () => buildVersionPayload());

  app.get("/ready", async (_req, reply) => {
    const payload = buildReadyPayload();

    reply.status(200);
    return payload;
  });

  app.get("/api/ready", async (_req, reply) => {
    const payload = buildReadyPayload();

    reply.status(200);
    return payload;
  });

  app.get("/api/kb/stats", async (_req, reply) => {
    try {
      const ragCount = options.getRagChunkCount();
      const kbStoreStats = options.hasKbStore() ? await options.getKbStoreStats() : null;
      const nodes = options.isKbNodesReady() ? options.getKbNodesStats() : null;

      return reply.send({
        ok: true,
        ragChunks: ragCount,
        sqlite: options.hasKbStore(),
        store: kbStoreStats,
        nodes,
      });
    } catch (error) {
      app.log.warn({ error }, "kb_stats_collection_failed");
      return reply.code(500).send({ ok: false, error: "kb_stats_collection_failed" });
    }
  });

  app.get("/metrics", { preHandler: [requireRole("admin")] }, async (_req, reply) => {
    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const lines = [
      "# HELP process_uptime_seconds Process uptime in seconds",
      "# TYPE process_uptime_seconds gauge",
      `process_uptime_seconds ${uptime.toFixed(1)}`,
      "# HELP process_resident_memory_bytes Resident memory size in bytes",
      "# TYPE process_resident_memory_bytes gauge",
      `process_resident_memory_bytes ${mem.rss}`,
      "# HELP process_heap_bytes Heap memory used in bytes",
      "# TYPE process_heap_bytes gauge",
      `process_heap_bytes ${mem.heapUsed}`,
      "# HELP nodejs_version_info Node.js version",
      "# TYPE nodejs_version_info gauge",
      `nodejs_version_info{version="${process.version}"} 1`,
    ];

    reply.type("text/plain; version=0.0.4").send(lines.join("\n") + "\n");
  });

  app.get("/", async () => ({
    status: "ok",
    service: "watany-gateway",
    routes: {
      health: "/health",
      chat: "/api/chat",
      adminOverview: "/api/admin/overview",
      adminPlugins: "/api/admin/plugins",
      jobs: "/api/plugins/jobs",
      jobsApply: "/api/plugins/jobs/apply",
      marketplace: "/api/plugins/marketplace",
      emergency: "/api/plugins/emergency",
    },
  }));
};