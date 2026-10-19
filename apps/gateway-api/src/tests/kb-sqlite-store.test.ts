import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSqliteV3Store } from "@watany/kb";

// The production KB file (watany_kb_tables_v4/Watany_KB_v4.sqlite) is a
// rollback-journal database opened read-only. These tests only ever touch
// disposable copies in a temp directory.
const REAL_KB = process.env.KB_SQLITE_TEST_COPY_SOURCE
  || path.resolve(__dirname, "../../../../watany_kb_tables_v4/Watany_KB_v4.sqlite");

let tmpDir: string;

function makeJournalDb(file: string) {
  const db = new Database(file);
  db.pragma("journal_mode = DELETE");
  db.exec(`
    CREATE TABLE kb_transactions (id INTEGER PRIMARY KEY, title TEXT);
    CREATE TABLE kb_rag_chunks (id INTEGER PRIMARY KEY, body TEXT);
    INSERT INTO kb_transactions (title) VALUES ('a'), ('b');
    INSERT INTO kb_rag_chunks (body) VALUES ('x');
  `);
  db.close();
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-sqlite-store-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createSqliteV3Store", () => {
  it("reads a read-only rollback-journal database without trying to switch it to WAL", async () => {
    const file = path.join(tmpDir, "journal.sqlite");
    makeJournalDb(file);
    const before = fs.readFileSync(file);

    const store = createSqliteV3Store({ dbPath: file });
    const stats = await store.stats();
    store.close();

    expect(stats.error).toBeUndefined();
    expect(stats.tables).toEqual(["kb_rag_chunks", "kb_transactions"]);
    expect(stats.transactions).toBe(2);
    expect(stats.ragChunks).toBe(1);
    expect(stats.dbSizeKb).toBeGreaterThan(0);
    // Read-only: the file is byte-identical and no WAL/SHM sidecars appear.
    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect(fs.existsSync(`${file}-wal`)).toBe(false);
  });

  it("reports the failure reason and stays empty for a missing file", async () => {
    const store = createSqliteV3Store({ dbPath: path.join(tmpDir, "missing.sqlite") });
    const first = await store.stats();
    const second = await store.stats();

    expect(first.tables).toEqual([]);
    expect(first.error).toBeTruthy();
    expect(second.tables).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, "missing.sqlite"))).toBe(false);
  });

  it.runIf(fs.existsSync(REAL_KB))("reads a disposable copy of the real KB v4 database", async () => {
    const copy = path.join(tmpDir, "Watany_KB_v4.copy.sqlite");
    fs.copyFileSync(REAL_KB, copy);

    const store = createSqliteV3Store({ dbPath: copy });
    const stats = await store.stats();
    store.close();

    expect(stats.error).toBeUndefined();
    expect(stats.tables).toContain("kb_transactions");
    expect(stats.tables).toContain("kb_rag_chunks");
    expect(stats.transactions).toBeGreaterThan(0);
    expect(stats.ragChunks).toBeGreaterThan(0);
  });
});
