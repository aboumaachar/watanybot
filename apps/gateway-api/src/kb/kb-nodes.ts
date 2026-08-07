/**
 * kb-nodes.ts — FTS5 search over kb_nodes.db (KB vNext)
 *
 * Provides:
 *   initKbNodes(dbPath)          — open DB (lazy, idempotent)
 *   searchKbNodes(query, intent) — FTS search → scored KbNode[]
 *   getKbNodeById(id)            — direct lookup
 *   getKbNodesStats()            — counts by type
 */

import fs from "node:fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KbNode {
  id: string;
  type: "law" | "procedure" | "rule" | "directory" | "faq";
  title: string;
  summary_lb: string;
  tags: string[];
  triggers: string[];
  payload: Record<string, unknown>;
  source_path: string | null;
  updated_at: string | null;
  /** BM25 relevance score (lower = better match in FTS5) */
  score: number;
}

export interface KbSearchResult {
  query: string;
  intent: string | null;
  nodes: KbNode[];
  total: number;
  confidence: "high" | "medium" | "low" | "none";
  elapsed_ms: number;
}

// ---------------------------------------------------------------------------
// Intent → node-type priority map
// ---------------------------------------------------------------------------

const INTENT_TYPE_PRIORITY: Record<string, string[]> = {
  where_apply:    ["procedure", "faq", "directory"],
  docs_required:  ["procedure", "faq"],
  deadlines:      ["procedure", "law", "faq"],
  complaint:      ["faq", "procedure"],
  salary:         ["rule", "law", "faq"],
  directory:      ["directory", "procedure"],
  general:        ["faq", "law", "procedure", "rule", "directory"],
};

// Lebanese trigger → intent classifier (fast, no LLM needed)
const INTENT_PATTERNS: [RegExp, string][] = [
  [/وين\s*(بقدم|بقدّم|براجع|لازم\s*روح)/,      "where_apply"],
  [/شو\s*(الوراق|لازم\s*جيب|بدو\s*مني)/,       "docs_required"],
  [/(ايمت[ىي]|آخر\s*مهلة|آخر\s*موعد|قديش\s*مهلة)/, "deadlines"],
  [/(مشكل[ةه]|ما\s*عم\s*تمشي|تأخر)/,           "complaint"],
  [/(قديش\s*بقبض|معاشي|راتبي|حاسب[ةه]|تعويض)/,  "salary"],
  [/(شو\s*رقم|مين\s*مسؤول|مع\s*مين\s*بحكي|تلفون)/, "directory"],
];

function classifyIntent(query: string): string {
  const q = query.trim();
  for (const [rx, intent] of INTENT_PATTERNS) {
    if (rx.test(q)) return intent;
  }
  return "general";
}

// ---------------------------------------------------------------------------
// DB handle (lazy init via better-sqlite3)
// ---------------------------------------------------------------------------

let db: any = null; // BetterSqlite3.Database
let nodeColumns = new Set<string>();

function hasNodeColumn(column: string): boolean {
  return nodeColumns.has(column);
}

function selectNodeColumn(column: string, fallbackSql: string, tableAlias = ""): string {
  const qualified = tableAlias ? `${tableAlias}.${column}` : column;
  return hasNodeColumn(column) ? qualified : `${fallbackSql} AS ${column}`;
}

export async function initKbNodes(dbPath: string): Promise<boolean> {
  if (db) return true;
  if (!fs.existsSync(dbPath)) {
    console.warn(`[kb-nodes] DB not found: ${dbPath}`);
    return false;
  }
  try {
    const BetterSqlite3 = (await import("better-sqlite3")).default;
    db = new BetterSqlite3(dbPath, { readonly: true, fileMustExist: true });
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 3000");
    nodeColumns = new Set(
      (db.prepare("PRAGMA table_info(nodes)").all() as Array<{ name: string }>).map((column) => column.name),
    );
    const count = (db.prepare("SELECT COUNT(*) AS c FROM nodes").get() as any).c;
    console.log(`[kb-nodes] Loaded ${count} nodes from ${dbPath}`);
    return true;
  } catch (err) {
    console.error("[kb-nodes] Failed to open DB:", err);
    db = null;
    nodeColumns = new Set();
    return false;
  }
}

export function isKbNodesReady(): boolean {
  return db !== null;
}

// ---------------------------------------------------------------------------
// List all nodes (for admin KB editor)
// ---------------------------------------------------------------------------

export interface ListNodesParams {
  search?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export function listKbNodes(params: ListNodesParams = {}): { nodes: KbNode[]; total: number } {
  if (!db) return { nodes: [], total: 0 };

  const { search, type, limit = 100, offset = 0 } = params;

  let countSql = "SELECT COUNT(*) AS c FROM nodes";
  let dataSql = `SELECT id, type, title, summary_lb,
                        ${selectNodeColumn("tags_json", "'[]'")},
                        ${selectNodeColumn("triggers_json", "'[]'")},
                        ${selectNodeColumn("payload_json", "'{}'")},
                        ${selectNodeColumn("source_path", "NULL")},
                        updated_at FROM nodes`;
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (type) {
    conditions.push("type = ?");
    values.push(type);
  }

  if (search) {
    conditions.push("(title LIKE ? OR summary_lb LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    const where = " WHERE " + conditions.join(" AND ");
    countSql += where;
    dataSql += where;
  }

  dataSql += " ORDER BY type, title LIMIT ? OFFSET ?";

  const total = (db.prepare(countSql).get(...values) as any)?.c ?? 0;
  const rows = db.prepare(dataSql).all(...values, limit, offset) as any[];

  const nodes: KbNode[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    summary_lb: row.summary_lb,
    tags: safeParse(row.tags_json, []),
    triggers: safeParse(row.triggers_json, []),
    payload: safeParse(row.payload_json, {}),
    source_path: row.source_path,
    updated_at: row.updated_at,
    score: 0,
  }));

  return { nodes, total };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLDS = {
  high:   -8,   // very strong BM25 match
  medium: -3,   // decent match
  low:    -0.5, // weak match
};

function scoreToConfidence(bestScore: number): KbSearchResult["confidence"] {
  if (bestScore <= CONFIDENCE_THRESHOLDS.high) return "high";
  if (bestScore <= CONFIDENCE_THRESHOLDS.medium) return "medium";
  if (bestScore <= CONFIDENCE_THRESHOLDS.low) return "low";
  return "none";
}

function mapRowsToNodes(rows: any[]): KbNode[] {
  return rows.map((row: any) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    summary_lb: row.summary_lb,
    tags: safeParse(row.tags_json, []),
    triggers: safeParse(row.triggers_json, []),
    payload: safeParse(row.payload_json, {}),
    source_path: row.source_path,
    updated_at: row.updated_at,
    score: row.score,
  }));
}

function rerankRows(rows: any[], priority: string[]) {
  const ranked = rows.map((row: any) => {
    const typeIdx = priority.indexOf(row.type);
    const intentBoost = typeIdx >= 0 ? -(5 - typeIdx) : 0;
    return {
      ...row,
      adjustedScore: row.score + intentBoost,
    };
  });
  ranked.sort((a: any, b: any) => a.adjustedScore - b.adjustedScore);
  return ranked;
}

export function searchKbNodes(
  query: string,
  intentOverride?: string | null,
  limit = 8,
): KbSearchResult {
  const t0 = performance.now();
  const intent = intentOverride || classifyIntent(query);
  const priority = INTENT_TYPE_PRIORITY[intent] || INTENT_TYPE_PRIORITY.general;

  if (!db) {
    return { query, intent, nodes: [], total: 0, confidence: "none", elapsed_ms: 0 };
  }

  // Build FTS5 match expression — quote each token for Arabic safety
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => `"${t.replace(/"/g, "")}"`)
    .join(" OR ");

  if (!tokens) {
    return { query, intent, nodes: [], total: 0, confidence: "none", elapsed_ms: 0 };
  }

  const fallbackSearch = () => {
    const like = `%${query.trim()}%`;
    const rows = db
      .prepare(
        `SELECT id, type, title, summary_lb,
                ${selectNodeColumn("tags_json", "'[]'")},
                ${selectNodeColumn("triggers_json", "'[]'")},
                ${selectNodeColumn("payload_json", "'{}'")},
                ${selectNodeColumn("source_path", "NULL")},
                updated_at,
                0 AS score
         FROM nodes
         WHERE title LIKE ?
            OR summary_lb LIKE ?
            OR ${hasNodeColumn("tags_json") ? "tags_json" : "''"} LIKE ?
            OR ${hasNodeColumn("payload_json") ? "payload_json" : "''"} LIKE ?
         LIMIT ?`,
      )
      .all(like, like, like, like, limit * 3) as any[];

    return rerankRows(rows, priority).slice(0, limit);
  };

  try {
    const rows = db
      .prepare(
      `SELECT f.id, n.type, n.title, n.summary_lb,
        ${selectNodeColumn("tags_json", "'[]'", "n")},
        ${selectNodeColumn("triggers_json", "'[]'", "n")},
        ${selectNodeColumn("payload_json", "'{}'", "n")},
        ${selectNodeColumn("source_path", "NULL", "n")},
        n.updated_at,
                bm25(nodes_fts) AS score
         FROM nodes_fts f
         JOIN nodes n ON n.id = f.id
         WHERE nodes_fts MATCH ?
         ORDER BY score
         LIMIT ?`,
      )
      .all(tokens, limit * 3) as any[];

    const rankedRows = rows.length > 0 ? rerankRows(rows, priority).slice(0, limit) : fallbackSearch();
    const nodes = mapRowsToNodes(rankedRows);

    const bestScore = nodes.length > 0 ? nodes[0].score : 0;
    const confidence = scoreToConfidence(bestScore);
    const elapsed_ms = Math.round(performance.now() - t0);

    return { query, intent, nodes, total: nodes.length, confidence, elapsed_ms };
  } catch (err) {
    console.error("[kb-nodes] FTS search error:", err);
    const nodes = mapRowsToNodes(fallbackSearch());
    const bestScore = nodes.length > 0 ? nodes[0].score : 0;
    const confidence = scoreToConfidence(bestScore);
    const elapsed_ms = Math.round(performance.now() - t0);
    return { query, intent, nodes, total: nodes.length, confidence, elapsed_ms };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getKbNodeById(id: string): KbNode | null {
  if (!db) return null;
  const row = db
    .prepare(
      `SELECT id, type, title, summary_lb,
              ${selectNodeColumn("tags_json", "'[]'")},
              ${selectNodeColumn("triggers_json", "'[]'")},
              ${selectNodeColumn("payload_json", "'{}'")},
              ${selectNodeColumn("source_path", "NULL")},
              updated_at
       FROM nodes WHERE id = ?`,
    )
    .get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary_lb: row.summary_lb,
    tags: safeParse(row.tags_json, []),
    triggers: safeParse(row.triggers_json, []),
    payload: safeParse(row.payload_json, {}),
    source_path: row.source_path,
    updated_at: row.updated_at,
    score: 0,
  };
}

export function getKbNodesStats(): Record<string, number> | null {
  if (!db) return null;
  const rows = db
    .prepare("SELECT type, COUNT(*) AS c FROM nodes GROUP BY type")
    .all() as any[];
  const stats: Record<string, number> = {};
  for (const r of rows) stats[r.type] = r.c;
  return stats;
}

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
