import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migrate";
import { query } from "../lib/db";
import { communityRoutes } from "../routes/community";
import { acquireCommunityDbTestLock } from "./community-db-test-lock";

let releaseDbTestLock: null | (() => Promise<void>) = null;

beforeAll(async () => {
  releaseDbTestLock = await acquireCommunityDbTestLock();
  await runMigrations();
});

afterAll(async () => {
  if (releaseDbTestLock) {
    await releaseDbTestLock();
    releaseDbTestLock = null;
  }
});

describe("community legacy schema compatibility", () => {
  it("serves groups when forwarding columns from migration 033 are absent", async () => {
    const app = Fastify({ logger: false });
    app.register(communityRoutes);
    await app.ready();

    await query(`
      ALTER TABLE community_messages
        DROP COLUMN IF EXISTS is_forwarded,
        DROP COLUMN IF EXISTS forward_source_message_id
    `);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/community/groups",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ groups: expect.any(Array) }));
    } finally {
      await query(`
        ALTER TABLE community_messages
          ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS forward_source_message_id TEXT
      `);
      await app.close();
    }
  });
});
