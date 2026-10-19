/**
 * Legacy profile compatibility routes backed by canonical JWT users.
 * Shared pluginDb profile state is intentionally not used for auth or identity.
 */
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb, UserProfile } from "../types/domain";
import { normalizeText } from "../lib/helpers";
import { query } from "../lib/db.js";

interface ProfileRoutesOptions {
  pluginDb: PluginDb;
}

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  name?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  role?: string | null;
  region?: string | null;
  note?: string | null;
  last_login?: unknown;
};

const retired = (replacement: string) => ({
  error: "LEGACY_PROFILE_API_DEPRECATED",
  replacement,
});

function parseLastLogin(value: unknown): number | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.getTime();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapAuthenticatedProfile(row: ProfileRow): UserProfile {
  return {
    isAuthed: true,
    role: row.role ? String(row.role) as UserProfile["role"] : "public",
    name: row.full_name || row.name || undefined,
    phone: row.phone_number || row.phone || undefined,
    email: row.email || undefined,
    region: row.region || undefined,
    note: row.note || undefined,
    lastLogin: parseLastLogin(row.last_login),
  };
}

async function readCurrentProfile(userId: string): Promise<ProfileRow | null> {
  const result = await query<ProfileRow>(
    "SELECT id, email, full_name, name, phone_number, phone, role, region, note, last_login FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );
  return result.rows[0] || null;
}

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (app, _options) => {
  app.get("/api/profile", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) {
      return reply.code(401).send({ error: "AUTH_REQUIRED" });
    }

    const row = await readCurrentProfile(userId);
    if (!row) {
      return reply.code(404).send({ error: "USER_NOT_FOUND" });
    }

    return { profile: mapAuthenticatedProfile(row) } as const;
  });

  app.post("/api/profile/login", async (_req, reply) => {
    return reply.code(410).send(retired("/api/auth/login"));
  });

  app.post("/api/profile/logout", async () => {
    return {
      profile: {
        isAuthed: false,
        role: "public",
      } satisfies UserProfile,
    } as const;
  });

  app.patch<{ Body: Partial<UserProfile> }>("/api/profile", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) {
      return reply.code(401).send({ error: "AUTH_REQUIRED" });
    }

    const patch = req.body || {};
    if (patch.role !== undefined || patch.isAuthed !== undefined || patch.phone !== undefined) {
      return reply.code(400).send({
        error: "LEGACY_PROFILE_FIELD_NOT_WRITABLE",
        replacement: "/api/me/profile",
      });
    }

    const current = await readCurrentProfile(userId);
    if (!current) {
      return reply.code(404).send({ error: "USER_NOT_FOUND" });
    }

    if (patch.email !== undefined) {
      const requestedEmail = normalizeText(patch.email).toLowerCase();
      const currentEmail = normalizeText(current.email).toLowerCase();
      if (requestedEmail !== currentEmail) {
        return reply.code(409).send({ error: "EMAIL_CHANGE_REQUIRES_REAUTH" });
      }
    }

    const nextName = patch.name !== undefined ? normalizeText(patch.name) : null;
    if (typeof nextName === "string" && nextName.length < 2) {
      return reply.code(400).send({ error: "PROFILE_NAME_TOO_SHORT" });
    }

    const nextRegion = patch.region !== undefined ? normalizeText(patch.region) : null;
    const nextNote = patch.note !== undefined ? String(patch.note).trim() : null;
    const result = await query<ProfileRow>(
      `UPDATE users
       SET full_name = COALESCE($2, full_name),
           region = COALESCE($3, region),
           note = COALESCE($4, note),
           updated_at = now()
       WHERE id = $1
       RETURNING id, email, full_name, name, phone_number, phone, role, region, note, last_login`,
      [userId, nextName, nextRegion, nextNote],
    );

    const updated = result.rows[0];
    if (!updated) {
      return reply.code(404).send({ error: "USER_NOT_FOUND" });
    }

    return { profile: mapAuthenticatedProfile(updated) } as const;
  });
};
