import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { requireRole } from "../auth/rbac.js";

export interface AdminAiRuntimeRoutesOptions {
  dataDir: string;
  runtimeKbPath: string;
  resolvedRagPath: string;
  versionRootPath: string;
  useAi: boolean;
  getAiChat: () => unknown;
  setAiChat: (value: unknown) => void;
  getAiProvider: () => string;
  setAiProvider: (value: string) => void;
  getAiModel: () => string;
  setAiModel: (value: string) => void;
  getAiApiKey: () => string;
  setAiApiKey: (value: string) => void;
  getRagChunkCount: () => number;
  writeJsonFile: <T>(filePath: string, data: T) => Promise<void>;
  createAiProvider: (config: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
  }) => unknown;
  aiBaseUrl: string;
  aiMaxTokens: number;
  aiTemperature: number;
  aiTimeoutMs: number;
  loadRagChunks: (filePath: string) => number;
  persistChunksToFile: (filePath: string) => boolean;
  addVersionEntry: (fileRelPath: string, note?: string) => Promise<unknown>;
  loadRuntimeKbJson: (filePath: string) => unknown;
  setRuntimeKb: (runtime: unknown) => void;
}

export const adminAiRuntimeRoutes: FastifyPluginAsync<AdminAiRuntimeRoutesOptions> = async (app, options) => {
  // Guard every admin AI runtime route — admin role required
  app.addHook("preHandler", requireRole("admin"));

  app.get("/api/admin/ai-config", async () => ({
    ok: true,
    enabled: !!options.getAiChat(),
    provider: options.getAiProvider(),
    model: options.getAiModel(),
    ragChunks: options.getRagChunkCount(),
  }));

  app.post("/api/admin/ai-config", async (req: any, reply) => {
    const { enabled, apiKey, provider, model } = req.body || {};

    if (provider) options.setAiProvider(provider);
    if (model) options.setAiModel(model);
    if (typeof apiKey === "string" && apiKey.trim()) options.setAiApiKey(apiKey.trim());

    try {
      await options.writeJsonFile(path.join(options.dataDir, "ai_config.json"), {
        provider: options.getAiProvider(),
        model: options.getAiModel(),
        apiKey: apiKey ? "***" : "",
      });
    } catch {
      // non-fatal persistence failure
    }

    if (enabled) {
      try {
        options.setAiChat(
          options.createAiProvider({
            provider: options.getAiProvider(),
            baseUrl: options.aiBaseUrl,
            apiKey: options.getAiApiKey(),
            model: options.getAiModel(),
            maxTokens: options.aiMaxTokens,
            temperature: options.aiTemperature,
            timeoutMs: options.aiTimeoutMs,
          }),
        );
        options.loadRagChunks(options.resolvedRagPath);
        return { ok: true, enabled: true };
      } catch (err: any) {
        options.setAiChat(null);
        return reply.code(500).send({ ok: false, error: err?.message || String(err) });
      }
    }

    options.setAiChat(null);
    return { ok: true, enabled: false };
  });

  app.post("/api/admin/ai/rebuild", async (_req: any, reply) => {
    try {
      const persisted = options.persistChunksToFile(options.resolvedRagPath);
      if (persisted) {
        await options.addVersionEntry(path.relative(options.versionRootPath, options.resolvedRagPath), "admin:chunks-save:rebuild");
      } else {
        app.log.warn({ ragPath: options.resolvedRagPath }, "persist_rag_chunks_failed");
      }

      const loaded = options.loadRagChunks(options.resolvedRagPath);
      app.log.info({ ragPath: options.resolvedRagPath, loaded }, "RAG chunks reloaded (rebuild)");

      try {
        const runtime = options.loadRuntimeKbJson(options.runtimeKbPath);
        if (runtime) options.setRuntimeKb(runtime);
      } catch {
        // non-fatal runtime KB reload failure
      }

      if (options.useAi) {
        try {
          options.setAiChat(
            options.createAiProvider({
              provider: options.getAiProvider(),
              baseUrl: options.aiBaseUrl,
              apiKey: options.getAiApiKey(),
              model: options.getAiModel(),
              maxTokens: options.aiMaxTokens,
              temperature: options.aiTemperature,
              timeoutMs: options.aiTimeoutMs,
            }),
          );
        } catch (err: any) {
          app.log.warn({ err }, "ai_reinit_failed");
          options.setAiChat(null);
          return reply.code(500).send({ ok: false, error: `AI re-init failed: ${err?.message || String(err)}` });
        }
      }

      return { ok: true, persisted, loaded, aiEnabled: !!options.getAiChat() };
    } catch (err: any) {
      app.log.error({ err }, "ai_rebuild_failed");
      return reply.code(500).send({ ok: false, error: err?.message || String(err) });
    }
  });
};