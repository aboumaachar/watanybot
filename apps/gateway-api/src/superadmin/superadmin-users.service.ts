import { SUPERADMIN_USER_MANAGEMENT_POLICY } from "./superadmin-users.policy";
import { query } from "../lib/db.js";
import type {
  ActiveUsersSummary,
  BirthdaySummary,
  SuperadminUserRow,
  SuperadminUsersDashboard,
  UserRoleName,
} from "./superadmin-users.types";

const demoRoleOverrides = new Map<string, UserRoleName[]>();
const ROLE_MAP: Record<string, string> = {
  public: "USER",
  accredited: "USER",
  driver: "DRIVER",
  moderator: "ADMIN",
  admin: "ADMIN",
  superadmin: "SUPERADMIN",
};

const ROLE_REVERSE_MAP: Record<string, string> = {
  USER: "public",
  DRIVER: "driver",
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
};

function normalizeDashboardRole(value: string): UserRoleName {
  const normalized = value.trim().toUpperCase();
  if (normalized === "TAXI_DRIVER") return "DRIVER";
  return normalized || "USER";
}

function toDbRole(value: string): string | null {
  const role = normalizeDashboardRole(value);
  return ROLE_REVERSE_MAP[role] ?? null;
}

function toDashboardRole(value: string | undefined): UserRoleName {
  if (!value) return "USER";
  return ROLE_MAP[value.toLowerCase()] ?? normalizeDashboardRole(value);
}

function normalizeStatus(value: string | undefined): SuperadminUserRow["status"] {
  const status = value?.trim().toUpperCase();
  if (status === "SUSPENDED" || status === "BANNED" || status === "PENDING" || status === "DELETED") return status;
  return "ACTIVE";
}

function getDemoUsers(): SuperadminUserRow[] {
  const users: SuperadminUserRow[] = [
    {
      id: "demo-1",
      displayName: "مستخدم تجريبي",
      username: "demo",
      roles: demoRoleOverrides.get("demo-1") ?? ["USER"],
      status: "ACTIVE",
      birthDate: "1990-05-24",
      birthdayLabel: "24 أيار",
      lastSeenAt: new Date().toISOString(),
      isActiveNow: true,
      lastKnownIp: "hidden-until-real-db",
      registrationIp: "hidden-until-real-db",
      ipCount: 0,
      createdAt: new Date().toISOString(),
    },
  ];
  return users;
}

function mapDbUser(row: Record<string, any>): SuperadminUserRow {
  const displayName = String(row.display_name || row.full_name || row.name || row.username || row.email || row.id);
  const role = toDashboardRole(String(row.role || "public"));
  return {
    id: String(row.id),
    displayName,
    username: row.username ? String(row.username) : undefined,
    email: row.email ? String(row.email) : undefined,
    phone: row.phone_number ? String(row.phone_number) : row.phone ? String(row.phone) : undefined,
    roles: [role],
    status: normalizeStatus(String(row.status || "active")),
    birthDate: row.birth_date ? String(row.birth_date) : undefined,
    lastSeenAt: row.last_login ? new Date(row.last_login).toISOString() : undefined,
    isActiveNow: false,
    lastKnownIp: row.last_ip ? String(row.last_ip) : undefined,
    registrationIp: row.registration_ip ? String(row.registration_ip) : undefined,
    ipCount: Number(row.ip_count || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
  };
}

async function getDbUsers(): Promise<SuperadminUserRow[] | null> {
  try {
    const result = await query(
      `SELECT
         id,
         email,
         username,
         full_name,
         name,
         phone,
         phone_number,
         role,
         status,
         created_at,
         last_login
       FROM users
       ORDER BY created_at DESC
       LIMIT 500`,
    );
    return result.rows.map((row) => mapDbUser(row));
  } catch {
    return null;
  }
}

function isBirthdayToday(birthDate?: string) {
  if (!birthDate) return false;
  const now = new Date();
  const d = new Date(birthDate);
  return d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
}

function buildActiveSummary(users: SuperadminUserRow[]): ActiveUsersSummary {
  return {
    activeNow: users.filter((u) => u.isActiveNow).length,
    activeLast15Minutes: users.filter((u) => u.isActiveNow).length,
    activeToday: users.filter((u) => Boolean(u.lastSeenAt)).length,
    generatedAt: new Date().toISOString(),
  };
}

function buildBirthdaySummary(users: SuperadminUserRow[]): BirthdaySummary {
  return {
    today: users.filter((u) => isBirthdayToday(u.birthDate)),
    upcoming: users
      .filter((u) => Boolean(u.birthDate))
      .slice(0, SUPERADMIN_USER_MANAGEMENT_POLICY.birthdayLookaheadDays),
    generatedAt: new Date().toISOString(),
  };
}

export async function getSuperadminUsersDashboard(filters: {
  q?: string;
  status?: string;
  role?: string;
}): Promise<SuperadminUsersDashboard> {
  // Integration point:
  // Replace demo users with real user table query:
  // - id, displayName, username, email, phone
  // - roles, status
  // - birthDate
  // - lastSeenAt / sessions
  // - lastKnownIp / registrationIp / IP audit count
  const sourceUsers = (await getDbUsers()) ?? getDemoUsers();
  const users = sourceUsers.filter((user) => {
    const q = filters.q?.trim().toLowerCase();
    const qOk =
      !q ||
      [user.displayName, user.username, user.email, user.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    const statusOk = !filters.status || user.status === filters.status;
    const roleOk = !filters.role || user.roles.includes(filters.role);
    return qOk && statusOk && roleOk;
  });

  return {
    users,
    activeUsers: buildActiveSummary(users),
    birthdays: buildBirthdaySummary(users),
    totalUsers: users.length,
    filters,
  };
}

export async function setSuperadminUserRole(userId: string, nextRole: string): Promise<SuperadminUserRow> {
  const dbRole = toDbRole(nextRole);
  if (!dbRole) {
    throw new Error("INVALID_USER_ROLE");
  }

  try {
    const result = await query(
      `UPDATE users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, username, full_name, name, phone, phone_number, role, status, created_at, last_login`,
      [dbRole, userId],
    );

    if (result.rows.length > 0) {
      return mapDbUser(result.rows[0]);
    }
  } catch {
    // Demo fallback below keeps the current local dashboard usable without a live auth DB.
  }

  const demoUser = getDemoUsers().find((user) => user.id === userId);
  if (!demoUser) {
    throw new Error("USER_NOT_FOUND");
  }

  demoRoleOverrides.set(userId, [normalizeDashboardRole(nextRole)]);
  return { ...demoUser, roles: demoRoleOverrides.get(userId) ?? demoUser.roles };
}
