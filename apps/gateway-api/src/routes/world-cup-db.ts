import type { PluginDb } from "../types/domain";
import { createDefaultWorldCupService } from '../worldcup';

const worldCupService = createDefaultWorldCupService();

function worldCupOk<T>(payload: { data: T; source: string; generatedAt: string }) {
  return { ok: true, data: payload.data, source: payload.source, generatedAt: payload.generatedAt };
}

function worldCupError(error: unknown) {
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'World Cup service error',
    generatedAt: new Date().toISOString(),
  };
}


export type WorldCupVoteRecord = {
  pollId: string;
  optionId: string;
  userId: string;
  createdAt: string;
};

export type WorldCupFavoriteRecord = {
  userId: string;
  teamId: string;
  createdAt: string;
};

export type WorldCupReminderRecord = {
  id: string;
  userId: string;
  matchId: string;
  remindAt: string;
  createdAt: string;
};

export type WorldCupMatchMessageRecord = {
  id: string;
  matchId: string;
  userId: string;
  author: string;
  text: string;
  createdAt: string;
};

let pluginDbRef: PluginDb | null = null;
let schemaReady = false;
let inMemoryVotes: WorldCupVoteRecord[] = [];
let inMemoryFavorites: WorldCupFavoriteRecord[] = [];
let inMemoryReminders: WorldCupReminderRecord[] = [];
let inMemoryMatchMessages: WorldCupMatchMessageRecord[] = [];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function requirePluginDb(): PluginDb {
  if (!pluginDbRef) {
    throw new Error("World Cup PluginDb persistence is not configured. Call configureWorldCupPersistence(pluginDb).");
  }
  return pluginDbRef;
}

function resetInMemoryStore() {
  inMemoryVotes = [];
  inMemoryFavorites = [];
  inMemoryReminders = [];
  inMemoryMatchMessages = [];
}

export function configureWorldCupPersistence(pluginDb?: PluginDb | null) {
  pluginDbRef = pluginDb ?? null;
  schemaReady = false;

  if (pluginDbRef) {
    ensureWorldCupSchema();
    return;
  }

  resetInMemoryStore();
}

function ensureWorldCupSchema() {
  const pluginDb = requirePluginDb();
  if (schemaReady) return;

  pluginDb.prepare(`
    CREATE TABLE IF NOT EXISTS world_cup_votes (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (poll_id, user_id)
    )
  `).run();

  pluginDb.prepare(`
    CREATE TABLE IF NOT EXISTS world_cup_favorites (
      user_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, team_id)
    )
  `).run();

  pluginDb.prepare(`
    CREATE TABLE IF NOT EXISTS world_cup_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      remind_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, match_id, remind_at)
    )
  `).run();

  pluginDb.prepare(`
    CREATE TABLE IF NOT EXISTS world_cup_match_messages (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  schemaReady = true;
}

function toVoteRecord(row: any): WorldCupVoteRecord {
  return {
    pollId: String(row.poll_id),
    optionId: String(row.option_id),
    userId: String(row.user_id),
    createdAt: String(row.created_at)
  };
}

function toFavoriteRecord(row: any): WorldCupFavoriteRecord {
  return {
    userId: String(row.user_id),
    teamId: String(row.team_id),
    createdAt: String(row.created_at)
  };
}

function toReminderRecord(row: any): WorldCupReminderRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    matchId: String(row.match_id),
    remindAt: String(row.remind_at),
    createdAt: String(row.created_at)
  };
}

function toMatchMessageRecord(row: any): WorldCupMatchMessageRecord {
  return {
    id: String(row.id),
    matchId: String(row.match_id),
    userId: String(row.user_id),
    author: String(row.author),
    text: String(row.text),
    createdAt: String(row.created_at),
  };
}

export const worldCupPersistence = {
  async upsertVote(vote: WorldCupVoteRecord) {
    if (!pluginDbRef) {
      inMemoryVotes = [
        ...inMemoryVotes.filter((entry) => !(entry.pollId === vote.pollId && entry.userId === vote.userId)),
        vote,
      ];
      return vote;
    }

    const pluginDb = requirePluginDb();
    ensureWorldCupSchema();

    pluginDb
      .prepare(`
        INSERT INTO world_cup_votes (id, poll_id, option_id, user_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (poll_id, user_id)
        DO UPDATE SET option_id = excluded.option_id, created_at = excluded.created_at
      `)
      .run(makeId("wcv"), vote.pollId, vote.optionId, vote.userId, vote.createdAt);

    return vote;
  },

  async listVotes(pollId?: string) {
    if (!pluginDbRef) {
      const rows = pollId
        ? inMemoryVotes.filter((entry) => entry.pollId === pollId)
        : inMemoryVotes;

      return [...rows].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    const pluginDb = requirePluginDb();
    ensureWorldCupSchema();

    const rows = pollId
      ? pluginDb.prepare("SELECT poll_id, option_id, user_id, created_at FROM world_cup_votes WHERE poll_id = ? ORDER BY created_at ASC").all(pollId)
      : pluginDb.prepare("SELECT poll_id, option_id, user_id, created_at FROM world_cup_votes ORDER BY created_at ASC").all();

    return rows.map(toVoteRecord);
  },

  async upsertFavorite(favorite: WorldCupFavoriteRecord) {
    if (!pluginDbRef) {
      inMemoryFavorites = [
        ...inMemoryFavorites.filter((entry) => !(entry.userId === favorite.userId && entry.teamId === favorite.teamId)),
        favorite,
      ];
      return favorite;
    }

    const pluginDb = requirePluginDb();
    ensureWorldCupSchema();

    pluginDb
      .prepare(`
        INSERT INTO world_cup_favorites (user_id, team_id, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT (user_id, team_id)
        DO UPDATE SET created_at = excluded.created_at
      `)
      .run(favorite.userId, favorite.teamId, favorite.createdAt);

    return favorite;
  },

  async listFavorites(userId?: string) {
    if (!pluginDbRef) {
      const rows = userId
        ? inMemoryFavorites.filter((entry) => entry.userId === userId)
        : inMemoryFavorites;

      return [...rows].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }

    const pluginDb = requirePluginDb();
    ensureWorldCupSchema();

    const rows = userId
      ? pluginDb.prepare("SELECT user_id, team_id, created_at FROM world_cup_favorites WHERE user_id = ? ORDER BY created_at ASC").all(userId)
      : pluginDb.prepare("SELECT user_id, team_id, created_at FROM world_cup_favorites ORDER BY created_at ASC").all();

    return rows.map(toFavoriteRecord);
  },

  async createReminder(reminder: WorldCupReminderRecord) {
    if (!pluginDbRef) {
      inMemoryReminders = [
        ...inMemoryReminders.filter((entry) => !(entry.userId === reminder.userId && entry.matchId === reminder.matchId && entry.remindAt === reminder.remindAt)),
        reminder,
      ];
      return reminder;
    }

    const pluginDb = requirePluginDb();
    ensureWorldCupSchema();

    pluginDb
      .prepare(`
        INSERT INTO world_cup_reminders (id, user_id, match_id, remind_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (user_id, match_id, remind_at)
        DO UPDATE SET created_at = excluded.created_at
      `)
      .run(reminder.id, reminder.userId, reminder.matchId, reminder.remindAt, reminder.createdAt);

    return reminder;
  },

  async listReminders(userId?: string) {
    if (!pluginDbRef) {
      const rows = userId
        ? inMemoryReminders.filter((entry) => entry.userId === userId)
        : inMemoryReminders;

      return [...rows].sort((left, right) => left.remindAt.localeCompare(right.remindAt));
    }

    const pluginDb = requirePluginDb();
    ensureWorldCupSchema();

    const rows = userId
      ? pluginDb.prepare("SELECT id, user_id, match_id, remind_at, created_at FROM world_cup_reminders WHERE user_id = ? ORDER BY remind_at ASC").all(userId)
      : pluginDb.prepare("SELECT id, user_id, match_id, remind_at, created_at FROM world_cup_reminders ORDER BY remind_at ASC").all();

    return rows.map(toReminderRecord);
  },

  async createMatchMessage(message: WorldCupMatchMessageRecord) {
    if (!pluginDbRef) {
      inMemoryMatchMessages = [...inMemoryMatchMessages, message];
      return message;
    }

    const pluginDb = requirePluginDb();
    ensureWorldCupSchema();

    pluginDb
      .prepare(`
        INSERT INTO world_cup_match_messages (id, match_id, user_id, author, text, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(message.id, message.matchId, message.userId, message.author, message.text, message.createdAt);

    return message;
  },

  async listMatchMessages(matchId: string, maxItems = 120) {
    if (!pluginDbRef) {
      return inMemoryMatchMessages
        .filter((entry) => entry.matchId === matchId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .slice(-maxItems);
    }

    const pluginDb = requirePluginDb();
    ensureWorldCupSchema();

    const rows = pluginDb
      .prepare(
        "SELECT id, match_id, user_id, author, text, created_at FROM world_cup_match_messages WHERE match_id = ? ORDER BY created_at ASC LIMIT ?"
      )
      .all(matchId, maxItems);

    return rows.map(toMatchMessageRecord);
  }
};
export function attachDb(pluginDb: PluginDb) {
  configureWorldCupPersistence(pluginDb);
}

// WORLD_CUP_SERVICE_BRIDGE_READY
// The active world-cup route file has been prepared to delegate to src/worldcup service layer.
// Next surgical step may replace specific endpoint handlers with:
//   worldCupOk(await worldCupService.getTodayMatches())
//   worldCupOk(await worldCupService.getLiveMatches())
//   worldCupOk(await worldCupService.getStandings())
//   worldCupOk(await worldCupService.getMatchById(id))
