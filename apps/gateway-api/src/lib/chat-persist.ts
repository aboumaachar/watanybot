/**
 * Chat persistence helpers — write messages to PostgreSQL.
 *
 * Tables: chat_sessions, chat_messages (see migrations 002 + 005).
 */
import { query } from "./db.js";

/* ------------------------------------------------------------------ */
/*  Session helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Find the most recent *open* session for a user, or create one.
 * Returns the session UUID.
 */
export async function getOrCreateSession(
  userId: string | null,
  channel = "web",
): Promise<string> {
  // Try to reuse an open session from the last 30 minutes
  if (userId && userId !== "anonymous") {
    const existing = await query(
      `SELECT id FROM chat_sessions
        WHERE user_id = $1
          AND status IN ('open','in_progress')
          AND last_message_at > now() - interval '30 minutes'
        ORDER BY last_message_at DESC
        LIMIT 1`,
      [userId],
    );
    if (existing.rows.length > 0) return existing.rows[0].id as string;
  }

  // Create a new session
  const res = await query(
    `INSERT INTO chat_sessions (user_id, channel, status)
     VALUES ($1, $2, 'open')
     RETURNING id`,
    [userId && userId !== "anonymous" ? userId : null, channel],
  );
  return res.rows[0].id as string;
}

/* ------------------------------------------------------------------ */
/*  Message insert                                                     */
/* ------------------------------------------------------------------ */

export interface PersistMessageOpts {
  sessionId: string;
  userId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: unknown;
  intents?: unknown;
  metadata?: unknown;
}

export async function persistMessage(opts: PersistMessageOpts): Promise<string> {
  const res = await query(
    `INSERT INTO chat_messages
       (session_id, user_id, role, content, citations, intents, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      opts.sessionId,
      opts.userId && opts.userId !== "anonymous" ? opts.userId : null,
      opts.role,
      opts.content,
      opts.citations ? JSON.stringify(opts.citations) : null,
      opts.intents ? JSON.stringify(opts.intents) : null,
      opts.metadata ? JSON.stringify(opts.metadata) : null,
    ],
  );
  return res.rows[0].id as string;
}

/* ------------------------------------------------------------------ */
/*  Session stat bump                                                  */
/* ------------------------------------------------------------------ */

/** Increment message count and touch last_message_at. */
export async function touchSession(sessionId: string, count = 1): Promise<void> {
  await query(
    `UPDATE chat_sessions
        SET message_count   = COALESCE(message_count, 0) + $2,
            last_message_at = now(),
            updated_at      = now()
      WHERE id = $1`,
    [sessionId, count],
  );
}

/* ------------------------------------------------------------------ */
/*  Convenience: persist a full user↔bot exchange                      */
/* ------------------------------------------------------------------ */

export interface PersistExchangeOpts {
  userId: string;
  channel?: string;
  userMessage: string;
  botReply: string;
  intents?: unknown;
  citations?: unknown;
  metadata?: unknown;
}

/**
 * Persist both the user message and the bot response atomically.
 * Returns the session id used.
 */
export async function persistChatExchange(
  opts: PersistExchangeOpts,
): Promise<string> {
  const sessionId = await getOrCreateSession(opts.userId, opts.channel);

  await persistMessage({
    sessionId,
    userId: opts.userId,
    role: "user",
    content: opts.userMessage,
  });

  await persistMessage({
    sessionId,
    userId: opts.userId,
    role: "assistant",
    content: opts.botReply,
    intents: opts.intents,
    citations: opts.citations,
    metadata: opts.metadata,
  });

  await touchSession(sessionId, 2);

  return sessionId;
}
