/**
 * bootstrap/kb-bootstrap.ts
 * Initialises KB salaries, KB store (sqlite), vNext FTS5 nodes, and RAG chunks.
 * Returns the resources that downstream services need (kbStore, pluginDb).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { createSqliteV3Store } from "@watany/kb";
import { initPluginDb } from "../db/plugin-db";
import { initKbNodes, getKbNodesStats } from "../kb/kb-nodes";
import { loadRagChunks } from "../ai/index";
import { loadLocalSalariesKB, loadRuntimeKbJson } from "./helpers";
import { kbAttachmentsRoutes } from "../routes/kb-attachments";
import {
  useKbStub,
  kbNodesDbPath,
  disableKbNodes,
  pluginDbPath,
  disablePluginDb,
  repoRoot,
  resolveRagPath,
  resolveKbPath,
  resolveRuntimeKbPath,
} from "../lib/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export type KbBootstrapResult = {
  kbStore: ReturnType<typeof createSqliteV3Store> | null;
  pluginDb: import("../types/domain").PluginDb;
  resolvedRagPath: string;
  kbPath: string;
  runtimeKbPath: string;
};

function hasUsableSalaryKb(kb: { salariesIndex?: Record<string, unknown>; rankMeta?: Record<string, unknown> }): boolean {
  const salaryEntries = Object.keys(kb.salariesIndex || {}).length;
  const rankCount = Array.isArray(kb.rankMeta?.ranks) ? kb.rankMeta.ranks.length : 0;
  return salaryEntries > 0 || rankCount > 0;
}

export async function bootstrapKb(app: FastifyInstance): Promise<KbBootstrapResult> {
  const resolvedRagPath = resolveRagPath();
  const kbPath          = resolveKbPath();
  const runtimeKbPath   = resolveRuntimeKbPath();

  // ── Salaries KB ────────────────────────────────────────────────
  try {
    const salariesRepoRoot = process.env.KB_DATA_ROOT || repoRoot;
    let resolvedSalaryKbRoot = salariesRepoRoot;
    let kb = loadLocalSalariesKB(salariesRepoRoot);

    if (salariesRepoRoot !== repoRoot && !hasUsableSalaryKb(kb)) {
      const fallbackKb = loadLocalSalariesKB(repoRoot);
      if (hasUsableSalaryKb(fallbackKb)) {
        app.log.warn(
          {
            preferredKbDir: path.join(salariesRepoRoot, "kb", "salaries"),
            fallbackKbDir: path.join(repoRoot, "kb", "salaries"),
          },
          "Preferred salary KB missing or empty; falling back to repo-root salary KB",
        );
        kb = fallbackKb;
        resolvedSalaryKbRoot = repoRoot;
      }
    }

    app.decorate("kb", kb);
    const nEntries = Object.keys(kb.salariesIndex || {}).length;
    const rankCount = Array.isArray(kb.rankMeta?.ranks) ? kb.rankMeta.ranks.length : 0;
    app.log.info(
          { kbDir: path.join(resolvedSalaryKbRoot, "kb", "salaries"), salaryEntries: nEntries, rankCount },
      "Watany salaries KB v4 loaded",
    );
  } catch (e) {
    app.log.error({ err: e }, "Watany salaries KB load failed");
  }

  // ── Runtime KB (JSON) ──────────────────────────────────────────
  (app as any).kb = (app as any).kb || loadRuntimeKbJson(runtimeKbPath) || null;

  // ── KB attachments route ───────────────────────────────────────
  app.register(kbAttachmentsRoutes);

  // ── SQLite KB store ────────────────────────────────────────────
  let kbStore: ReturnType<typeof createSqliteV3Store> | null = null;
  if (!useKbStub) {
    try {
      kbStore = createSqliteV3Store({ dbPath: kbPath });
    } catch (e) {
      app.log.warn({ err: e }, "KB store disabled (sqlite-wasm init failed)");
    }
  }

  // ── vNext KB nodes (FTS5) ──────────────────────────────────────
  if (disableKbNodes) {
    app.log.info({ kbNodesDbPath }, "kb_nodes_fts_disabled");
  } else {
    try {
      const ok = await initKbNodes(kbNodesDbPath);
      if (ok) {
        app.log.info({ kbNodesDbPath, stats: getKbNodesStats() }, "kb_nodes_fts_ready");
      } else {
        app.log.warn({ kbNodesDbPath }, "kb_nodes_fts_not_available");
      }
    } catch (err) {
      app.log.warn({ err, kbNodesDbPath }, "kb_nodes_fts_init_failed");
    }
  }

  // ── RAG chunks ─────────────────────────────────────────────────
  {
    const loaded = loadRagChunks(resolvedRagPath);
    app.log.info({ ragPath: resolvedRagPath, chunks: loaded }, "RAG chunks loaded (relevance + search)");
  }

  // ── Plugin DB ──────────────────────────────────────────────────
  const pluginDb = await initPluginDb(pluginDbPath, disablePluginDb, {
    info: app.log.info.bind(app.log),
    warn: app.log.warn.bind(app.log),
  });
  app.decorate("pluginDb", pluginDb);

  return { kbStore, pluginDb, resolvedRagPath, kbPath, runtimeKbPath };
}
