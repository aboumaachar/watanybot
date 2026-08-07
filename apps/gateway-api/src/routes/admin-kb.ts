import path from "node:path";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { requireRole } from "../auth/rbac.js";

export interface AdminKbRoutesOptions {
  kbSalariesDir: string;
  runtimeKbPath: string;
  resolvedRagPath: string;
  repoRootPath: string;
  versionRootPath: string;
  isKbNodesReady: () => boolean;
  listKbNodes: (options: { search: string; type: string; limit: number; offset: number }) => {
    nodes: Array<Record<string, any>>;
    total: number;
  };
  writeJsonFile: <T>(filePath: string, data: T) => Promise<void>;
  addVersionEntry: (fileRelPath: string, note?: string) => Promise<unknown>;
  listVersions: (fileFilter?: string) => Promise<unknown>;
  restoreVersion: (versionId: string) => Promise<{ ok: boolean; restored?: unknown }>;
  loadLocalSalariesKB: (repoRoot: string) => { salariesIndex: Record<string, any>; rankMeta: Record<string, any> };
  loadRuntimeKbJson: (filePath: string) => any;
  loadRagChunks: (filePath: string) => number;
  listChunks: (page: number, pageSize: number, query: string) => { total: number; chunks: unknown[] };
  getChunkById: (id: string) => unknown;
  updateChunkById: (id: string, patch: any) => unknown;
  persistChunksToFile: (filePath: string) => boolean;
}

export const adminKbRoutes: FastifyPluginAsync<AdminKbRoutesOptions> = async (
  app: FastifyInstance,
  options,
): Promise<void> => {
  // Guard every admin KB route — admin role required
  app.addHook("preHandler", requireRole("admin"));

  app.get("/api/admin/kb", async (req: any, reply) => {
    const q = (req.query as any)?.q || "";
    const type = (req.query as any)?.type || "";
    const limit = Math.min(Number((req.query as any)?.limit) || 100, 500);
    const offset = Number((req.query as any)?.offset) || 0;

    if (!options.isKbNodesReady()) {
      return reply.code(503).send({ error: "KB nodes database not ready", nodes: [] });
    }

    const result = options.listKbNodes({ search: q, type, limit, offset });
    return {
      ok: true,
      nodes: result.nodes.map((node) => ({
        id: node.id,
        title: node.title,
        category: node.type,
        content: node.summary_lb,
        source: node.source_path,
        updated_at: node.updated_at,
      })),
      total: result.total,
    };
  });

  app.get("/api/admin/kb/rules", async () => {
    const kb: any = (app as any).kb;
    const meta = kb?.rankMeta || {};
    const entryCount = Object.keys(kb?.salariesIndex || {}).length;
    return {
      ok: true,
      rules: {
        usdRate: meta.usdRate || 89500,
        familyAllowance: meta.familyAllowance || { wife: 60000, perChild: 33000 },
        familyAllowanceAfterRaise: meta.familyAllowanceAfterRaise || { wife: 2100000, perChild: 1160000 },
        ranks: meta.ranks || [],
        ornamentChoices: meta.ornamentChoices || [],
        note_ar: meta.note_ar || "",
        description: meta.description || "",
      },
      socialAids: meta.socialAids || {
        budget_2022: { type: "multiplier_with_caps", multiplier: 2, base_excludes: ["family_allowance", "ornaments"], min_total_including_base: 500000, max_increase: 12000000 },
        decree_11227: { type: "multiplier", multiplier: 4, base_excludes: ["family_allowance", "ornaments"] },
        decree_11227_2: { type: "multiplier_with_floor", multiplier: 3, base_excludes: ["family_allowance", "ornaments"], floor: 7000000 },
        decree_13020: { type: "multiplier_with_floor", multiplier: 3, base_excludes: ["family_allowance", "ornaments"], floor: 7000000 },
        grant_12m: { type: "fixed", amount: 12000000 },
      },
      stats: { salaryEntries: entryCount },
    };
  });

  app.patch("/api/admin/kb/rules", async (req: any, reply) => {
    try {
      const patch = (req.body || {}) as any;
      const kb: any = (app as any).kb;
      if (!kb) return reply.code(500).send({ ok: false, error: "KB not loaded" });

      const meta = { ...(kb.rankMeta || {}) };

      if (patch.usdRate != null) meta.usdRate = Number(patch.usdRate);
      if (patch.familyAllowance) meta.familyAllowance = { ...(meta.familyAllowance || {}), ...patch.familyAllowance };
      if (patch.familyAllowanceAfterRaise) meta.familyAllowanceAfterRaise = { ...(meta.familyAllowanceAfterRaise || {}), ...patch.familyAllowanceAfterRaise };
      if (patch.note_ar != null) meta.note_ar = patch.note_ar;
      if (patch.description != null) meta.description = patch.description;
      if (Array.isArray(patch.ranks)) meta.ranks = patch.ranks;
      if (Array.isArray(patch.ornamentChoices)) meta.ornamentChoices = patch.ornamentChoices;
      if (patch.socialAids) meta.socialAids = { ...(meta.socialAids || {}), ...patch.socialAids };

      kb.rankMeta = meta;
      await options.writeJsonFile(path.join(options.kbSalariesDir, "rankMeta.json"), meta);
      app.log.info("KB rankMeta updated via admin");
      return { ok: true, rules: meta };
    } catch (err: any) {
      app.log.error({ err, path: "/api/admin/kb/rules" }, "Failed to update KB rules");
      return reply.code(500).send({ ok: false, error: err.message || "Failed to update KB rules" });
    }
  });

  app.get("/api/admin/kb/salary-entries", async (req: any) => {
    const kb: any = (app as any).kb;
    const idx = kb?.salariesIndex || {};
    const q = (req.query || {}) as any;
    const filterRank = q.rank?.trim() || "";
    const page = Math.max(1, Number(q.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(q.pageSize || 50)));

    let entries = Object.entries(idx).map(([key, row]: [string, any]) => ({ key, ...row }));
    if (filterRank) entries = entries.filter((entry) => entry.rank === filterRank);

    const total = entries.length;
    const paged = entries.slice((page - 1) * pageSize, page * pageSize);
    return { ok: true, total, page, pageSize, entries: paged };
  });

  app.get("/api/admin/kb/salary-entry/:key", async (req: any, reply) => {
    const key = decodeURIComponent(req.params.key);
    const kb: any = (app as any).kb;
    const row = kb?.salariesIndex?.[key];
    if (!row) return reply.code(404).send({ ok: false, error: "Not found", key });
    return { ok: true, key, entry: row };
  });

  app.patch("/api/admin/kb/salary-entry/:key", async (req: any, reply) => {
    const key = decodeURIComponent(req.params.key);
    const patch = (req.body || {}) as any;
    const kb: any = (app as any).kb;
    if (!kb?.salariesIndex) return reply.code(500).send({ ok: false, error: "KB not loaded" });

    const existing = kb.salariesIndex[key];
    if (!existing) return reply.code(404).send({ ok: false, error: "Not found", key });

    const editableFields = [
      "basicSalary", "degreeValue", "vetSalary", "equipment", "driver", "position",
      "grant2025", "d13020", "d11227_2", "d11227_1", "budget2022",
      "val2019", "pension2026", "pension2026usd", "val2019usd", "pct2019",
      "sixSalary", "totalSalary2026usd", "sixPct", "fiftyPct",
    ];

    for (const field of editableFields) {
      if (patch[field] != null) existing[field] = Number(patch[field]);
    }

    kb.salariesIndex[key] = existing;
    return { ok: true, key, entry: existing, note: "In-memory update. Call POST /api/admin/kb/save to persist." };
  });

  app.post("/api/admin/kb/save", async (_req, reply) => {
    const kb: any = (app as any).kb;
    if (!kb) return reply.code(500).send({ ok: false, error: "KB not loaded" });

    try {
      await options.addVersionEntry(path.join("kb", "salaries", "salariesIndex.json"), "admin:saveKB");
      await options.addVersionEntry(path.join("kb", "salaries", "rankMeta.json"), "admin:saveKB");

      await options.writeJsonFile(path.join(options.kbSalariesDir, "salariesIndex.json"), kb.salariesIndex || {});
      await options.writeJsonFile(path.join(options.kbSalariesDir, "rankMeta.json"), kb.rankMeta || {});
      app.log.info("KB salary data persisted to disk via admin");
      return { ok: true, message: "KB saved to disk" };
    } catch (error: any) {
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  app.post("/api/admin/kb/reload", async (_req, reply) => {
    try {
      const fresh = options.loadLocalSalariesKB(options.repoRootPath);
      (app as any).kb = fresh;
      const nEntries = Object.keys(fresh.salariesIndex || {}).length;
      app.log.info({ salaryEntries: nEntries }, "KB hot-reloaded via admin");
      return { ok: true, message: "KB reloaded", salaryEntries: nEntries };
    } catch (error: any) {
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  app.get("/api/admin/kb/runtime", async () => {
    const kb = options.loadRuntimeKbJson(options.runtimeKbPath);
    if (!kb) return { ok: false, error: "runtime_kb.json not found", path: options.runtimeKbPath };
    return { ok: true, path: options.runtimeKbPath, kb };
  });

  app.post("/api/admin/kb/runtime-reload", async (_req, reply) => {
    try {
      const runtime = options.loadRuntimeKbJson(options.runtimeKbPath);
      if (!runtime) return reply.code(404).send({ ok: false, error: "runtime_kb.json not found" });
      (app as any).runtimeKb = runtime;
      app.log.info({ path: options.runtimeKbPath }, "runtime KB loaded into memory via admin");
      return { ok: true, message: "runtime KB loaded", path: options.runtimeKbPath };
    } catch (error: any) {
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  app.post("/api/admin/kb/runtime-save", async (req: any, reply) => {
    const payload = req.body;
    if (!payload || typeof payload !== "object" || !("kb" in payload)) {
      return reply.code(400).send({ ok: false, error: 'Invalid runtime KB payload; expected top-level "kb" key' });
    }

    try {
      await options.addVersionEntry(path.relative(options.versionRootPath, options.runtimeKbPath), "admin:runtime-save");
      await options.writeJsonFile(options.runtimeKbPath, payload);
      (app as any).runtimeKb = payload;
      app.log.info({ path: options.runtimeKbPath }, "runtime_kb.json persisted via admin");
      return { ok: true, path: options.runtimeKbPath, message: "runtime_kb.json saved" };
    } catch (error: any) {
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  app.post("/api/admin/kb/recalculate", async (_req, reply) => {
    const kb: any = (app as any).kb;
    if (!kb?.salariesIndex) return reply.code(500).send({ ok: false, error: "KB not loaded" });

    const usdRate = Number(kb.rankMeta?.usdRate || 89500);
    let updated = 0;

    const readNumber = (row: Record<string, any>, key: string) => {
      const value = Number(row[key]);
      return Number.isFinite(value) ? value : 0;
    };

    for (const [, row] of Object.entries(kb.salariesIndex) as [string, any][]) {
      const vetSalary = readNumber(row, "vetSalary");
      const basicSalary = readNumber(row, "basicSalary");
      const equipment = readNumber(row, "equipment");
      const position = readNumber(row, "position");
      const driver = readNumber(row, "driver");
      const grant2025 = readNumber(row, "grant2025");
      const d13020 = readNumber(row, "d13020");
      const d11227_2 = readNumber(row, "d11227_2");
      const d11227_1 = readNumber(row, "d11227_1");
      const budget2022 = readNumber(row, "budget2022");

      const pension2026 = readNumber(row, "pension2026") || (vetSalary + equipment + position + driver + grant2025 + d13020 + d11227_2 + d11227_1 + budget2022);
      row.pension2026 = pension2026;
      row.pension2026usd = readNumber(row, "pension2026usd") || Math.round((pension2026 / usdRate) * 100) / 100;

      const sixSalary = readNumber(row, "sixSalary");
      row.sixSalary = sixSalary;
      row.totalSalary2026usd = readNumber(row, "totalSalary2026usd") || Math.round(((pension2026 + sixSalary) / usdRate) * 100) / 100;

      const val2019 = readNumber(row, "val2019");
      const val2019usd = readNumber(row, "val2019usd") || (val2019 > 0 ? Math.round((val2019 / 1507.5) * 100) / 100 : 0);
      row.val2019usd = val2019usd;
      row.fiftyPct = readNumber(row, "fiftyPct") || Math.round((val2019usd * 0.5) * 100) / 100;
      row.pct2019 = readNumber(row, "pct2019") || (val2019usd > 0 ? Math.round((row.pension2026usd / val2019usd) * 1000) / 1000 : 0);
      row.sixPct = readNumber(row, "sixPct") || (val2019usd > 0 ? Math.round((row.totalSalary2026usd / val2019usd) * 1000) / 1000 : 0);

      updated++;
    }

    return { ok: true, message: `Recalculated ${updated} entries`, usdRate };
  });

  app.get("/api/admin/kb/versions", async (req: any) => {
    const file = (req.query as any)?.file || undefined;
    const versions = await options.listVersions(file);
    return { ok: true, versions };
  });

  app.post("/api/admin/kb/versions/rollback", async (req: any, reply) => {
    const { id } = req.body || {};
    if (!id) return reply.code(400).send({ ok: false, error: "id required" });

    const result = await options.restoreVersion(id);
    if (!result.ok) return reply.code(500).send(result);

    if (id.startsWith("runtime_kb.json")) {
      const runtime = options.loadRuntimeKbJson(options.runtimeKbPath);
      (app as any).runtimeKb = runtime;
    }

    if (id.includes("salariesIndex.json") || id.includes("rankMeta.json")) {
      try {
        const fresh = options.loadLocalSalariesKB(options.repoRootPath);
        (app as any).kb = fresh;
      } catch (error) {
        app.log.warn({ err: error }, "salary_reload_after_rollback_failed");
      }
    }

    return { ok: true, restored: result.restored || null };
  });

  app.get("/api/admin/kb/chunks", async (req: any) => {
    const q = String((req.query || {}).q || "").trim();
    const page = Number((req.query || {}).page || 1);
    const pageSize = Math.min(Number((req.query || {}).pageSize || 50), 200);
    const { total, chunks } = options.listChunks(page, pageSize, q);
    return { ok: true, total, chunks };
  });

  app.get("/api/admin/kb/chunk/:id", async (req: any, reply) => {
    const id = String(req.params.id || "");
    const chunk = options.getChunkById(id);
    if (!chunk) return reply.code(404).send({ ok: false, error: "not found" });
    return { ok: true, chunk };
  });

  app.patch("/api/admin/kb/chunk/:id", async (req: any, reply) => {
    const id = String(req.params.id || "");
    const patch = req.body || {};
    const updated = options.updateChunkById(id, patch);
    if (!updated) return reply.code(404).send({ ok: false, error: "not found" });

    await options.addVersionEntry(path.relative(options.versionRootPath, options.resolvedRagPath), `admin:chunk-update:${id}`);
    const ok = options.persistChunksToFile(options.resolvedRagPath);
    if (!ok) app.log.warn({ id }, "failed_persist_rag_chunks");
    return { ok: true, chunk: updated };
  });

  app.post("/api/admin/kb/chunks/save", async (_req, reply) => {
    await options.addVersionEntry(path.relative(options.versionRootPath, options.resolvedRagPath), "admin:chunks-save");
    const ok = options.persistChunksToFile(options.resolvedRagPath);
    if (!ok) return reply.code(500).send({ ok: false, error: "persist failed" });
    return { ok: true, path: options.resolvedRagPath };
  });

  app.post("/api/admin/kb/chunks/reload", async () => {
    const loaded = options.loadRagChunks(options.resolvedRagPath);
    app.log.info({ ragPath: options.resolvedRagPath, chunks: loaded }, "RAG chunks reloaded via admin");
    return { ok: true, loaded };
  });
};