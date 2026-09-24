import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { UserRole } from "@watany/types";
import { FEATURES, type FeatureId } from "@watany/shared/features";
import { getClient, query } from "../lib/db.js";
import { hashPassword } from "../auth/password.js";
import { isConfiguredAdminEmail } from "../auth/admin-policy.js";
import { PERMISSIONS, requireRole } from "../auth/rbac.js";
import { getFeatureFlagsPayload } from "../lib/feature-flags.js";
import { broadcastFeatureFlagsUpdate } from "../ws/features-ws.js";

const USER_ROLES = ["public", "accredited", "driver", "moderator", "admin", "superadmin"] as const;
const USER_STATUSES = ["active", "suspended", "banned"] as const;
const BULK_LIMIT = 2000;
const IMPORT_LIMIT = 500;

type UserFilters = { search?: string; role?: string; status?: string; lastLogin?: string };
type ImportRow = { name?: string; email?: string; phone?: string; role?: string; status?: string; password?: string };
type BulkBody = {
  ids?: string[];
  filters?: UserFilters;
  action?: "status" | "role" | "revoke_sessions" | "feature" | "delete";
  value?: string;
  featureId?: string;
  featureOverride?: boolean | null;
  confirmDelete?: boolean;
  dryRun?: boolean;
};

function isRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is typeof USER_STATUSES[number] {
  return typeof value === "string" && (USER_STATUSES as readonly string[]).includes(value);
}

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function capabilitiesForRole(role: UserRole): string[] {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => (roles as readonly string[]).includes(role))
    .map(([permission]) => permission);
}

const FEATURE_BY_ID = new Map(FEATURES.map((feature) => [feature.id, feature] as const));

function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === "string" && FEATURE_BY_ID.has(value as FeatureId);
}

function isFeatureOverride(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

export function userDeleteBlockReason(
  actor: { id?: string; role?: string } | null | undefined,
  target: { id: string; email?: string | null; role: string; status: string },
  activeAdministratorCount: number,
): string | null {
  if (!actor?.id || actor.role !== "superadmin") return "SUPERADMIN_REQUIRED_FOR_USER_DELETE";
  if (actor.id === target.id) return "CANNOT_DELETE_OWN_ACCOUNT";
  if (isConfiguredAdminEmail(target.email || undefined)) return "CONFIGURED_ADMIN_ACCOUNT_PROTECTED";
  if (target.status === "active" && ["admin", "superadmin"].includes(target.role) && activeAdministratorCount <= 1) {
    return "CANNOT_DELETE_LAST_ACTIVE_ADMINISTRATOR";
  }
  return null;
}

function buildFilterSql(filters: UserFilters, startIndex = 1) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let index = startIndex;
  const search = normalized(filters.search);
  if (search) {
    clauses.push(`(u.name ILIKE $${index} OR u.full_name ILIKE $${index} OR u.email ILIKE $${index} OR u.phone ILIKE $${index} OR u.phone_number ILIKE $${index} OR u.id::text ILIKE $${index})`);
    params.push(`%${search}%`);
    index += 1;
  }
  if (isRole(filters.role)) { clauses.push(`u.role = $${index}`); params.push(filters.role); index += 1; }
  if (isStatus(filters.status)) { clauses.push(`u.status = $${index}`); params.push(filters.status); index += 1; }
  if (filters.lastLogin === "today") clauses.push("u.last_login >= CURRENT_DATE");
  if (filters.lastLogin === "never") clauses.push("u.last_login IS NULL");
  if (filters.lastLogin === "inactive30") clauses.push("(u.last_login IS NULL OR u.last_login < NOW() - INTERVAL '30 days')");
  if (filters.lastLogin === "inactive90") clauses.push("(u.last_login IS NULL OR u.last_login < NOW() - INTERVAL '90 days')");
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params, nextIndex: index };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function validateImportRow(row: ImportRow, actorRole: string) {
  const name = normalized(row.name);
  const email = normalized(row.email).toLowerCase();
  const phone = normalized(row.phone);
  const role = normalized(row.role) || "public";
  const status = normalized(row.status) || "active";
  const password = normalized(row.password);
  const errors: string[] = [];
  if (!name) errors.push("NAME_REQUIRED");
  if (!email && !phone) errors.push("EMAIL_OR_PHONE_REQUIRED");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) errors.push("INVALID_EMAIL");
  if (!isRole(role)) errors.push("INVALID_ROLE");
  if (!isStatus(status)) errors.push("INVALID_STATUS");
  if (password.length < 8) errors.push("PASSWORD_MIN_8");
  if ((role === "admin" || role === "superadmin") && actorRole !== "superadmin") errors.push("SUPERADMIN_REQUIRED_FOR_ADMIN_ROLE");
  if (email && isConfiguredAdminEmail(email) && actorRole !== "superadmin") errors.push("SUPERADMIN_REQUIRED_FOR_CONFIGURED_ADMIN_EMAIL");
  return { valid: errors.length === 0, errors, normalized: { name, email, phone, role, status, password } };
}

async function resolveBulkTargets(client: any, body: BulkBody) {
  const ids = Array.from(new Set((body.ids || []).filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim())));
  if (ids.length > 0) {
    if (ids.length > BULK_LIMIT) throw new Error("BULK_SCOPE_TOO_LARGE");
    return client.query("SELECT id, email, name, role, status FROM users WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE", [ids]);
  }
  const filter = buildFilterSql(body.filters || {});
  const countResult = await client.query(`SELECT COUNT(*)::int AS total FROM users u WHERE 1=1${filter.sql}`, filter.params);
  const total = Number(countResult.rows[0]?.total || 0);
  if (total === 0) return { rows: [], rowCount: 0 };
  if (total > BULK_LIMIT) throw new Error("BULK_SCOPE_TOO_LARGE");
  return client.query(
    `SELECT u.id, u.email, u.name, u.role, u.status FROM users u WHERE 1=1${filter.sql} ORDER BY u.id FOR UPDATE`,
    filter.params,
  );
}

function bulkBlockReason(rows: any[], actor: any, body: BulkBody): string | null {
  if (!body.action) return "BULK_ACTION_REQUIRED";
  if (body.action === "delete") {
    if (actor?.role !== "superadmin") return "SUPERADMIN_REQUIRED_FOR_USER_DELETE";
    if (rows.some((row) => row.id === actor?.id)) return "CANNOT_DELETE_OWN_ACCOUNT";
    if (rows.some((row) => isConfiguredAdminEmail(row.email || undefined))) return "CONFIGURED_ADMIN_ACCOUNT_PROTECTED";
    if (body.dryRun === false && body.confirmDelete !== true) return "BULK_DELETE_CONFIRMATION_REQUIRED";
  }
  if (body.action === "status" && !isStatus(body.value)) return "INVALID_STATUS";
  if (body.action === "role" && !isRole(body.value)) return "INVALID_ROLE";
  if (body.action === "role" && (body.value === "admin" || body.value === "superadmin") && actor?.role !== "superadmin") return "SUPERADMIN_REQUIRED_FOR_ADMIN_ROLE";
  if (body.action === "feature") {
    if (actor?.role !== "superadmin") return "SUPERADMIN_REQUIRED_FOR_FEATURE_OVERRIDE";
    if (!isFeatureId(body.featureId)) return "UNKNOWN_FEATURE_ID";
    if (!isFeatureOverride(body.featureOverride)) return "INVALID_FEATURE_OVERRIDE";
    const feature = FEATURE_BY_ID.get(body.featureId);
    if (body.featureOverride === false && feature && !feature.canDisable) return "FEATURE_CANNOT_BE_DISABLED";
  }
  if (rows.some((row) => row.id === actor?.id) && body.action === "status" && body.value !== "active") return "CANNOT_DISABLE_OWN_ACCOUNT";
  if (rows.some((row) => row.id === actor?.id) && body.action === "role" && !["admin", "superadmin"].includes(String(body.value))) return "CANNOT_REMOVE_OWN_ADMIN_AUTHORITY";
  return null;
}

async function wouldRemoveLastAdministrator(client: any, rows: any[], body: BulkBody): Promise<boolean> {
  if (body.action !== "status" && body.action !== "role" && body.action !== "delete") return false;
  const activeAdminIds = new Set((await client.query("SELECT id FROM users WHERE status = 'active' AND role IN ('admin','superadmin') ORDER BY id FOR UPDATE")).rows.map((row: any) => String(row.id)));
  for (const row of rows) {
    if (!activeAdminIds.has(String(row.id))) continue;
    if (body.action === "status" && body.value !== "active") activeAdminIds.delete(String(row.id));
    if (body.action === "role" && !["admin", "superadmin"].includes(String(body.value))) activeAdminIds.delete(String(row.id));
    if (body.action === "delete") activeAdminIds.delete(String(row.id));
  }
  return activeAdminIds.size === 0;
}

export async function adminUsersManagementRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/users/summary", { preHandler: [requireRole("admin")] }, async (_request, reply) => {
    const result = await query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'active')::int AS active,
              COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended,
              COUNT(*) FILTER (WHERE status = 'banned')::int AS banned,
              COUNT(*) FILTER (WHERE last_login >= CURRENT_DATE)::int AS logged_today,
              COUNT(*) FILTER (WHERE last_login IS NULL)::int AS never_logged_in,
              COUNT(*) FILTER (WHERE last_login IS NULL OR last_login < NOW() - INTERVAL '30 days')::int AS inactive_30
       FROM users`,
    );
    return reply.send({ summary: result.rows[0] });
  });

  app.get("/api/admin/users/:id/management", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userResult = await query(
      `SELECT id, email, username, COALESCE(NULLIF(full_name,''), name) AS name, COALESCE(phone_number, phone) AS phone,
              role, status, rank, military_id, region, created_at, updated_at, last_login, last_login_ip,
              phone_verified_at, profile_completed
       FROM users WHERE id = $1`, [id],
    );
    if (!userResult.rowCount) return reply.code(404).send({ error: "USER_NOT_FOUND" });
    const user = userResult.rows[0];
    const sessions = await query(
      `SELECT id, ip, user_agent, created_at, expires_at FROM sessions
       WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 20`, [id],
    );
    const loginResult = await query(
      `SELECT id, occurred_at, client_ip, peer_ip, user_agent, auth_method, success, failure_reason
       FROM user_login_events WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 30`, [id],
    );
    const logins = loginResult.rows;
    const auditResult = await query(
      `SELECT id, user_id AS actor_id, action, resource, details, ip, user_agent, created_at
       FROM audit_log
       WHERE details->>'targetUserId' = $1 OR (resource = 'users' AND user_id = $1)
       ORDER BY created_at DESC LIMIT 30`, [id],
    );
    const globalFeatures = await getFeatureFlagsPayload();
    const featureOverrideRows = await query<{ feature_id: string; enabled: boolean; updated_at: string }>(
      "SELECT feature_id, enabled, updated_at FROM user_feature_overrides WHERE user_id = $1 ORDER BY feature_id",
      [id],
    );
    const overrideByFeature = new Map(featureOverrideRows.rows.map((row) => [row.feature_id, row.enabled] as const));
    const features = FEATURES.map((feature) => {
      const override = overrideByFeature.has(feature.id) ? overrideByFeature.get(feature.id)! : null;
      const globalEnabled = globalFeatures.flags[feature.id] ?? true;
      return {
        id: feature.id,
        label: feature.label,
        category: feature.category,
        canDisable: feature.canDisable,
        globalEnabled,
        override,
        effectiveEnabled: override === null ? globalEnabled : override,
      };
    });
    const activeAdministratorResult = await query(
      "SELECT COUNT(*)::int AS total FROM users WHERE status = 'active' AND role IN ('admin','superadmin')",
    );
    const deleteBlockReason = userDeleteBlockReason(
      request.user,
      user,
      Number(activeAdministratorResult.rows[0]?.total || 0),
    );
    return reply.send({
      user,
      access: { model: "ROLE_DERIVED", role: user.role, capabilities: capabilitiesForRole(user.role as UserRole) },
      features,
      canManageFeatureOverrides: request.user?.role === "superadmin",
      canDeleteUser: deleteBlockReason === null,
      deleteBlockReason,
      sessions: sessions.rows,
      loginEvents: logins,
      auditEvents: auditResult.rows,
    });
  });

  app.put("/api/admin/users/:id/profile", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = (request as any).user;
    const body = request.body as {
      name?: string;
      email?: string;
      phone?: string;
      rank?: string;
      militaryId?: string;
      region?: string;
    };
    const name = normalized(body.name);
    const email = normalized(body.email).toLowerCase();
    const phone = normalized(body.phone);
    const rank = normalized(body.rank);
    const militaryId = normalized(body.militaryId);
    const region = normalized(body.region);
    const errors: string[] = [];
    if (!name) errors.push("NAME_REQUIRED");
    if (!email && !phone) errors.push("EMAIL_OR_PHONE_REQUIRED");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) errors.push("INVALID_EMAIL");
    if (name.length > 200) errors.push("NAME_TOO_LONG");
    if (email.length > 320) errors.push("EMAIL_TOO_LONG");
    if (phone.length > 64) errors.push("PHONE_TOO_LONG");
    if (rank.length > 120 || militaryId.length > 120 || region.length > 160) errors.push("PROFILE_FIELD_TOO_LONG");
    if (errors.length > 0) return reply.code(400).send({ error: "USER_PROFILE_VALIDATION_FAILED", errors });
    if (email && isConfiguredAdminEmail(email) && actor?.role !== "superadmin") {
      return reply.code(403).send({ error: "SUPERADMIN_REQUIRED_FOR_CONFIGURED_ADMIN_EMAIL" });
    }

    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(2147483647)");
      const current = await client.query(
        `SELECT id, email, COALESCE(NULLIF(full_name,''), name) AS name,
                COALESCE(phone_number, phone) AS phone, role, rank, military_id, region
         FROM users WHERE id = $1 FOR UPDATE`, [id],
      );
      if (!current.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "USER_NOT_FOUND" });
      }
      const duplicate = await client.query(
        `SELECT id FROM users
         WHERE id <> $1 AND (
           ($2 <> '' AND lower(COALESCE(email,'')) = lower($2))
           OR ($3 <> '' AND COALESCE(phone_number, phone, '') = $3)
         ) LIMIT 1`,
        [id, email, phone],
      );
      if (duplicate.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "USER_IDENTITY_ALREADY_EXISTS" });
      }
      const updated = await client.query(
        `UPDATE users
         SET email=NULLIF($1,''), full_name=$2, name=$2,
             phone_number=NULLIF($3,''), phone=NULLIF($3,''),
             rank=NULLIF($4,''), military_id=NULLIF($5,''), service_number=NULLIF($5,''),
             region=NULLIF($6,''), updated_at=NOW()
         WHERE id=$7
         RETURNING id, email, username, COALESCE(NULLIF(full_name,''),name) AS name,
                   COALESCE(phone_number,phone) AS phone, role, status, rank, military_id,
                   region, created_at, updated_at, last_login, last_login_ip,
                   phone_verified_at, profile_completed`,
        [email, name, phone, rank, militaryId, region, id],
      );
      await client.query(
        "INSERT INTO audit_log (user_id, action, resource, details, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)",
        [actor?.id ?? null, "user.profile_update", "users", {
          targetUserId: id,
          before: current.rows[0],
          after: updated.rows[0],
        }, request.ip, request.headers["user-agent"] || ""],
      );
      await client.query("COMMIT");
      return reply.send({ user: updated.rows[0] });
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
      return reply.code(500).send({ error: error instanceof Error ? error.message : "USER_PROFILE_UPDATE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.delete("/api/admin/users/:id", { preHandler: [requireRole("superadmin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = (request as any).user;
    const body = (request.body || {}) as { confirmation?: string };
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(2147483647)");
      const targetResult = await client.query(
        `SELECT id, email, COALESCE(NULLIF(full_name,''), name) AS name, role, status
         FROM users WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!targetResult.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "USER_NOT_FOUND" });
      }
      const target = targetResult.rows[0];
      const activeAdministratorRows = await client.query(
        "SELECT id FROM users WHERE status = 'active' AND role IN ('admin','superadmin') ORDER BY id FOR UPDATE",
      );
      const blockReason = userDeleteBlockReason(actor, target, activeAdministratorRows.rows.length);
      if (blockReason) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: blockReason });
      }
      const expectedConfirmation = normalized(target.email) || String(target.id);
      if (normalized(body.confirmation).toLowerCase() !== expectedConfirmation.toLowerCase()) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "DELETE_CONFIRMATION_MISMATCH", expected: expectedConfirmation });
      }
      const dependencyPolicy = "database_fk_rules";
      const deleted = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
      if (deleted.rowCount !== 1) throw new Error("USER_DELETE_ROWCOUNT_MISMATCH");
      await client.query(
        "INSERT INTO audit_log (user_id, action, resource, details, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)",
        [actor?.id ?? null, "user.delete", "users", {
          targetUserId: id,
          deletedUser: target,
          dependencyPolicy,
        }, request.ip, request.headers["user-agent"] || ""],
      );
      await client.query("COMMIT");
      return reply.send({ ok: true, deletedUserId: id, dependencyPolicy });
    } catch (error: any) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
      if (error?.code === "23503") return reply.code(409).send({ error: "USER_DELETE_REFERENTIAL_CONFLICT" });
      return reply.code(500).send({ error: error instanceof Error ? error.message : "USER_DELETE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.put("/api/admin/users/:id/features", { preHandler: [requireRole("superadmin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = (request as any).user;
    const body = request.body as { overrides?: Record<string, boolean | null> };
    if (!body?.overrides || typeof body.overrides !== "object" || Array.isArray(body.overrides)) {
      return reply.code(400).send({ error: "FEATURE_OVERRIDES_REQUIRED" });
    }
    const entries = Object.entries(body.overrides);
    for (const [featureId, override] of entries) {
      if (!isFeatureId(featureId)) return reply.code(400).send({ error: "UNKNOWN_FEATURE_ID", featureId });
      if (!isFeatureOverride(override)) return reply.code(400).send({ error: "INVALID_FEATURE_OVERRIDE", featureId });
      const feature = FEATURE_BY_ID.get(featureId);
      if (override === false && feature && !feature.canDisable) {
        return reply.code(409).send({ error: "FEATURE_CANNOT_BE_DISABLED", featureId });
      }
    }

    const client = await getClient();
    try {
      await client.query("BEGIN");
      const userResult = await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [id]);
      if (!userResult.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "USER_NOT_FOUND" });
      }
      const beforeResult = await client.query(
        "SELECT feature_id, enabled FROM user_feature_overrides WHERE user_id = $1 ORDER BY feature_id FOR UPDATE",
        [id],
      );
      await client.query("DELETE FROM user_feature_overrides WHERE user_id = $1", [id]);
      for (const [featureId, override] of entries) {
        if (override === null) continue;
        await client.query(
          `INSERT INTO user_feature_overrides (user_id, feature_id, enabled, updated_by, updated_at)
           VALUES ($1,$2,$3,$4,NOW())`,
          [id, featureId, override, String(actor?.id || "unknown_admin")],
        );
      }
      const afterResult = await client.query(
        "SELECT feature_id, enabled FROM user_feature_overrides WHERE user_id = $1 ORDER BY feature_id",
        [id],
      );
      await client.query(
        "INSERT INTO audit_log (user_id, action, resource, details, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)",
        [actor?.id ?? null, "user.features_update", "users", {
          targetUserId: id,
          before: beforeResult.rows,
          after: afterResult.rows,
        }, request.ip, request.headers["user-agent"] || ""],
      );
      await client.query("COMMIT");
      let invalidationBroadcasted = true;
      try { await broadcastFeatureFlagsUpdate(); } catch { invalidationBroadcasted = false; }
      return reply.send({ ok: true, overrides: afterResult.rows, invalidationBroadcasted });
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
      return reply.code(500).send({ error: error instanceof Error ? error.message : "USER_FEATURE_UPDATE_FAILED" });
    } finally {
      client.release();
    }
  });

  app.post("/api/admin/users", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const actor = (request as any).user;
    const validation = validateImportRow(request.body as ImportRow, actor?.role || "");
    if (!validation.valid) return reply.code(400).send({ error: "USER_VALIDATION_FAILED", errors: validation.errors });
    const row = validation.normalized;
    const duplicate = await query(
      `SELECT id FROM users
       WHERE ($1 <> '' AND lower(email) = lower($1))
          OR ($2 <> '' AND COALESCE(phone_number, phone) = $2)
       LIMIT 1`,
      [row.email, row.phone],
    );
    if (duplicate.rowCount) return reply.code(409).send({ error: "USER_ALREADY_EXISTS" });
    const passwordHash = await hashPassword(row.password);
    const usernameBase = (row.email ? row.email.split("@")[0] : "user").replace(/[^a-z0-9_]+/giu, "_").toLowerCase() || "user";
    const username = `${usernameBase}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const result = await query(
      `INSERT INTO users (email, username, full_name, name, phone_number, phone, password_hash, role, status)
       VALUES (NULLIF($1,''), $2, $3, $3, NULLIF($4,''), NULLIF($4,''), $5, $6, $7)
       RETURNING id, email, username, full_name AS name, phone_number AS phone, role, status, created_at`,
      [row.email, username, row.name, row.phone, passwordHash, row.role, row.status],
    );
    const created = result.rows[0];
    await query(
      "INSERT INTO audit_log (user_id, action, resource, details, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)",
      [actor?.id ?? null, "user.create", "users", { targetUserId: created.id, role: created.role, status: created.status }, request.ip, request.headers["user-agent"] || ""],
    );
    return reply.code(201).send({ user: created });
  });

  app.post("/api/admin/users/bulk", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const body = request.body as BulkBody;
    const actor = (request as any).user;
    const client = await getClient();
    const correlationId = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(2147483647)");
      const targets = await resolveBulkTargets(client, body);
      const blockReason = bulkBlockReason(targets.rows, actor, body)
        || ((await wouldRemoveLastAdministrator(client, targets.rows, body)) ? "CANNOT_REMOVE_LAST_ACTIVE_ADMINISTRATOR" : null);
      const preview = {
        correlationId,
        requested: targets.rows.length,
        affected: blockReason ? 0 : targets.rows.length,
        blocked: Boolean(blockReason),
        blockReason,
        targets: targets.rows.map((row: any) => ({ id: row.id, name: row.name, email: row.email, role: row.role, status: row.status })),
      };
      if (body.dryRun !== false) {
        await client.query("ROLLBACK");
        return reply.send({ preview });
      }
      if (blockReason) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: blockReason, preview });
      }
      if (body.action === "status") {
        await client.query("UPDATE users SET status = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])", [body.value, targets.rows.map((row: any) => row.id)]);
        if (body.value !== "active") await client.query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [targets.rows.map((row: any) => row.id)]);
      } else if (body.action === "role") {
        await client.query("UPDATE users SET role = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])", [body.value, targets.rows.map((row: any) => row.id)]);
      } else if (body.action === "revoke_sessions") {
        await client.query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [targets.rows.map((row: any) => row.id)]);
      } else if (body.action === "feature" && isFeatureId(body.featureId) && isFeatureOverride(body.featureOverride)) {
        const targetIds = targets.rows.map((row: any) => row.id);
        if (body.featureOverride === null) {
          await client.query(
            "DELETE FROM user_feature_overrides WHERE user_id = ANY($1::uuid[]) AND feature_id = $2",
            [targetIds, body.featureId],
          );
        } else {
          await client.query(
            `INSERT INTO user_feature_overrides (user_id, feature_id, enabled, updated_by, updated_at)
             SELECT target_id, $2, $3, $4, NOW() FROM unnest($1::uuid[]) AS target_id
             ON CONFLICT (user_id, feature_id) DO UPDATE
             SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
            [targetIds, body.featureId, body.featureOverride, String(actor?.id || "unknown_admin")],
          );
        }
      } else if (body.action === "delete") {
        const targetIds = targets.rows.map((row: any) => row.id);
        const deleted = await client.query("DELETE FROM users WHERE id = ANY($1::uuid[]) RETURNING id", [targetIds]);
        if (Number(deleted.rowCount || 0) !== targetIds.length) throw new Error("BULK_USER_DELETE_ROWCOUNT_MISMATCH");
      }
      for (const target of targets.rows) {
        await client.query(
          "INSERT INTO audit_log (user_id, action, resource, details, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)",
          [actor?.id ?? null, `user.bulk.${body.action}`, "users", {
            targetUserId: target.id,
            correlationId,
            value: body.value ?? null,
            featureId: body.featureId ?? null,
            featureOverride: body.action === "feature" ? body.featureOverride ?? null : null,
          }, request.ip, request.headers["user-agent"] || ""],
        );
      }
      await client.query("COMMIT");
      let invalidationBroadcasted = true;
      if (body.action === "feature") {
        try { await broadcastFeatureFlagsUpdate(); } catch { invalidationBroadcasted = false; }
      }
      return reply.send({
        result: {
          correlationId,
          requested: targets.rows.length,
          affected: targets.rows.length,
          action: body.action,
          value: body.value ?? null,
          featureId: body.featureId ?? null,
          featureOverride: body.action === "feature" ? body.featureOverride ?? null : null,
          invalidationBroadcasted,
        },
      });
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
      if ((error as any)?.code === "23503") return reply.code(409).send({ error: "USER_DELETE_REFERENTIAL_CONFLICT", correlationId });
      const message = error instanceof Error ? error.message : "BULK_USER_ACTION_FAILED";
      const status = message === "BULK_SCOPE_TOO_LARGE" ? 413 : 500;
      return reply.code(status).send({ error: message, correlationId });
    } finally {
      client.release();
    }
  });

  app.post("/api/admin/users/import", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const actor = (request as any).user;
    const body = request.body as { rows?: ImportRow[]; dryRun?: boolean; duplicatePolicy?: "skip" | "update" };
    const duplicatePolicy: "skip" | "update" = body.duplicatePolicy === "update" ? "update" : "skip";
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, IMPORT_LIMIT + 1) : [];
    if (rows.length === 0) return reply.code(400).send({ error: "IMPORT_ROWS_REQUIRED" });
    if (rows.length > IMPORT_LIMIT) return reply.code(413).send({ error: "IMPORT_SCOPE_TOO_LARGE" });
    const validation = rows.map((row, index) => ({ index, source: row, ...validateImportRow(row, actor?.role || "") }));
    const emails = validation.map((item) => item.normalized.email).filter(Boolean);
    const phones = validation.map((item) => item.normalized.phone).filter(Boolean);
    const existing = await query(
      `SELECT id, lower(COALESCE(email,'')) AS email, COALESCE(phone_number, phone, '') AS phone FROM users
       WHERE lower(COALESCE(email,'')) = ANY($1::text[]) OR COALESCE(phone_number, phone, '') = ANY($2::text[])`,
      [emails, phones],
    );
    const idsByEmail = new Map<string, Set<string>>();
    const idsByPhone = new Map<string, Set<string>>();
    for (const row of existing.rows) {
      const id = String(row.id);
      const email = String(row.email || "");
      const phone = String(row.phone || "");
      if (email) {
        const ids = idsByEmail.get(email) || new Set<string>();
        ids.add(id);
        idsByEmail.set(email, ids);
      }
      if (phone) {
        const ids = idsByPhone.get(phone) || new Set<string>();
        ids.add(id);
        idsByPhone.set(phone, ids);
      }
    }
    const emailCounts = new Map<string, number>();
    const phoneCounts = new Map<string, number>();
    for (const item of validation) {
      if (item.normalized.email) emailCounts.set(item.normalized.email, (emailCounts.get(item.normalized.email) || 0) + 1);
      if (item.normalized.phone) phoneCounts.set(item.normalized.phone, (phoneCounts.get(item.normalized.phone) || 0) + 1);
    }
    const previewRows = validation.map((item) => {
      const matchedIds = new Set<string>();
      for (const id of idsByEmail.get(item.normalized.email) || []) matchedIds.add(id);
      for (const id of idsByPhone.get(item.normalized.phone) || []) matchedIds.add(id);
      const duplicate = matchedIds.size > 0;
      const ambiguous = matchedIds.size > 1;
      const duplicateInFile = Boolean(
        (item.normalized.email && (emailCounts.get(item.normalized.email) || 0) > 1)
        || (item.normalized.phone && (phoneCounts.get(item.normalized.phone) || 0) > 1),
      );
      const errors = [...item.errors];
      if (ambiguous) errors.push("AMBIGUOUS_DUPLICATE_USER");
      if (duplicateInFile) errors.push("DUPLICATE_IN_IMPORT_FILE");
      const skipped = duplicate && duplicatePolicy === "skip" && errors.length === 0;
      const valid = errors.length === 0 && !skipped;
      return {
        index: item.index,
        valid,
        skipped,
        duplicate,
        errors,
        matchedUserId: matchedIds.size === 1 ? [...matchedIds][0] : null,
        user: { ...item.normalized, password: undefined },
      };
    });
    const preview = {
      requested: rows.length,
      valid: previewRows.filter((row) => row.valid).length,
      invalid: previewRows.filter((row) => row.errors.length > 0).length,
      skipped: previewRows.filter((row) => row.skipped).length,
      duplicates: previewRows.filter((row) => row.duplicate).length,
      rows: previewRows,
    };
    if (body.dryRun !== false) return reply.send({ preview });
    if (preview.invalid > 0) return reply.code(409).send({ error: "IMPORT_REQUIRES_CLEAN_PREVIEW", preview });
    const client = await getClient();
    const correlationId = randomUUID();
    let applied = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    try {
      await client.query("BEGIN");
      for (const item of validation) {
        const row = item.normalized;
        const existingUsers = await client.query(
          `SELECT id FROM users
           WHERE ($1 <> '' AND lower(email) = lower($1))
              OR ($2 <> '' AND COALESCE(phone_number, phone) = $2)
           ORDER BY id FOR UPDATE`,
          [row.email, row.phone],
        );
        const matchedIds = Array.from(new Set(existingUsers.rows.map((candidate: any) => String(candidate.id))));
        if (matchedIds.length > 1) throw new Error("AMBIGUOUS_DUPLICATE_USER");
        if (matchedIds.length === 1 && duplicatePolicy === "skip") {
          skipped += 1;
          continue;
        }
        if (matchedIds.length === 1) {
          await client.query(
            `UPDATE users
             SET email=COALESCE(NULLIF($1,''), email), full_name=$2, name=$2,
                 phone_number=COALESCE(NULLIF($3,''), phone_number, phone),
                 phone=COALESCE(NULLIF($3,''), phone, phone_number),
                 role=$4, status=$5, updated_at=NOW()
             WHERE id=$6`,
            [row.email, row.name, row.phone, row.role, row.status, matchedIds[0]],
          );
          updated += 1;
          applied += 1;
          continue;
        }
        const passwordHash = await hashPassword(row.password);
        const usernameBase = (row.email ? row.email.split("@")[0] : "user").replace(/[^a-z0-9_]+/giu, "_").toLowerCase() || "user";
        const username = `${usernameBase}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
        await client.query(
          `INSERT INTO users (email,username,full_name,name,phone_number,phone,password_hash,role,status)
           VALUES (NULLIF($1,''),$2,$3,$3,NULLIF($4,''),NULLIF($4,''),$5,$6,$7)`,
          [row.email, username, row.name, row.phone, passwordHash, row.role, row.status],
        );
        inserted += 1;
        applied += 1;
      }
      await client.query(
        "INSERT INTO audit_log (user_id, action, resource, details, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)",
        [actor?.id ?? null, "user.import", "users", {
          correlationId,
          requested: rows.length,
          applied,
          inserted,
          updated,
          skipped,
          duplicatePolicy,
        }, request.ip, request.headers["user-agent"] || ""],
      );
      await client.query("COMMIT");
      return reply.send({ result: { correlationId, requested: rows.length, applied, inserted, updated, skipped } });
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
      const message = error instanceof Error ? error.message : "IMPORT_FAILED";
      const status = message === "AMBIGUOUS_DUPLICATE_USER" ? 409 : 500;
      return reply.code(status).send({ error: message, correlationId });
    } finally {
      client.release();
    }
  });

  app.get("/api/admin/users/export.csv", { preHandler: [requireRole("admin")] }, async (request, reply) => {
    const filters = request.query as UserFilters;
    const filter = buildFilterSql(filters);
    const result = await query(
      `SELECT u.id, COALESCE(NULLIF(u.full_name,''),u.name) AS name, u.email, COALESCE(u.phone_number, u.phone) AS phone,
              u.role, u.status, u.created_at, u.last_login, u.last_login_ip
       FROM users u WHERE 1=1${filter.sql} ORDER BY u.created_at DESC LIMIT 10000`,
      filter.params,
    );
    const header = ["id", "name", "email", "phone", "role", "status", "created_at", "last_login", "last_login_ip"];
    const lines = [header.map(csvCell).join(",")];
    for (const row of result.rows) lines.push(header.map((key) => csvCell(row[key])).join(","));
    const csv = `\uFEFF${lines.join("\r\n")}\r\n`;
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="watany-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    return reply.send(csv);
  });
}
