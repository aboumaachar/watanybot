/**
 * No database connection: validates every local SQL file against the
 * transaction-safety rules before the first PostgreSQL query.
 */
import path from "node:path";
import fs from "node:fs";
import type { PoolClient } from "pg";
import { applyMigrationDirectory } from "../src/db/migrate.js";

const dir = path.resolve("src/db/migrations");
const count = fs.readdirSync(dir).filter(name => name.endsWith(".sql")).length;
const expected = "GATE2_PREFLIGHT_STOP_BEFORE_DATABASE";
const dummy = {
  query: async () => { throw new Error(expected); },
} as unknown as Pick<PoolClient, "query">;

let matched = false;
try {
  await applyMigrationDirectory(dummy, dir);
} catch (err) {
  matched = err instanceof Error && err.message === expected;
  if (!matched) throw err;
}
if (!matched || count < 59) {
  throw new Error("GATE2_SOURCE_PREFLIGHT_INCOMPLETE");
}
console.log("GATE2_SOURCE_PREFLIGHT_PASS fileCount=" + count);
