/**
 * Moderation pipeline — toxicity check, spam detection, flagging.
 */
import { query } from "../lib/db.js";

/** Simple rate-limit tracker (per user, in-memory). */
const messageRates = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const MAX_MESSAGES_PER_MINUTE = 30;

/**
 * Check if user is sending messages too fast (spam detection).
 */
export function isSpam(userId: string): boolean {
  const now = Date.now();
  const timestamps = messageRates.get(userId) ?? [];
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  messageRates.set(userId, recent);
  return recent.length > MAX_MESSAGES_PER_MINUTE;
}

/**
 * Flag a message in the database for admin review.
 */
export async function flagMessage(
  messageId: string,
  reason: string,
  userId?: string,
): Promise<void> {
  try {
    await query("UPDATE chat_messages SET flagged = true WHERE id = $1", [messageId]);
    await query(
      "INSERT INTO audit_log (user_id, action, resource, details) VALUES ($1, $2, $3, $4)",
      [userId ?? null, "moderation.flag", "chat_messages", JSON.stringify({ messageId, reason })],
    );
  } catch {
    // DB not available — log to console
    console.warn(`[moderation] Could not flag message ${messageId}: ${reason}`);
  }
}

/**
 * Basic toxicity patterns (lightweight, no external API needed).
 * For production, integrate OpenAI's moderation endpoint.
 */
const TOXIC_PATTERNS = [
  /\b(kill|murder|bomb|attack|terrorism)\b/i,
  /\b(قتل|تفجير|إرهاب|هجوم)\b/i,
];

export function isToxic(text: string): boolean {
  return TOXIC_PATTERNS.some(p => p.test(text));
}

/**
 * Run full moderation check on a message.
 */
export async function moderate(
  text: string,
  userId?: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (userId && isSpam(userId)) {
    return { ok: false, reason: "rate_limited" };
  }

  if (isToxic(text)) {
    return { ok: false, reason: "toxic_content" };
  }

  return { ok: true };
}
