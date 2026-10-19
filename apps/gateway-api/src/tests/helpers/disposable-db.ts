/**
 * Fail-closed guard for tests that write to a real PostgreSQL database.
 *
 * Such tests insert and delete users, sessions and OTP rows, so they must only
 * ever run against a throwaway database. "DATABASE_URL is set" is not enough:
 * it could point at a shared or production database. All three must hold:
 *
 *   1. the host is local (127.0.0.1, localhost or ::1)
 *   2. the database name contains "test"
 *   3. WATANY_TEST_DB_DISPOSABLE=true is set explicitly
 *
 * Otherwise this throws before any query runs.
 */
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function assertDisposableTestDatabase(env: NodeJS.ProcessEnv = process.env): void {
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error("DISPOSABLE_DB_GUARD: DATABASE_URL is not set");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DISPOSABLE_DB_GUARD: DATABASE_URL is not a valid URL");
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    throw new Error(`DISPOSABLE_DB_GUARD: unsupported protocol ${url.protocol}`);
  }
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`DISPOSABLE_DB_GUARD: host ${url.hostname} is not local`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/test/i.test(database)) {
    throw new Error(`DISPOSABLE_DB_GUARD: database "${database}" is not a test database`);
  }
  if (env.WATANY_TEST_DB_DISPOSABLE?.trim().toLowerCase() !== "true") {
    throw new Error("DISPOSABLE_DB_GUARD: set WATANY_TEST_DB_DISPOSABLE=true to confirm this database is disposable");
  }
}
