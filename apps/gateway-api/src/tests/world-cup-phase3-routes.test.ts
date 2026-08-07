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

describe("WAT-020 world cup phase 3 routes", () => {
  it("returns teams, players, matches, polls, live status, and news feeds", async () => {
    const app = Fastify();
    await app.register(worldCupRoutes, { prefix: "/api" });
    await app.ready();

    for (const url of [
      "/api/world-cup/teams",
      "/api/world-cup/players",
      "/api/world-cup/matches",
      "/api/world-cup/polls",
      "/api/world-cup/live",
      "/api/world-cup/news",
      "/api/world-cup/news/breaking",
      "/api/world-cup/news/sources",
    ]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
    }

    await app.close();
  });

  it("serves complete published world cup snapshot counts", async () => {
    const app = Fastify();
    await app.register(worldCupRoutes, { prefix: "/api" });
    await app.ready();

    const teamsRes = await app.inject({ method: "GET", url: "/api/world-cup/teams" });
    const matchesRes = await app.inject({ method: "GET", url: "/api/world-cup/matches" });
    const playersRes = await app.inject({ method: "GET", url: "/api/world-cup/players" });

    expect(teamsRes.statusCode).toBe(200);
    expect(matchesRes.statusCode).toBe(200);
    expect(playersRes.statusCode).toBe(200);

    const teamsPayload = teamsRes.json() as { teams: Array<{ id: string; nameAr: string; group: string; players: unknown[] }> };
    const matchesPayload = matchesRes.json() as { matches: Array<{ id: string; teamA: string; teamB: string; stage: string }> };
    const playersPayload = playersRes.json() as { players: Array<{ id: string; teamId: string }> };

    expect(teamsPayload.teams.length).toBe(48);
    expect(matchesPayload.matches.length).toBe(72);
    expect(playersPayload.players.length).toBe(240);
    expect(teamsPayload.teams.every((team) => Array.isArray(team.players) && team.players.length === 5)).toBe(true);

    expect(teamsPayload.teams.some((team) => team.id === "argentina" && team.nameAr === "الأرجنتين")).toBe(true);
    expect(matchesPayload.matches.some((match) => match.id === "wc-2026-match-001" && match.teamA === "المكسيك" && match.teamB === "جنوب أفريقيا" && match.stage === "Group A")).toBe(true);

    await app.close();
  });

  it("accepts a foundation favorite and reminder", async () => {
    const app = Fastify();
    await app.register(worldCupRoutes, { prefix: "/api" });
    await app.ready();

    const favorite = await app.inject({
      method: "POST",
      url: "/api/world-cup/favorites",
      payload: { userId: "test-user", teamId: "argentina" }
    });
    expect(favorite.statusCode).toBe(200);

    const reminder = await app.inject({
      method: "POST",
      url: "/api/world-cup/reminders",
      payload: { userId: "test-user", matchId: worldCupMatchSeed[0].id, remindAt: "2026-06-11T19:30:00Z" }
    });
    expect(reminder.statusCode).toBe(200);

    await app.close();
  });

  it("publishes world cup polls for groups and notifications", async () => {
    const app = Fastify();
    await app.register(worldCupRoutes, { prefix: "/api" });
    await app.ready();

    const publish = await app.inject({
      method: "POST",
      url: "/api/world-cup/polls/publish",
      payload: { force: true },
    });

    expect(publish.statusCode).toBe(200);
    const payload = publish.json() as {
      ok: boolean;
      published: boolean;
      pollsCount: number;
      groupsPosted: number;
    };
    expect(payload.ok).toBe(true);
    expect(payload.published).toBe(true);
    expect(payload.pollsCount).toBeGreaterThan(0);
    expect(payload.groupsPosted).toBeGreaterThan(0);

    await app.close();
  });
});