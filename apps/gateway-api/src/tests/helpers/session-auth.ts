/**
 * Test helper: session-backed access tokens.
 *
 * Admin paths (/api/admin, /api/superadmin, /api/admin-authority, /admin, ...)
 * do not trust the JWT role claim. auth-middleware resolves the principal from
 * the database: the token needs a `sid`, `sub` must be an active user, and the
 * session row must exist and be unexpired. A bare signAccessToken({ sub, role })
 * is therefore anonymous on those paths.
 *
 * Requires DATABASE_URL (a disposable test database). Rows created here are
 * removed by cleanupSessionUsers().
 */
import { randomUUID } from "node:crypto";
import type { UserRole } from "@watany/types";
import { createAuthSession, signAccessToken, signRefreshToken } from "../../auth/auth-middleware";
import { query } from "../../lib/db";

const createdUserIds: string[] = [];

export async function createSessionToken(role: UserRole, label = role): Promise<string> {
  if (!process.env.DATABASE_URL) {
    throw new Error("createSessionToken needs DATABASE_URL: admin paths resolve the user and session from the database");
  }
  const email = `test-${label}-${randomUUID().slice(0, 8)}@session.test`;
  const user = await query<{ id: string }>(
    "INSERT INTO users (email, role, status) VALUES ($1, $2, 'active') RETURNING id",
    [email, role],
  );
  const userId = user.rows[0].id;
  createdUserIds.push(userId);
  const sessionId = await createAuthSession({ userId, refreshToken: signRefreshToken({ sub: userId }) });
  return signAccessToken({ sub: userId, role, email, sid: sessionId });
}

export async function cleanupSessionUsers(): Promise<void> {
  if (!createdUserIds.length) return;
  const ids = createdUserIds.splice(0);
  await query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [ids]);
  await query("DELETE FROM users WHERE id = ANY($1::uuid[])", [ids]);
}
