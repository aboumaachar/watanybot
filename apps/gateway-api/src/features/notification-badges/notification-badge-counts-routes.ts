import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type BadgeCounts = Record<string, number>;

type QueryResult = {
  readonly rows?: readonly Record<string, unknown>[];
};

type QueryableDb = {
  readonly query?: (sql: string, params?: readonly unknown[]) => Promise<QueryResult> | QueryResult;
};

type PluginDbStatement = {
  get: (...args: readonly unknown[]) => Record<string, unknown> | undefined;
};

type PluginDbLike = {
  prepare: (sql: string) => PluginDbStatement;
};

type RequestUser = {
  readonly id?: string | number;
  readonly userId?: string | number;
  readonly sub?: string | number;
  readonly role?: string;
  readonly roles?: readonly string[];
  readonly isAdmin?: boolean;
  readonly isSuperAdmin?: boolean;
};

type CountQuery = {
  readonly featureKey: string;
  readonly scope: "public" | "user" | "admin";
  readonly sql: string;
  readonly params?: (context: CountContext) => readonly unknown[];
};

type CountContext = {
  readonly userId: string | null;
  readonly role: string;
  readonly isAdmin: boolean;
};

type BadgeMemoryStore = {
  counts: BadgeCounts;
  updatedAt: string | null;
};

type BadgeEventBody = {
  readonly featureKey?: string;
  readonly count?: number;
  readonly delta?: number;
  readonly counts?: BadgeCounts;
};

const PUBLIC_FEATURE_KEYS = [
  "market",
  "jobs",
  "opportunities",
  "alerts",
  "procedures",
  "forms",
  "legal",
  "recruitment",
  "worldCup",
  "salary",
  "community",
  "media",
  "taxi",
  "services",
  "official-services",
  "useful-links",
] as const;

const USER_FEATURE_KEYS = [
  "messages",
  "notifications",
  "tickets",
  "cases",
  "profile",
  "saved",
  "my-requests",
] as const;

const ADMIN_FEATURE_KEYS = [
  "admin",
  "superadmin",
  "admin-import-review",
  "admin-opportunities",
  "admin-users",
  "admin-kb",
  "moderation",
] as const;

const PUBLIC_COUNT_QUERIES: readonly CountQuery[] = [
  {
    featureKey: "market",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM market_listings WHERE COALESCE(status, 'published') IN ('published', 'active', 'approved') AND COALESCE(created_at, NOW()) > NOW() - INTERVAL '14 days'",
  },
  {
    featureKey: "market",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM listings WHERE COALESCE(status, 'published') IN ('published', 'active', 'approved') AND COALESCE(created_at, NOW()) > NOW() - INTERVAL '14 days'",
  },
  {
    featureKey: "jobs",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM jobs WHERE COALESCE(status, 'published') IN ('published', 'active', 'approved') AND COALESCE(created_at, NOW()) > NOW() - INTERVAL '14 days'",
  },
  {
    featureKey: "jobs",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM job_posts WHERE COALESCE(status, 'published') IN ('published', 'active', 'approved') AND COALESCE(created_at, NOW()) > NOW() - INTERVAL '14 days'",
  },
  {
    featureKey: "opportunities",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM opportunities WHERE COALESCE(status, 'published') IN ('published', 'active', 'approved') AND COALESCE(created_at, NOW()) > NOW() - INTERVAL '14 days'",
  },
  {
    featureKey: "alerts",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM alerts WHERE COALESCE(status, 'active') IN ('active', 'published')",
  },
  {
    featureKey: "procedures",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM procedures WHERE COALESCE(updated_at, created_at, NOW()) > NOW() - INTERVAL '14 days'",
  },
  {
    featureKey: "forms",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM forms WHERE COALESCE(updated_at, created_at, NOW()) > NOW() - INTERVAL '14 days'",
  },
  {
    featureKey: "worldCup",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM world_cup_fixtures WHERE COALESCE(updated_at, created_at, NOW()) > NOW() - INTERVAL '2 days'",
  },
  {
    featureKey: "taxi",
    scope: "public",
    sql: "SELECT COUNT(*)::int AS count FROM taxi_requests WHERE COALESCE(status, 'open') IN ('open', 'pending', 'active')",
  },
];

const USER_COUNT_QUERIES: readonly CountQuery[] = [
  {
    featureKey: "messages",
    scope: "user",
    sql: "SELECT COUNT(*)::int AS count FROM messages WHERE recipient_user_id = $1 AND read_at IS NULL",
    params: (context) => [context.userId],
  },
  {
    featureKey: "messages",
    scope: "user",
    sql: "SELECT COUNT(*)::int AS count FROM internal_messages WHERE recipient_user_id = $1 AND read_at IS NULL",
    params: (context) => [context.userId],
  },
  {
    featureKey: "notifications",
    scope: "user",
    sql: "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    params: (context) => [context.userId],
  },
  {
    featureKey: "tickets",
    scope: "user",
    sql: "SELECT COUNT(*)::int AS count FROM tickets WHERE requester_user_id = $1 AND COALESCE(status, 'open') NOT IN ('closed', 'resolved', 'done')",
    params: (context) => [context.userId],
  },
  {
    featureKey: "cases",
    scope: "user",
    sql: "SELECT COUNT(*)::int AS count FROM cases WHERE user_id = $1 AND COALESCE(status, 'open') NOT IN ('closed', 'resolved', 'done')",
    params: (context) => [context.userId],
  },
];

const ADMIN_COUNT_QUERIES: readonly CountQuery[] = [
  {
    featureKey: "admin-import-review",
    scope: "admin",
    sql: "SELECT COUNT(*)::int AS count FROM import_review_items WHERE COALESCE(status, 'pending') IN ('pending', 'review_required', 'needs_review')",
  },
  {
    featureKey: "moderation",
    scope: "admin",
    sql: "SELECT COUNT(*)::int AS count FROM moderation_queue WHERE COALESCE(status, 'pending') IN ('pending', 'review_required', 'needs_review')",
  },
  {
    featureKey: "admin-users",
    scope: "admin",
    sql: "SELECT COUNT(*)::int AS count FROM users WHERE COALESCE(status, 'active') IN ('pending', 'pending_review')",
  },
  {
    featureKey: "admin-kb",
    scope: "admin",
    sql: "SELECT COUNT(*)::int AS count FROM kb_review_items WHERE COALESCE(status, 'pending') IN ('pending', 'review_required', 'needs_review')",
  },
];

function createZeroCounts(keys: readonly string[]): BadgeCounts {
  const counts: BadgeCounts = {};
  for (const key of keys) {
    counts[key] = 0;
  }
  return counts;
}

function normalizeCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "bigint") {
    return Number(value > BigInt(0) ? value : BigInt(0));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

function normalizeCounts(raw: unknown): BadgeCounts {
  const counts: BadgeCounts = {};
  if (!raw || typeof raw !== "object") {
    return counts;
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const featureKey = key.trim();
    if (featureKey.length > 0) {
      counts[featureKey] = normalizeCount(value);
    }
  }

  return counts;
}

function getRequestUser(request: FastifyRequest): RequestUser | null {
  const requestLike = request as unknown as {
    user?: RequestUser;
    session?: { user?: RequestUser };
  };

  return requestLike.user ?? requestLike.session?.user ?? null;
}

function getRole(user: RequestUser | null): string {
  const role = user?.role;
  if (typeof role === "string" && role.trim().length > 0) {
    return role.trim().toUpperCase();
  }

  const firstRole = user?.roles?.find((entry) => typeof entry === "string" && entry.trim().length > 0);
  return firstRole ? firstRole.trim().toUpperCase() : "PUBLIC";
}

function getUserId(user: RequestUser | null): string | null {
  const candidate = user?.id ?? user?.userId ?? user?.sub;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return String(candidate);
  }

  return null;
}

function isAdminRole(user: RequestUser | null, role: string): boolean {
  if (user?.isAdmin || user?.isSuperAdmin) {
    return true;
  }

  return ["ADMIN", "SUPER_ADMIN", "SUPERADMIN", "MODERATOR", "OWNER"].includes(role);
}

function getDb(app: FastifyInstance): QueryableDb | null {
  const appLike = app as unknown as {
    pg?: QueryableDb;
    db?: QueryableDb;
  };

  const pg = appLike.pg;
  if (pg && typeof pg.query === "function") {
    return pg;
  }

  const db = appLike.db;
  if (db && typeof db.query === "function") {
    return db;
  }

  return null;
}

function getMemoryStore(app: FastifyInstance): BadgeMemoryStore {
  const appLike = app as unknown as {
    watanyNotificationBadgeMemoryStore?: BadgeMemoryStore;
  };

  if (!appLike.watanyNotificationBadgeMemoryStore) {
    appLike.watanyNotificationBadgeMemoryStore = {
      counts: {},
      updatedAt: null,
    };
  }

  return appLike.watanyNotificationBadgeMemoryStore;
}

function getPluginDb(app: FastifyInstance): PluginDbLike | null {
  const appLike = app as unknown as {
    pluginDb?: PluginDbLike;
  };

  if (appLike.pluginDb && typeof appLike.pluginDb.prepare === "function") {
    return appLike.pluginDb;
  }

  return null;
}

function applyPluginDbCounts(counts: BadgeCounts, pluginDb: PluginDbLike | null, context: CountContext): void {
  if (!pluginDb) {
    return;
  }

  try {
    const row = pluginDb.prepare("SELECT COUNT(*) as count FROM notifications WHERE read = 0").get() as Record<string, unknown> | undefined;
    const unreadNotifications = normalizeCount(row?.count);
    counts.notifications = unreadNotifications;
  } catch {
    // pluginDb notification counts are best-effort only
  }

  if (!context.userId) {
    return;
  }

  try {
    const row = pluginDb.prepare("SELECT COUNT(*) as count FROM saved_chats WHERE status = 'active'").get() as Record<string, unknown> | undefined;
    const savedCount = normalizeCount(row?.count);
    if (savedCount > 0 || counts.saved === 0) {
      counts.saved = savedCount;
    }
  } catch {
    // pluginDb saved counts are best-effort only
  }
}

async function runCountQuery(db: QueryableDb, query: CountQuery, context: CountContext): Promise<number | null> {
  if (query.scope === "user" && !context.userId) {
    return null;
  }

  if (query.scope === "admin" && !context.isAdmin) {
    return null;
  }

  if (typeof db.query !== "function") {
    return null;
  }

  try {
    const params = query.params ? query.params(context) : [];
    const result = await db.query(query.sql, params);
    const row = result.rows?.[0];
    if (!row) {
      return null;
    }

    return normalizeCount(row.count ?? row.Count ?? row.total ?? row.Total);
  } catch {
    return null;
  }
}

async function applyQueries(
  counts: BadgeCounts,
  db: QueryableDb | null,
  queries: readonly CountQuery[],
  context: CountContext,
  sources: string[],
): Promise<void> {
  if (!db) {
    return;
  }

  for (const query of queries) {
    const value = await runCountQuery(db, query, context);
    if (value === null) {
      continue;
    }

    counts[query.featureKey] = Math.max(counts[query.featureKey] ?? 0, value);
    sources.push(query.featureKey);
  }
}

function applyMemoryCounts(counts: BadgeCounts, memory: BadgeMemoryStore, isAdmin: boolean): void {
  const publicAndUserKeys = new Set<string>([
    ...PUBLIC_FEATURE_KEYS,
    ...USER_FEATURE_KEYS,
  ]);
  const adminKeys = new Set<string>(ADMIN_FEATURE_KEYS);

  for (const [key, value] of Object.entries(memory.counts)) {
    if (adminKeys.has(key) && !isAdmin) {
      continue;
    }

    if (publicAndUserKeys.has(key) || isAdmin) {
      counts[key] = normalizeCount(value);
    }
  }
}

function canWriteBadgeEvents(request: FastifyRequest, user: RequestUser | null, role: string): boolean {
  const internalToken = process.env.NOTIFICATION_BADGE_INTERNAL_TOKEN;
  const headerToken = request.headers["x-notification-badge-token"];
  const normalizedHeaderToken = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (
    internalToken &&
    typeof normalizedHeaderToken === "string" &&
    normalizedHeaderToken.length > 0 &&
    normalizedHeaderToken === internalToken
  ) {
    return true;
  }

  return isAdminRole(user, role);
}

function createResponsePayload(counts: BadgeCounts, context: CountContext, sources: readonly string[], memory: BadgeMemoryStore) {
  return {
    ok: true,
    counts,
    meta: {
      generatedAt: new Date().toISOString(),
      authenticated: Boolean(context.userId),
      role: context.role,
      adminIncluded: context.isAdmin,
      sourceCount: sources.length,
      sources,
      memoryUpdatedAt: memory.updatedAt,
    },
  };
}

export async function notificationBadgeCountsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/notification-badges/counts", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getRequestUser(request);
    const role = getRole(user);
    const userId = getUserId(user);
    const isAdmin = isAdminRole(user, role);
    const db = getDb(app);
    const pluginDb = getPluginDb(app);
    const memory = getMemoryStore(app);

    const context: CountContext = {
      userId,
      role,
      isAdmin,
    };

    const counts: BadgeCounts = {
      ...createZeroCounts(PUBLIC_FEATURE_KEYS),
    };

    if (userId) {
      Object.assign(counts, createZeroCounts(USER_FEATURE_KEYS));
    }

    if (isAdmin) {
      Object.assign(counts, createZeroCounts(ADMIN_FEATURE_KEYS));
    }

    const sources: string[] = [];
    await applyQueries(counts, db, PUBLIC_COUNT_QUERIES, context, sources);
    await applyQueries(counts, db, USER_COUNT_QUERIES, context, sources);
    await applyQueries(counts, db, ADMIN_COUNT_QUERIES, context, sources);
    applyPluginDbCounts(counts, pluginDb, context);
    applyMemoryCounts(counts, memory, isAdmin);

    return reply
      .header("cache-control", "private, max-age=15")
      .send(createResponsePayload(counts, context, sources, memory));
  });

  app.post("/api/notification-badges/event", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getRequestUser(request);
    const role = getRole(user);

    if (!canWriteBadgeEvents(request, user, role)) {
      return reply.code(403).send({
        ok: false,
        error: "NOTIFICATION_BADGE_EVENT_FORBIDDEN",
      });
    }

    const body = (request.body ?? {}) as BadgeEventBody;
    const memory = getMemoryStore(app);

    const nextCounts: BadgeCounts = {
      ...memory.counts,
    };

    const incomingCounts = normalizeCounts(body.counts);
    for (const [key, value] of Object.entries(incomingCounts)) {
      nextCounts[key] = value;
    }

    if (typeof body.featureKey === "string" && body.featureKey.trim().length > 0) {
      const featureKey = body.featureKey.trim();
      if (typeof body.count !== "undefined") {
        nextCounts[featureKey] = normalizeCount(body.count);
      } else if (typeof body.delta !== "undefined") {
        nextCounts[featureKey] = normalizeCount((nextCounts[featureKey] ?? 0) + normalizeCount(body.delta));
      }
    }

    memory.counts = nextCounts;
    memory.updatedAt = new Date().toISOString();

    return reply.send({
      ok: true,
      counts: memory.counts,
      updatedAt: memory.updatedAt,
    });
  });
}
