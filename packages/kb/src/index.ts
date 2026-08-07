/**
 * @watany/kb — Lightweight SQLite KB store for the gateway.
 *
 * Provides a `createSqliteV3Store` factory that wraps the
 * Watany KB v4 SQLite database (read-only, WAL mode).
 */
import Database from "better-sqlite3";
import { statSync } from "node:fs";

export interface SqliteV3StoreOptions {
  dbPath: string;
}

export interface KbStats {
  tables: string[];
  transactions: number;
  ragChunks: number;
  lawArticles: number;
  salaryRecords: number;
  knowledgeChunks: number;
  dbSizeKb: number;
}

export function createSqliteV3Store(opts: SqliteV3StoreOptions) {
  let db: Database.Database | null = null;

  function getDb(): Database.Database {
    if (!db) {
      db = new Database(opts.dbPath, { readonly: true });
      db.pragma("journal_mode = WAL");
      db.pragma("cache_size = -8192");
    }
    return db;
  }

  function safeCount(table: string): number {
    try {
      const row = getDb().prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
      return row?.cnt ?? 0;
    } catch {
      return 0;
    }
  }

  async function stats(): Promise<KbStats> {
    try {
      const conn = getDb();
      const tables = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all()
        .map((r: any) => r.name as string);

      return {
        tables,
        transactions: safeCount("kb_transactions"),
        ragChunks: safeCount("kb_rag_chunks"),
        lawArticles: safeCount("law_articles"),
        salaryRecords: safeCount("salary_data"),
        knowledgeChunks: safeCount("knowledge_chunks"),
        dbSizeKb: Math.round((statSync(opts.dbPath).size || 0) / 1024),
      };
    } catch {
      return {
        tables: [],
        transactions: 0,
        ragChunks: 0,
        lawArticles: 0,
        salaryRecords: 0,
        knowledgeChunks: 0,
        dbSizeKb: 0,
      };
    }
  }

  return { stats };
}
