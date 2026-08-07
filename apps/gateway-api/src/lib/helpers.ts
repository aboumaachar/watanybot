/**
 * Shared helper utilities extracted from server.ts
 */
import type { Role, UserProfile, DocumentItem, NotificationItem, SavedChatItem, PluginDb } from "../types/domain";

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function normalizeText(value: unknown) {
  return String(value || "").trim();
}

export function hasSufficientRole(actual: Role, required: Role) {
  const order: readonly string[] = ["public", "accredited", "moderator", "admin", "superadmin"];
  return order.indexOf(actual) >= order.indexOf(required);
}

function getDevelopmentHeaderRole(reply: any): Role | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const headerRole = reply?.request?.headers?.["x-watany-role"];
  if (typeof headerRole !== "string") {
    return null;
  }

  return headerRole.trim().toLowerCase() === "superadmin" ? "superadmin" : null;
}

export function getProfileRow(pluginDb: PluginDb) {
  return pluginDb.prepare("SELECT role, is_authed FROM profile WHERE id = ?").get("default") as Record<string, unknown>;
}

export function requireAuth(pluginDb: PluginDb, reply: any, minRole: Role = "accredited") {
  const jwtRole = reply?.request?.user?.role as Role | undefined;
  if (jwtRole) {
    if (!hasSufficientRole(jwtRole, minRole)) {
      reply.code(403);
      return null;
    }

    return jwtRole;
  }

  const devRole = getDevelopmentHeaderRole(reply);
  if (devRole) {
    if (!hasSufficientRole(devRole, minRole)) {
      reply.code(403);
      return null;
    }

    if (reply?.request && !reply.request.user) {
      reply.request.user = {
        id: process.env.DEV_SUPERADMIN_ID || "dev-superadmin",
        role: devRole,
        email: process.env.DEV_SUPERADMIN_EMAIL || "admin@koudama.com",
      };
    }

    return devRole;
  }

  const row = getProfileRow(pluginDb);
  const isAuthed = row?.is_authed ? Boolean(row.is_authed) : false;
  const role: Role = row?.role ? String(row.role) as Role : "public";
  if (!isAuthed && minRole !== "public") {
    reply.code(401);
    return null;
  }
  if (!hasSufficientRole(role, minRole)) {
    reply.code(403);
    return null;
  }
  return role;
}

export function mapProfileRow(row?: Record<string, unknown>): UserProfile {
  if (!row) return { isAuthed: false };
  return {
    isAuthed: Boolean(row.is_authed),
    role: row.role ? String(row.role) as UserProfile["role"] : "public",
    name: row.name ? String(row.name) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    email: row.email ? String(row.email) : undefined,
    region: row.region ? String(row.region) : undefined,
    note: row.note ? String(row.note) : undefined,
    lastLogin: row.last_login ? Number(row.last_login) : undefined,
  };
}

type DocumentMeta = Pick<DocumentItem, "sourceFileName" | "mimeType" | "slug" | "extractionStatus" | "extractionError" | "chunkCount">;

function normalizeDocumentMeta(input: Record<string, unknown>): DocumentMeta {
  const next: DocumentMeta = {};

  if (input.sourceFileName) next.sourceFileName = String(input.sourceFileName);
  if (input.mimeType) next.mimeType = String(input.mimeType);
  if (input.slug) next.slug = String(input.slug);
  if (input.extractionError) next.extractionError = String(input.extractionError);

  if (input.extractionStatus) {
    const extractionStatus = String(input.extractionStatus) as DocumentItem["extractionStatus"];
    if (extractionStatus === "not_started" || extractionStatus === "queued" || extractionStatus === "processing" || extractionStatus === "ready" || extractionStatus === "failed") {
      next.extractionStatus = extractionStatus;
    }
  }

  if (typeof input.chunkCount === "number" && Number.isFinite(input.chunkCount) && input.chunkCount >= 0) {
    next.chunkCount = input.chunkCount;
  }

  return next;
}

export function mapDocumentRow(row: Record<string, unknown>): DocumentItem {
  let meta: DocumentMeta = {};

  if (row.meta) {
    try {
      meta = normalizeDocumentMeta(JSON.parse(String(row.meta)) as Record<string, unknown>);
    } catch {
      meta = {};
    }
  }

  return {
    id: String(row.id),
    name: String(row.name),
    kind: String(row.kind) as DocumentItem["kind"],
    status: String(row.status) as DocumentItem["status"],
    updatedAt: Number(row.updated_at),
    ...meta,
    tags: row.tags ? (JSON.parse(String(row.tags)) as string[]) : [],
  };
}

export function mapNotificationRow(row: Record<string, unknown>): NotificationItem {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    kind: String(row.kind) as NotificationItem["kind"],
    ts: Number(row.ts),
    read: Number(row.read) === 1,
    userId: row.user_id ? String(row.user_id) : undefined,
    refType: row.ref_type ? String(row.ref_type) : undefined,
    refId: row.ref_id ? String(row.ref_id) : undefined,
  };
}

export function mapSavedRow(row: Record<string, unknown>): SavedChatItem {
  return {
    id: String(row.id),
    text: String(row.text),
    ts: Number(row.ts),
    status: row.status ? String(row.status) as SavedChatItem["status"] : "active",
    updatedAt: row.updated_at ? Number(row.updated_at) : Number(row.ts),
    closedAt: row.closed_at ? Number(row.closed_at) : undefined,
    archivedAt: row.archived_at ? Number(row.archived_at) : undefined,
    deletedForMeAt: row.deleted_for_me_at ? Number(row.deleted_for_me_at) : undefined,
  };
}
