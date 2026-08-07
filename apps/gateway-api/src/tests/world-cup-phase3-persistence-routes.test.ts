import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { worldCupRoutes } from "../routes/world-cup";
import { worldCupMatchSeed } from "../data/world-cup-seed";
import { resetCommunityStore } from "../community/service";
import { runMigrations } from "../db/migrate";
import { acquireCommunityDbTestLock } from "./community-db-test-lock";

let releaseDbTestLock: null | (() => Promise<void>) = null;

beforeAll(async () => {
  const release = await acquireCommunityDbTestLock();
  try {
    await runMigrations();
  } finally {
    await release();
  }
});

beforeEach(async () => {
  releaseDbTestLock = await acquireCommunityDbTestLock();
  await resetCommunityStore();
});

afterEach(async () => {
  if (releaseDbTestLock) {
    await releaseDbTestLock();
    releaseDbTestLock = null;
  }
});

describe("WAT-020 world cup phase 3 persistence wiring", () => {
  it("persists vote/favorite/reminder through the route persistence adapter", async () => {
    const app = Fastify();
    await app.register(worldCupRoutes, { prefix: "/api" });
    await app.ready();

    const vote = await app.inject({
      method: "POST",
      url: "/api/world-cup/polls/poll-champion-team/vote",
      payload: { userId: "test-user-persist", optionId: "الأرجنتين" }
    });
    expect(vote.statusCode).toBe(200);

    const votes = await app.inject({
      method: "GET",
      url: "/api/world-cup/votes?pollId=poll-champion-team"
    });
    expect(votes.statusCode).toBe(200);
    expect(votes.json().votes.length).toBeGreaterThan(0);

    const favorite = await app.inject({
      method: "POST",
      url: "/api/world-cup/favorites",
      payload: { userId: "test-user-persist", teamId: "argentina" }
    });
    expect(favorite.statusCode).toBe(200);

    const favorites = await app.inject({
      method: "GET",
      url: "/api/world-cup/favorites?userId=test-user-persist"
    });
    expect(favorites.statusCode).toBe(200);
    expect(favorites.json().favorites.length).toBeGreaterThan(0);

    const reminder = await app.inject({
      method: "POST",
      url: "/api/world-cup/reminders",
      payload: { userId: "test-user-persist", matchId: worldCupMatchSeed[0].id, remindAt: "2026-06-11T19:30:00Z" }
    });
    expect(reminder.statusCode).toBe(200);

    const reminders = await app.inject({
      method: "GET",
      url: "/api/world-cup/reminders?userId=test-user-persist"
    });
    expect(reminders.statusCode).toBe(200);
    expect(reminders.json().reminders.length).toBeGreaterThan(0);

    await app.close();
  });
});