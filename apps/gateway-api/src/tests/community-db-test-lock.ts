import { getClient } from "../lib/db";

const COMMUNITY_DB_TEST_LOCK_KEY = 2026062301;

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