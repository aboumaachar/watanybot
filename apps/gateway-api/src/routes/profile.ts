/**
 * Profile CRUD routes — login, logout, patch, get.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb, UserProfile, Role } from "../types/domain";
import { normalizeText, hasSufficientRole, mapProfileRow } from "../lib/helpers";

interface ProfileRoutesOptions {
  pluginDb: PluginDb;
}

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/profile", async () => {
    let row = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      pluginDb
        .prepare("INSERT INTO profile (id, name, phone, email, region, note, is_authed, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run("default", "Veteran User", "", "", "", "", 0, null);
      row = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
        | Record<string, unknown>
        | undefined;
    }
    return { profile: mapProfileRow(row) } as const;
  });

  app.post<{ Body: { name?: string; role?: string } }>("/api/profile/login", async (req) => {
    const name = normalizeText(req.body?.name) || "Veteran User";
    const requested: Role = req.body?.role ? (String(req.body.role) as Role) : "accredited";
    const now = Date.now();
    let row = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
      | Record<string, unknown>
      | undefined;

    function chooseRole(existing?: Role): Role {
      const selfAllowed: Role[] = ["public", "accredited"];
      if (selfAllowed.includes(requested)) return requested;
      if (existing && hasSufficientRole(existing, "accredited")) return existing;
      return "accredited";
    }

    if (!row) {
      const initialRole = chooseRole(undefined);
      pluginDb
        .prepare("INSERT INTO profile (id, name, phone, email, region, note, role, is_authed, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run("default", name, "", "", "", "", initialRole, 1, now);
      row = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
        | Record<string, unknown>
        | undefined;
      return { profile: mapProfileRow(row) } as const;
    }

    const currentRole: Role = row.role ? (String(row.role) as Role) : "public";
    const finalRole = chooseRole(currentRole);
    const updated = {
      name,
      phone: row.phone ? String(row.phone) : "",
      email: row.email ? String(row.email) : "",
      region: row.region ? String(row.region) : "",
      note: row.note ? String(row.note) : "",
      role: finalRole,
      is_authed: 1,
      last_login: now,
    };
    pluginDb
      .prepare("UPDATE profile SET name = ?, phone = ?, email = ?, region = ?, note = ?, role = ?, is_authed = ?, last_login = ? WHERE id = ?")
      .run(updated.name, updated.phone, updated.email, updated.region, updated.note, updated.role, updated.is_authed, updated.last_login, "default");
    row = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
      | Record<string, unknown>
      | undefined;
    return { profile: mapProfileRow(row) } as const;
  });

  app.post("/api/profile/logout", async () => {
    const row = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
      | Record<string, unknown>
      | undefined;
    const updated = {
      name: row?.name ? String(row.name) : "Veteran User",
      phone: row?.phone ? String(row.phone) : "",
      email: row?.email ? String(row.email) : "",
      region: row?.region ? String(row.region) : "",
      note: row?.note ? String(row.note) : "",
      role: row?.role ? String(row.role) : "public",
      is_authed: 0,
      last_login: row?.last_login ? Number(row.last_login) : null,
    };
    pluginDb
      .prepare("UPDATE profile SET name = ?, phone = ?, email = ?, region = ?, note = ?, role = ?, is_authed = ?, last_login = ? WHERE id = ?")
      .run(updated.name, updated.phone, updated.email, updated.region, updated.note, updated.role, updated.is_authed, updated.last_login, "default");
    const fresh = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
      | Record<string, unknown>
      | undefined;
    return { profile: mapProfileRow(fresh) } as const;
  });

  app.patch<{ Body: Partial<UserProfile> }>("/api/profile", async (req, reply) => {
    const patch = req.body || {};
    const row = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      reply.code(404);
      return { error: "profile not found" } as const;
    }
    const updated = {
      name: patch.name ? normalizeText(patch.name) : String(row.name || "Veteran User"),
      phone: patch.phone ? normalizeText(patch.phone) : String(row.phone || ""),
      email: patch.email ? normalizeText(patch.email) : String(row.email || ""),
      region: patch.region ? normalizeText(patch.region) : String(row.region || ""),
      note: patch.note ? String(patch.note) : String(row.note || ""),
      role: patch.role ? String(patch.role) : String(row.role || "public"),
      is_authed: typeof patch.isAuthed === "boolean" ? (patch.isAuthed ? 1 : 0) : Number(row.is_authed || 0),
      last_login: row.last_login ? Number(row.last_login) : null,
    };
    pluginDb
      .prepare("UPDATE profile SET name = ?, phone = ?, email = ?, region = ?, note = ?, role = ?, is_authed = ?, last_login = ? WHERE id = ?")
      .run(updated.name, updated.phone, updated.email, updated.region, updated.note, updated.role, updated.is_authed, updated.last_login, "default");
    const fresh = pluginDb.prepare("SELECT * FROM profile WHERE id = ?").get("default") as
      | Record<string, unknown>
      | undefined;
    return { profile: mapProfileRow(fresh) } as const;
  });
};
