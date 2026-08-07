/**
 * bootstrap/helpers.ts
 * Small pure utility functions used during server startup.
 * No Fastify dependency — safe to import anywhere.
 */
import path from "node:path";
import fs from "node:fs";

function parseJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as T;
}

/** Read a JSON file; return `fallback` if missing or unparseable. */
export function loadJson(p: string, fallback: Record<string, any>): Record<string, any> {
  if (!fs.existsSync(p)) return fallback;
  try {
    return parseJsonFile<Record<string, any>>(p);
  } catch {
    return fallback;
  }
}

/** Load the local salaries KB from the repo's kb/salaries directory. */
export function loadLocalSalariesKB(repoRoot: string): { salariesIndex: Record<string, any>; rankMeta: Record<string, any> } {
  const dir = path.join(repoRoot, "kb", "salaries");
  return {
    salariesIndex: loadJson(path.join(dir, "salariesIndex.json"), {}),
    rankMeta:      loadJson(path.join(dir, "rankMeta.json"), {}),
  };
}

/** Read a runtime KB JSON file; return null on any error. */
export function loadRuntimeKbJson(p: string): Record<string, any> | null {
  try {
    if (!fs.existsSync(p)) return null;
    return parseJsonFile<Record<string, any>>(p);
  } catch {
    return null;
  }
}

/** Whether PostgreSQL migrations should run (opt-out via env). */
export function shouldRunPgMigrations(): boolean {
  const raw = (process.env.RUN_PG_MIGRATIONS || "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}
