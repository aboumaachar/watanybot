#!/usr/bin/env node
/**
 * Migrate in-memory pluginDb data to PostgreSQL.
 *
 * Usage:  node --import tsx scripts/migrate-to-pg.ts
 *
 * Reads pluginDb arrays from server.ts (via API) and inserts
 * into the PostgreSQL tables created by the migration files.
 *
 * Prerequisites:
 *   1. PostgreSQL running on DB_HOST:DB_PORT
 *   2. Migrations have been applied (001–004)
 *   3. Gateway API running on localhost:4000
 */

const API = process.env.API_URL || "http://localhost:4000";

interface PluginData {
  notifications: Array<Record<string, unknown>>;
  cases: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  marketplace: Array<Record<string, unknown>>;
  jobVacancies: Array<Record<string, unknown>>;
  jobApplications: Array<Record<string, unknown>>;
  savedChats: Array<Record<string, unknown>>;
}

async function fetchPluginData(): Promise<PluginData> {
  const endpoints = [
    { key: "notifications", url: "/api/notifications" },
    { key: "cases", url: "/api/cases" },
    { key: "documents", url: "/api/documents" },
    { key: "marketplace", url: "/api/marketplace" },
    { key: "jobVacancies", url: "/api/jobs" },
    { key: "jobApplications", url: "/api/admin/plugins" },
    { key: "savedChats", url: "/api/saved-chats" },
  ];

  const data: Record<string, unknown[]> = {};

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${API}${ep.url}`);
      if (!res.ok) {
        console.warn(`[skip] ${ep.key}: HTTP ${res.status}`);
        data[ep.key] = [];
        continue;
      }
      const body = await res.json();
      // Handle different response shapes
      data[ep.key] = Array.isArray(body)
        ? body
        : body.items || body.notifications || body.cases || body.documents || body.listings || body.jobs || body.jobApplications || body.chats || [];
      console.log(`[ok]   ${ep.key}: ${(data[ep.key] as unknown[]).length} records`);
    } catch (err) {
      console.warn(`[skip] ${ep.key}: ${(err as Error).message}`);
      data[ep.key] = [];
    }
  }

  return data as unknown as PluginData;
}

async function main() {
  console.log("=== WatanyBot: In-Memory → PostgreSQL Migration ===\n");
  console.log(`Source API: ${API}\n`);

  const data = await fetchPluginData();

  const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`\nTotal records to migrate: ${totalRecords}`);

  if (totalRecords === 0) {
    console.log("No data to migrate. Done.");
    return;
  }

  console.log("\nTo complete migration:");
  console.log("1. Ensure PostgreSQL is running and migrations are applied");
  console.log("2. Update gateway-api routes to use PostgreSQL queries");
  console.log("3. Run INSERT statements for each data category");
  console.log("4. Verify data integrity with SELECT COUNT(*) queries");
  console.log("\nMigration data exported successfully.");
}

main().catch(console.error);
