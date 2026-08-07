import type { FastifyPluginAsync } from "fastify";
import { worldCupMatchSeed } from "../data/world-cup-seed";
import { worldCupTeamsSeed } from "../data/world-cup-teams-seed";
import { worldCupNewsCrawlSources } from "../data/world-cup-news-seed";
import type { PluginDb } from "../types/domain";
import { worldCupPersistence, configureWorldCupPersistence } from "./world-cup-db";
import { createDefaultWorldCupService } from "../worldcup";
import { getCachedWorldCupPlayerImage, primeWorldCupPlayerImageCache } from "../worldcup/player-image-crawler";
import { getWorldCupLiveSnapshot, listLatestWorldCupMatches, listTodayWorldCupMatches, resolveWorldCupMatchById } from "./world-cup-live";
import { publishWorldCupMatchSnapshot } from "../ws/world-cup-ws";
import { addCommunityMessage, listCommunityGroups } from "../community/service";
import { listBreakingWorldCupNewsItems, listWorldCupNewsItems } from "../worldcup/world-cup-news-ingestion";

type VoteBody = { userId?: string; optionId?: string };
type FavoriteBody = { userId?: string; teamId?: string };
type ReminderBody = { userId?: string; matchId?: string; remindAt?: string };
type MatchChatBody = { userId?: string; author?: string; text?: string };
type PublishWorldCupPollsBody = { force?: boolean };

interface WorldCupRoutesOptions {
  pluginDb?: PluginDb;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type WorldCupRoutePoll = {
  id: string;
  type: "champion_team" | "best_player" | "match_winner";
  title: string;
  question: string;
  options: string[];
};

const inMemoryPollAnnouncementKeys = new Set<string>();

function buildWorldCupRoutePolls(): WorldCupRoutePoll[] {
  const championOptions = worldCupTeamsSeed.map((team) => team.nameAr);
  const bestPlayerOptions = worldCupTeamsSeed.flatMap((team) => team.players.map((player) => player.id));
  const matchPolls: WorldCupRoutePoll[] = worldCupMatchSeed.map((match) => ({
    id: `poll-match-winner-${match.id}`,
    type: "match_winner",
    title: `تصويت المباراة: ${match.teamA} ضد ${match.teamB}`,
    question: `من تتوقع يفوز في مباراة ${match.teamA} ضد ${match.teamB}؟`,
    options: [match.teamA, "تعادل", match.teamB],
  }));

  return [
    {
      id: "poll-champion-team",
      type: "champion_team",
      title: "توقع بطل كأس العالم",
      question: "من تتوقع أن يفوز بكأس العالم؟",
      options: championOptions,
    },
    {
      id: "poll-best-player",
      type: "best_player",
      title: "تصويت أفضل لاعب في كأس العالم",
      question: "المرحلة الأولى: اختر المنتخب ثم اختر اللاعب للتصويت على أفضل لاعب في البطولة.",
      options: bestPlayerOptions,
    },
    ...matchPolls,
  ];
}

function optionAllowed(poll: WorldCupRoutePoll, optionId: string) {
  return (poll.options as readonly string[]).includes(optionId);
}

function ensureWorldCupPollAnnouncementSchema(pluginDb: PluginDb): void {
  pluginDb.prepare(`
    CREATE TABLE IF NOT EXISTS world_cup_poll_announcements (
      announcement_key TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    )
  `).run();
}

async function announceWorldCupPollsToCommunity(announcementText: string): Promise<number> {
  const { groups } = await listCommunityGroups();
  let posted = 0;

  for (const group of groups) {
    const message = await addCommunityMessage(group.id, {
      id: makeId("world_cup_poll_announcement"),
      groupId: group.id,
      senderId: "system",
      senderName: "إدارة موطني",
      senderRole: "system",
      type: "announcement",
      body: announcementText,
      createdAt: new Date().toISOString(),
    });

    if (message.ok) {
      posted += 1;
    }
  }

  return posted;
}

function announceWorldCupPollsToNotifications(pluginDb: PluginDb, notificationBody: string): void {
  const now = Date.now();
  pluginDb
    .prepare("INSERT INTO notifications (id, title, body, kind, ts, read, user_id, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      `notif_worldcup_polls_${now}`,
      "تصويتات كأس العالم أصبحت جاهزة",
      notificationBody,
      "system",
      now,
      0,
      null,
      "route",
      "/world-cup/polls",
    );
}

function shouldAnnounceWorldCupPollSet(pluginDb: PluginDb | undefined, announcementKey: string): boolean {
  if (!pluginDb) {
    if (inMemoryPollAnnouncementKeys.has(announcementKey)) {
      return false;
    }

    inMemoryPollAnnouncementKeys.add(announcementKey);
    return true;
  }

  ensureWorldCupPollAnnouncementSchema(pluginDb);
  const result = pluginDb
    .prepare("INSERT OR IGNORE INTO world_cup_poll_announcements (announcement_key, created_at) VALUES (?, ?)")
    .run(announcementKey, Date.now());

  return result.changes > 0;
}

async function publishWorldCupPollLaunch(pluginDb: PluginDb | undefined, polls: WorldCupRoutePoll[], force = false): Promise<{
  published: boolean;
  groupsPosted: number;
  notificationPosted: boolean;
  reason?: string;
}> {
  const announcementKey = `wc_polls_v1_${polls.length}`;
  if (!force && !shouldAnnounceWorldCupPollSet(pluginDb, announcementKey)) {
    return {
      published: false,
      groupsPosted: 0,
      notificationPosted: false,
      reason: "already_published",
    };
  }

  if (force && pluginDb) {
    ensureWorldCupPollAnnouncementSchema(pluginDb);
    pluginDb
      .prepare("INSERT OR REPLACE INTO world_cup_poll_announcements (announcement_key, created_at) VALUES (?, ?)")
      .run(announcementKey, Date.now());
  }

  const announcementText = "تم إطلاق تصويتات كأس العالم الجديدة: بطل البطولة، أفضل لاعب، وتصويت مستقل لكل مباراة. شاركوا الآن عبر صفحة التصويتات.";
  const groupsPosted = await announceWorldCupPollsToCommunity(announcementText);

  if (!pluginDb) {
    return {
      published: true,
      groupsPosted,
      notificationPosted: false,
    };
  }

  const notificationBody = groupsPosted > 0
    ? `انطلقت تصويتات كأس العالم وتم نشرها في ${groupsPosted} مجموعات داخل المجتمع. شارك الآن.`
    : "انطلقت تصويتات كأس العالم: بطل البطولة، أفضل لاعب، ولكل مباراة تصويت مستقل. شارك الآن.";
  announceWorldCupPollsToNotifications(pluginDb, notificationBody);

  return {
    published: true,
    groupsPosted,
    notificationPosted: true,
  };
}

async function maybeBroadcastWorldCupPollLaunch(pluginDb: PluginDb | undefined, polls: WorldCupRoutePoll[]): Promise<void> {
  await publishWorldCupPollLaunch(pluginDb, polls, false);
}

export const worldCupRoutes: FastifyPluginAsync<WorldCupRoutesOptions> = async (app, { pluginDb }) => {
  configureWorldCupPersistence(pluginDb ?? null);
  const worldCupService = createDefaultWorldCupService();

  app.get("/world-cup/matches", async () => {
    const matches = await Promise.all(
      worldCupMatchSeed.map(async (seedMatch) => {
        return resolveWorldCupMatchById(seedMatch.id, worldCupService);
      })
    );

    return {
      matches: matches.filter((match): match is NonNullable<typeof match> => Boolean(match)),
    };
  });

  app.get<{ Params: { id: string } }>("/world-cup/matches/:id", async (request, reply) => {
    const match = await resolveWorldCupMatchById(request.params.id, worldCupService);
    if (!match) {
      return reply.code(404).send({ error: "match not found" });
    }

    return { match };
  });

  app.get("/world-cup/home/today-matches", async () => {
    const matches = await listTodayWorldCupMatches(worldCupService);

    return { matches, generatedAt: new Date().toISOString() };
  });

  app.get("/world-cup/today", async () => {
    const matches = await listTodayWorldCupMatches(worldCupService);
    return { matches, generatedAt: new Date().toISOString() };
  });

  app.get("/world-cup/live", async () => {
    const matches = await listLatestWorldCupMatches(worldCupService, 8);
    return {
      status: "ok",
      generatedAt: new Date().toISOString(),
      matches,
    };
  });

  app.get("/world-cup/live-links", async () => ({
    links: [
      { label: "FIFA - المصدر الرسمي", url: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026" }
    ]
  }));

  app.get("/world-cup/teams", async () => ({ teams: worldCupTeamsSeed }));

  app.get("/world-cup/news", async () => ({
    generatedAt: new Date().toISOString(),
    items: pluginDb ? listWorldCupNewsItems(pluginDb, 30) : [],
  }));

  app.get("/world-cup/news/breaking", async () => ({
    generatedAt: new Date().toISOString(),
    items: pluginDb ? listBreakingWorldCupNewsItems(pluginDb, 10) : [],
  }));

  app.get("/world-cup/news/sources", async () => ({
    generatedAt: new Date().toISOString(),
    sources: worldCupNewsCrawlSources,
    note: "Configured sources are crawled by the World Cup news ingestion job and written into news_items.",
  }));

  app.get("/world-cup/players", async () => {
    const players = worldCupTeamsSeed.flatMap((team) =>
      team.players.map((player) => {
        const cached = getCachedWorldCupPlayerImage(player.name, team.code);
        const imageUrl = cached?.imageUrl ?? player.imageFallbackUrl ?? undefined;

        primeWorldCupPlayerImageCache(player.name, team.code);

        return {
          ...player,
          teamId: team.id,
          teamCode: team.code,
          teamNameAr: team.nameAr,
          teamNameEn: team.nameEn,
          imageUrl,
          imageSource: cached?.imageSource ?? "fallback",
          imageFallbackUrl: player.imageFallbackUrl,
        };
      })
    );

    return { players };
  });

  app.get("/world-cup/polls", async () => {
    const polls = buildWorldCupRoutePolls();
    await maybeBroadcastWorldCupPollLaunch(pluginDb, polls);
    return { polls };
  });

  app.post<{ Body: PublishWorldCupPollsBody }>("/world-cup/polls/publish", async (request) => {
    const polls = buildWorldCupRoutePolls();
    const force = request.body?.force === true;
    const result = await publishWorldCupPollLaunch(pluginDb, polls, force);

    return {
      ok: true,
      force,
      pollsCount: polls.length,
      ...result,
    };
  });

  app.get<{ Querystring: { pollId?: string } }>("/world-cup/votes", async (request) => {
    return { votes: await worldCupPersistence.listVotes(request.query.pollId) };
  });

  app.post<{ Params: { id: string }; Body: VoteBody }>("/world-cup/polls/:id/vote", async (request, reply) => {
    const pollId = request.params.id;
    const userId = request.body?.userId;
    const optionId = request.body?.optionId;

    if (!userId || !optionId) return reply.code(400).send({ error: "userId and optionId are required" });

    const poll = buildWorldCupRoutePolls().find((item) => item.id === pollId);
    if (!poll) return reply.code(404).send({ error: "poll not found" });
    if (!optionAllowed(poll, optionId)) return reply.code(400).send({ error: "invalid poll option" });

    const vote = await worldCupPersistence.upsertVote({ pollId, optionId, userId, createdAt: new Date().toISOString() });
    return { vote };
  });

  app.get<{ Querystring: { userId?: string } }>("/world-cup/favorites", async (request) => {
    return { favorites: await worldCupPersistence.listFavorites(request.query.userId) };
  });

  app.post<{ Body: FavoriteBody }>("/world-cup/favorites", async (request, reply) => {
    const userId = request.body?.userId;
    const teamId = request.body?.teamId;

    if (!userId || !teamId) return reply.code(400).send({ error: "userId and teamId are required" });

    const team = worldCupTeamsSeed.find((item) => item.id === teamId);
    if (!team) return reply.code(404).send({ error: "team not found" });

    const favorite = await worldCupPersistence.upsertFavorite({ userId, teamId, createdAt: new Date().toISOString() });
    return { favorite };
  });

  app.get<{ Querystring: { userId?: string } }>("/world-cup/reminders", async (request) => {
    return { reminders: await worldCupPersistence.listReminders(request.query.userId) };
  });

  app.post<{ Body: ReminderBody }>("/world-cup/reminders", async (request, reply) => {
    const userId = request.body?.userId;
    const matchId = request.body?.matchId;
    const remindAt = request.body?.remindAt;

    if (!userId || !matchId || !remindAt) {
      return reply.code(400).send({ error: "userId, matchId and remindAt are required" });
    }

    const match = worldCupMatchSeed.find((item) => item.id === matchId);
    if (!match) return reply.code(404).send({ error: "match not found" });

    const reminder = await worldCupPersistence.createReminder({
      id: makeId("wcr"),
      userId,
      matchId,
      remindAt,
      createdAt: new Date().toISOString()
    });

    return { reminder };
  });

  app.get<{ Params: { id: string } }>("/world-cup/matches/:id/events", async (request, reply) => {
    const snapshot = await getWorldCupLiveSnapshot(request.params.id, worldCupService);
    if (!snapshot) {
      return reply.code(404).send({ error: "match not found" });
    }

    return {
      matchId: snapshot.matchId,
      status: snapshot.status,
      events: snapshot.events,
      generatedAt: snapshot.generatedAt,
    };
  });

  app.get<{ Params: { id: string }; Querystring: { max?: string } }>("/world-cup/matches/:id/chat", async (request, reply) => {
    const match = await resolveWorldCupMatchById(request.params.id, worldCupService);
    if (!match) {
      return reply.code(404).send({ error: "match not found" });
    }

    const parsed = Number.parseInt(String(request.query.max ?? "120"), 10);
    const maxItems = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 200)) : 120;
    const messages = await worldCupPersistence.listMatchMessages(match.id, maxItems);

    return { matchId: match.id, messages };
  });

  app.post<{ Params: { id: string }; Body: MatchChatBody }>("/world-cup/matches/:id/chat", async (request, reply) => {
    const match = await resolveWorldCupMatchById(request.params.id, worldCupService);
    if (!match) {
      return reply.code(404).send({ error: "match not found" });
    }

    const text = (request.body?.text ?? "").trim();
    if (!text) {
      return reply.code(400).send({ error: "text is required" });
    }

    const userId = (request.body?.userId ?? "anonymous").trim() || "anonymous";
    const author = (request.body?.author ?? "مشجع").trim() || "مشجع";

    const message = await worldCupPersistence.createMatchMessage({
      id: makeId("wccm"),
      matchId: match.id,
      userId,
      author,
      text,
      createdAt: new Date().toISOString(),
    });

    await publishWorldCupMatchSnapshot(match.id);

    return { message };
  });
};