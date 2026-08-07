/**
 * Run all SQL migrations in order against the configured PostgreSQL database.
 *
 * Usage:  tsx apps/gateway-api/src/db/migrate.ts
 * Or called programmatically from server startup.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "../lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

export async function runMigrations(): Promise<void> {
  // Ensure tracking table exists
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await query<{ name: string }>("SELECT name FROM _migrations ORDER BY name")).rows.map(r => r.name),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlRaw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const sql = sqlRaw.charCodeAt(0) === 0xfeff ? sqlRaw.slice(1) : sqlRaw;
    console.log(`[migrate] applying ${file}…`);
    await query(sql);
    await query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
    console.log(`[migrate] ✓ ${file}`);
  }

  console.log("[migrate] all migrations applied");
}

// Allow running directly: tsx src/db/migrate.ts
if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => closePool())
    .catch(err => {
      console.error("[migrate] FATAL:", err);
      process.exit(1);
    });
}
