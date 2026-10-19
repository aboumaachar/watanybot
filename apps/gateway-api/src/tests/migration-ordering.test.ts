/**
 * Static guard for the migration runner's ordering contract.
 *
 * src/db/migrate.ts applies migrations/*.sql in filename sort order on an empty
 * database. A migration that ALTERs a table created by a later-sorting file
 * breaks fresh installs (050_community_message_stars_text_identity.sql vs
 * 20260626_community_message_stars.sql did exactly that). This test replays the
 * runner's order and fails on any `ALTER TABLE x` (without IF EXISTS) that
 * runs before the first `CREATE TABLE x`. No database is needed.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(__dirname, "../db/migrations");
const STATEMENT = /\b(CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?|ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(?:ONLY\s+)?)(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi;

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

/** Same selection and order as runMigrations(). */
function runnerOrder(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
}

function alterBeforeCreate(files: string[]): string[] {
  const created = new Set<string>();
  const problems: string[] = [];
  for (const file of files) {
    const sql = stripComments(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    for (const match of sql.matchAll(STATEMENT)) {
      const table = match[3].toLowerCase();
      if (/^CREATE/i.test(match[1])) created.add(table);
      else if (!match[2] && !created.has(table)) problems.push(`${file}: ALTER TABLE ${table} runs before any CREATE TABLE ${table}`);
    }
  }
  return problems;
}

describe("migration ordering (fresh install)", () => {
  it("never alters a table before a migration that creates it", () => {
    expect(alterBeforeCreate(runnerOrder())).toEqual([]);
  });

  it("creates community_message_stars before 050 alters it", () => {
    const order = runnerOrder();
    const prerequisite = order.indexOf("049_zz_community_message_stars_prerequisite.sql");
    expect(prerequisite).toBeGreaterThan(-1);
    expect(prerequisite).toBeLessThan(order.indexOf("050_community_message_stars_text_identity.sql"));
    expect(prerequisite).toBeGreaterThan(order.indexOf("024_community_chats_phase1.sql")); // community_messages
  });

  it("detects the original defect when the prerequisite is absent", () => {
    const withoutPrerequisite = runnerOrder().filter((f) => f !== "049_zz_community_message_stars_prerequisite.sql");
    expect(alterBeforeCreate(withoutPrerequisite).some((p) => p.startsWith("050_community_message_stars_text_identity.sql"))).toBe(true);
  });
});
