/**
 * Admin overview route — system health dashboard endpoint.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import { request } from "undici";
import { CircuitBreakerError } from "../lib/circuit-breaker";
import type { LegacyHealth } from "../types/domain";
import type { AiChatProvider } from "../ai/types";
import { requireRole } from "../auth/rbac.js";

interface AdminOverviewOptions {
  usePython: boolean;
  getPythonBase: () => string;
  pythonApiCircuitBreaker: { call: <T>(fn: () => Promise<T>) => Promise<T> };
  aiProviderCircuitBreaker: { call: <T>(fn: () => Promise<T>) => Promise<T> };
  getAiChat: () => AiChatProvider | null;
  getAiModel: () => string;
  getAiProvider: () => string;
  getRagChunkCount: () => number;
  getAiFailureCount: () => number;
  getLastAiFailure: () => { at: number; route: string; message: string } | null;
  getKbStore: () => { stats: () => Promise<unknown> } | null;
  getVoiceE2EHistory: () => Array<{ ts: string; ok: boolean; sampleText: string; transcript?: string }>;
  host: string;
  port: number;
}

export const adminOverviewRoutes: FastifyPluginAsync<AdminOverviewOptions> = async (app, opts) => {
  app.get("/api/admin/overview", { preHandler: [requireRole("admin")] }, async () => {
    const [kb, legacy, aiHealth] = await Promise.all([
      // KB stats
      (async () => {
        try {
          const kbStore = opts.getKbStore();
          return kbStore ? await kbStore.stats() : null;
        } catch (err) {
          app.log.warn({ err }, "kb_stats_failed");
          return null;
        }
      })(),

      // Python API health check
      (async () => {
        let health: LegacyHealth = { enabled: false, ok: false };
        if (!opts.usePython) return health;

        try {
          await opts.pythonApiCircuitBreaker.call(async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            const started = Date.now();
            try {
              const res = await request(`${opts.getPythonBase()}/health`, {
                method: "GET",
                signal: controller.signal,
              });
              const latencyMs = Date.now() - started;
              health = {
                enabled: true,
                ok: res.statusCode >= 200 && res.statusCode < 300,
                statusCode: res.statusCode,
                latencyMs,
              };
            } finally {
              clearTimeout(timeout);
            }
          });
        } catch (err) {
          if (err instanceof CircuitBreakerError) {
            health = { enabled: true, ok: false, error: `Circuit breaker OPEN: ${err.message}` };
          } else {
            health = { enabled: true, ok: false, error: err instanceof Error ? err.message : "legacy health check failed" };
          }
        }
        return health;
      })(),

      // AI health check
      (async () => {
        const aiChat = opts.getAiChat();
        if (!aiChat) return { enabled: false };

        try {
          return await opts.aiProviderCircuitBreaker.call(async () => {
            if (!aiChat) return { enabled: false };
            const h = await aiChat.healthCheck();
            return {
              enabled: true,
              ...h,
              ragChunks: opts.getRagChunkCount(),
              aiFailures: { count: opts.getAiFailureCount(), lastError: opts.getLastAiFailure() },
            };
          });
        } catch (err) {
          if (err instanceof CircuitBreakerError) {
            return {
              enabled: true, ok: false, model: opts.getAiModel(),
              ragChunks: opts.getRagChunkCount(),
              aiFailures: { count: opts.getAiFailureCount(), lastError: opts.getLastAiFailure() },
              cbError: err.message,
            };
          }
          return {
            enabled: true, ok: false, model: opts.getAiModel(),
            ragChunks: opts.getRagChunkCount(),
            aiFailures: { count: opts.getAiFailureCount(), lastError: opts.getLastAiFailure() },
          };
        }
      })(),
    ]);

    const voiceE2EHistory = opts.getVoiceE2EHistory();
    const voiceStatus = {
      sttConfigured: !!process.env.OPENAI_API_KEY,
      ttsConfigured: !!(process.env.VOICERSS_API_KEY) || true,
      alertsConfigured: !!(process.env.VOICE_E2E_SLACK_WEBHOOK || process.env.VOICE_E2E_ALERT_WEBHOOK),
      lastE2e: voiceE2EHistory.length ? voiceE2EHistory[0] : null,
      e2eHistoryCount: voiceE2EHistory.length,
    };

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      gateway: {
        status: "ok",
        uptime: process.uptime(),
        host: opts.host,
        port: opts.port,
      },
      legacy,
      ai: aiHealth,
      voice: voiceStatus,
      runtime: {
        nodeVersion: process.version,
        pid: process.pid,
        memoryRss: process.memoryUsage().rss,
      },
      kb,
    };
  });
};
