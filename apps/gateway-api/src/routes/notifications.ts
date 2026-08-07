/**
 * Notification routes — list, patch, clear.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import type { NotificationPreviewMode, NotificationPushProvider, NotificationRoomMuteDuration, PluginDb } from "../types/domain";
import {
  extractCommunityGroupIdFromNotificationRoute,
  getNotificationSettings,
  muteNotificationRoom,
  registerNotificationPushDevice,
  removeNotificationPushDevice,
  unmuteNotificationRoom,
  updateNotificationPreference,
} from "../lib/notification-authority";
import { query } from "../lib/db";
import { requireAuth, mapNotificationRow } from "../lib/helpers";
import { getWebPushPublicConfig, normalizeWebPushSubscription } from "../lib/webpush-authority";

interface NotificationRoutesOptions {
  pluginDb: PluginDb;
}

function parsePreviewMode(value: unknown): NotificationPreviewMode | undefined {
  return value === "rich" || value === "safe" ? value : undefined;
}

function parsePushProvider(value: unknown): NotificationPushProvider | undefined {
  return value === "webpush" || value === "mock" ? value : undefined;
}

function parseRoomMuteDuration(value: unknown): NotificationRoomMuteDuration | undefined {
  return value === "8h" || value === "1w" || value === "indefinite" ? value : undefined;
}

async function notificationRowAccessibleToActor(actorId: string, row: Record<string, unknown>): Promise<boolean> {
  if (row.ref_type !== "route") {
    return true;
  }

  const groupId = extractCommunityGroupIdFromNotificationRoute(typeof row.ref_id === "string" ? row.ref_id : undefined);
  if (!groupId) {
    return true;
  }

  const result = await query<{ status: string }>(
    `SELECT status
      FROM community_group_members
      WHERE group_id = $1 AND user_id = $2
      LIMIT 1`,
    [groupId, actorId],
  );

  if (result.rows.length === 0) {
    return true;
  }

  return result.rows[0]?.status === "active";
}

async function filterAccessibleNotificationRows(actorId: string, rows: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
  const visibility = await Promise.all(rows.map(async (row) => ({
    row,
    visible: await notificationRowAccessibleToActor(actorId, row),
  })));

  return visibility.filter((entry) => entry.visible).map((entry) => entry.row);
}

export const notificationRoutes: FastifyPluginAsync<NotificationRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/notifications", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) return { items: [] };
    const actorId = req.user?.id || "default";
    const rows: Array<Record<string, unknown>> = pluginDb
      .prepare("SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY ts DESC")
      .all(actorId);
    const visibleRows = await filterAccessibleNotificationRows(actorId, rows);
    return { items: visibleRows.map(mapNotificationRow) };
  });

  app.get("/api/notifications/preferences", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return {
        preference: null,
        roomMutes: [],
        devices: [],
      };
    }

    const actorId = req.user?.id || "default";
    return getNotificationSettings(pluginDb, actorId);
  });

  app.patch<{
    Body: {
      replyEnabled?: boolean;
      mentionEnabled?: boolean;
      pushEnabled?: boolean;
      previewMode?: NotificationPreviewMode;
      quietHoursEnabled?: boolean;
      timezone?: string;
    };
  }>("/api/notifications/preferences", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return { error: "unauthorized" };
    }

    const actorId = req.user?.id || "default";
    return updateNotificationPreference(pluginDb, actorId, {
      replyEnabled: typeof req.body?.replyEnabled === "boolean" ? req.body.replyEnabled : undefined,
      mentionEnabled: typeof req.body?.mentionEnabled === "boolean" ? req.body.mentionEnabled : undefined,
      pushEnabled: typeof req.body?.pushEnabled === "boolean" ? req.body.pushEnabled : undefined,
      previewMode: parsePreviewMode(req.body?.previewMode),
      quietHoursEnabled: typeof req.body?.quietHoursEnabled === "boolean" ? req.body.quietHoursEnabled : undefined,
      timezone: typeof req.body?.timezone === "string" ? req.body.timezone : undefined,
    });
  });

  app.post<{ Body: { duration?: NotificationRoomMuteDuration }; Params: { roomId: string } }>("/api/notifications/rooms/:roomId/mute", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return { error: "unauthorized" };
    }

    const duration = parseRoomMuteDuration(req.body?.duration);
    if (!duration) {
      reply.code(400);
      return { error: "notification_room_mute_duration_invalid" };
    }

    const actorId = req.user?.id || "default";
    return muteNotificationRoom(pluginDb, actorId, req.params.roomId, duration);
  });

  app.delete<{ Params: { roomId: string } }>("/api/notifications/rooms/:roomId/mute", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return { error: "unauthorized" };
    }

    const actorId = req.user?.id || "default";
    return unmuteNotificationRoom(pluginDb, actorId, req.params.roomId);
  });

  app.post<{ Body: { provider?: NotificationPushProvider; endpoint?: string; label?: string } }>("/api/notifications/devices", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return { error: "unauthorized" };
    }

    if (typeof req.body?.endpoint !== "string" || !req.body.endpoint.trim()) {
      reply.code(400);
      return { error: "notification_device_endpoint_required" };
    }

    const actorId = req.user?.id || "default";
    return registerNotificationPushDevice(pluginDb, actorId, {
      provider: parsePushProvider(req.body.provider),
      endpoint: req.body.endpoint,
      label: req.body.label,
    });
  });

  app.get("/api/notifications/push/public-key", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return { error: "unauthorized" };
    }

    return getWebPushPublicConfig();
  });

  app.post<{ Body: { label?: string; subscription?: unknown } }>("/api/notifications/push/subscriptions", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return { error: "unauthorized" };
    }

    const pushConfig = getWebPushPublicConfig();
    if (!pushConfig.configured || !pushConfig.publicKey) {
      reply.code(503);
      return { error: pushConfig.error || "notification_push_unavailable" };
    }

    const subscription = normalizeWebPushSubscription(req.body?.subscription);
    if (!subscription) {
      reply.code(400);
      return { error: "notification_push_subscription_invalid" };
    }

    const actorId = req.user?.id || "default";
    return registerNotificationPushDevice(pluginDb, actorId, {
      provider: "webpush",
      endpoint: subscription.endpoint,
      label: req.body?.label,
      subscription,
    });
  });

  app.delete<{ Params: { id: string } }>("/api/notifications/push/subscriptions/:id", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return { error: "unauthorized" };
    }

    const actorId = req.user?.id || "default";
    return removeNotificationPushDevice(pluginDb, actorId, req.params.id);
  });

  app.delete<{ Params: { id: string } }>("/api/notifications/devices/:id", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) {
      return { error: "unauthorized" };
    }

    const actorId = req.user?.id || "default";
    return removeNotificationPushDevice(pluginDb, actorId, req.params.id);
  });

  app.patch<{ Body: { read?: boolean }; Params: { id: string } }>("/api/notifications/:id", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) return { error: "unauthorized" };
    const id = req.params.id;
    const actorId = req.user?.id || "default";
    const row: Record<string, unknown> | undefined = pluginDb.prepare("SELECT * FROM notifications WHERE id = ? AND (user_id IS NULL OR user_id = ?)").get(id, actorId);
    if (!row) {
      reply.code(404);
      return { error: "notification not found" };
    }
    if (!(await notificationRowAccessibleToActor(actorId, row))) {
      reply.code(404);
      return { error: "notification not found" };
    }
    const read = req.body?.read ? 1 : 0;
    pluginDb.prepare("UPDATE notifications SET read = ? WHERE id = ? AND (user_id IS NULL OR user_id = ?)").run(read, id, actorId);
    const fresh: Record<string, unknown> = pluginDb.prepare("SELECT * FROM notifications WHERE id = ? AND (user_id IS NULL OR user_id = ?)").get(id, actorId) || row;
    return mapNotificationRow(fresh);
  });

  app.post("/api/notifications/clear", async (req, reply) => {
    if (!requireAuth(pluginDb, reply, "accredited")) return { items: [] };
    const actorId = req.user?.id || "default";
    pluginDb.prepare("UPDATE notifications SET read = 1 WHERE user_id IS NULL OR user_id = ?").run(actorId);
    const rows: Array<Record<string, unknown>> = pluginDb
      .prepare("SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY ts DESC")
      .all(actorId);
    const visibleRows = await filterAccessibleNotificationRows(actorId, rows);
    return { items: visibleRows.map(mapNotificationRow) };
  });
};
