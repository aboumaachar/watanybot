import { describe, expect, it } from "vitest";
import pg from "pg";
import { runMigrations } from "../migrate";

function getSafeTestUrl(): string | undefined {
  const value = process.env.APEX_V119_TEST_DATABASE_URL;
  if (!value) return undefined;
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!(["127.0.0.1", "localhost", "::1"].includes(host))) throw new Error("APEX_V119_TEST_DATABASE_URL must target loopback");
  if (!/(test|apex_v119)/i.test(database)) throw new Error("APEX_V119_TEST_DATABASE_URL must target a disposable test database");
  return value;
}

describe("APEX V1.0.19 migration 031 runtime proof", () => {
  it.runIf(Boolean(process.env.APEX_V119_TEST_DATABASE_URL))("runs the repository migration chain and remains idempotent", async () => {
    const connectionString = getSafeTestUrl();
    if (!connectionString) return;
    const pool = new pg.Pool({ connectionString });
    await runMigrations();
    const before = await pool.query<{ name: string; count: string }>(
      "SELECT name, count(*)::text AS count FROM _migrations WHERE name LIKE '031_%' OR name = '032_marketplace_job_applications.sql' GROUP BY name ORDER BY name",
    );
    await runMigrations();
    const after = await pool.query<{ name: string; count: string }>(
      "SELECT name, count(*)::text AS count FROM _migrations WHERE name LIKE '031_%' OR name = '032_marketplace_job_applications.sql' GROUP BY name ORDER BY name",
    );
    const columns = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'community_messages' AND column_name IN ('is_forwarded', 'forward_source_message_id') ORDER BY column_name",
    );
    const marketplace = await pool.query<{ table_name: string | null }>("SELECT to_regclass('public.marketplace_job_applications') AS table_name");
    expect(before.rows).toEqual([
      { name: "031_community_chats_forward_message.sql", count: "1" },
      { name: "031_seasonal_apple_job_applications.sql", count: "1" },
      { name: "032_marketplace_job_applications.sql", count: "1" },
    ]);
    expect(after.rows).toEqual(before.rows);
    expect(columns.rows.map((row) => row.column_name)).toEqual(["forward_source_message_id", "is_forwarded"]);
    expect(marketplace.rows[0].table_name).toBe("marketplace_job_applications");
    await pool.end();
  });
});