import { getClient } from "../lib/db";

const COMMUNITY_DB_TEST_LOCK_KEY = 2026062301;

/**
 * Community suites hold this lock for their whole file (acquired in beforeAll,
 * released in afterAll), so files that TRUNCATE the community tables never
 * interleave. Under parallel test files a suite can wait for others to finish,
 * so beforeAll needs a timeout well above vitest's 10s hook default.
 */
export const COMMUNITY_DB_TEST_LOCK_WAIT_MS = 300_000;

export async function acquireCommunityDbTestLock(): Promise<() => Promise<void>> {
  const client = await getClient();
  let released = false;

  try {
    await client.query("SELECT pg_advisory_lock($1)", [COMMUNITY_DB_TEST_LOCK_KEY]);
  } catch (error) {
    client.release();
    throw error;
  }

  return async () => {
    if (released) {
      return;
    }

    released = true;
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [COMMUNITY_DB_TEST_LOCK_KEY]);
    } finally {
      client.release();
    }
  };
}