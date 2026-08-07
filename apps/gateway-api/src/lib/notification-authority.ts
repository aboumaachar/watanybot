import type {
  NotificationItem,
  NotificationPreference,
  NotificationPreviewMode,
  NotificationPushDevice,
  NotificationPushProvider,
  NotificationPushSubscription,
  NotificationRoomMute,
  NotificationRoomMuteDuration,
  NotificationSettings,
  PluginDb,
} from "../types/domain";
import { makeId } from "./helpers";
import { normalizeWebPushSubscription, sendWebPushNotification } from "./webpush-authority";

const DEFAULT_NOTIFICATION_TIMEZONE = "Asia/Beirut";
const QUIET_HOURS_START = "22:00" as const;
const QUIET_HOURS_END = "07:00" as const;

type NotificationPreferencePatch = {
  replyEnabled?: boolean;
  mentionEnabled?: boolean;
  pushEnabled?: boolean;
  previewMode?: NotificationPreviewMode;
  quietHoursEnabled?: boolean;
  timezone?: string;
};

type NotificationPushDeviceInput = {
  provider?: NotificationPushProvider;
  endpoint: string;
  label?: string;
  subscription?: NotificationPushSubscription | null;
};

type CommunityNotificationChannel = "reply" | "mention";

type NotificationPushDispatchPayload = {
  notificationId: string;
  kind: NotificationItem["kind"];
  title: string;
  body: string;
  route?: string;
};

type EnqueueNotificationResult = {
  inserted: boolean;
  suppressedBy?: "reply_disabled" | "mention_disabled" | "room_muted" | "quiet_hours";
  preference: NotificationPreference;
};

function intToBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeNotificationTimezone(value: unknown): string {
  const candidate = stringValue(value) || DEFAULT_NOTIFICATION_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: candidate,
      hour: "2-digit",
    }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_NOTIFICATION_TIMEZONE;
  }
}

function defaultNotificationPreference(userId: string): NotificationPreference {
  return {
    userId,
    replyEnabled: true,
    mentionEnabled: true,
    pushEnabled: false,
    previewMode: "safe",
    quietHours: {
      enabled: false,
      start: QUIET_HOURS_START,
      end: QUIET_HOURS_END,
      timezone: DEFAULT_NOTIFICATION_TIMEZONE,
    },
    updatedAt: Date.now(),
  };
}

function mapNotificationPreferenceRow(row: Record<string, unknown> | undefined, userId: string): NotificationPreference {
  const defaults = defaultNotificationPreference(userId);
  if (!row) {
    return defaults;
  }

  return {
    userId,
    replyEnabled: intToBoolean(row.reply_enabled, defaults.replyEnabled),
    mentionEnabled: intToBoolean(row.mention_enabled, defaults.mentionEnabled),
    pushEnabled: intToBoolean(row.push_enabled, defaults.pushEnabled),
    previewMode: row.preview_mode === "rich" ? "rich" : "safe",
    quietHours: {
      enabled: intToBoolean(row.quiet_hours_enabled, defaults.quietHours.enabled),
      start: QUIET_HOURS_START,
      end: QUIET_HOURS_END,
      timezone: normalizeNotificationTimezone(row.timezone),
    },
    updatedAt: numberValue(row.updated_at, defaults.updatedAt),
  };
}

function mapNotificationRoomMuteRow(row: Record<string, unknown>): NotificationRoomMute {
  const mutedUntilMs = row.mute_until == null ? undefined : numberValue(row.mute_until);
  return {
    roomId: String(row.room_id),
    mutedUntil: mutedUntilMs ? new Date(mutedUntilMs).toISOString() : undefined,
    isIndefinite: intToBoolean(row.is_indefinite, false),
    updatedAt: numberValue(row.updated_at, Date.now()),
  };
}

function mapNotificationPushDeviceRow(row: Record<string, unknown>): NotificationPushDevice {
  let lastDeliveryStatus: NotificationPushDevice["lastDeliveryStatus"] = "idle";
  if (row.last_delivery_status === "sent") {
    lastDeliveryStatus = "sent";
  } else if (row.last_delivery_status === "permanent_failure") {
    lastDeliveryStatus = "permanent_failure";
  } else if (row.last_delivery_status === "retryable_failure") {
    lastDeliveryStatus = "retryable_failure";
  }

  return {
    id: String(row.id),
    provider: row.provider === "webpush" ? "webpush" : "mock",
    endpoint: String(row.endpoint),
    label: stringValue(row.label),
    lastDeliveryStatus,
    lastDeliveryError: stringValue(row.last_delivery_error),
    lastDeliveredAt: row.last_delivered_at == null ? undefined : numberValue(row.last_delivered_at),
    retryCount: numberValue(row.retry_count, 0),
    createdAt: numberValue(row.created_at, Date.now()),
    updatedAt: numberValue(row.updated_at, Date.now()),
  };
}

function parseStoredNotificationPushSubscription(row: Record<string, unknown>): NotificationPushSubscription | null {
  const raw = stringValue(row.subscription_json);
  if (!raw) {
    return null;
  }

  try {
    return normalizeWebPushSubscription(JSON.parse(raw));
  } catch {
    return null;
  }
}

function activeRoomMutes(roomMutes: NotificationRoomMute[], nowTs: number): NotificationRoomMute[] {
  return roomMutes.filter((mute) => {
    if (mute.isIndefinite) {
      return true;
    }

    const muteUntilTs = Date.parse(mute.mutedUntil || "");
    return Number.isFinite(muteUntilTs) && muteUntilTs > nowTs;
  });
}

function notificationLocalMinutes(timestamp: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const hourText = parts.find((part) => part.type === "hour")?.value || "00";
  const minuteText = parts.find((part) => part.type === "minute")?.value || "00";
  return Number.parseInt(hourText, 10) * 60 + Number.parseInt(minuteText, 10);
}

function isWithinQuietHours(timestamp: number, preference: NotificationPreference): boolean {
  if (!preference.quietHours.enabled) {
    return false;
  }

  const localMinutes = notificationLocalMinutes(timestamp, preference.quietHours.timezone);
  const startMinutes = 22 * 60;
  const endMinutes = 7 * 60;
  return localMinutes >= startMinutes || localMinutes < endMinutes;
}

function notificationBodyForPreview(previewMode: NotificationPreviewMode, safeBody: string, richBody: string): string {
  return previewMode === "rich" ? richBody : safeBody;
}

function notificationTitleForPushPreview(previewMode: NotificationPreviewMode, richTitle: string): string {
  return previewMode === "rich" ? richTitle : "موطني";
}

function deliverySuppressionReason(
  preference: NotificationPreference,
  roomMutes: NotificationRoomMute[],
  channel: CommunityNotificationChannel,
  groupId: string,
  createdAtTs: number,
): EnqueueNotificationResult["suppressedBy"] {
  if (channel === "reply" && !preference.replyEnabled) {
    return "reply_disabled";
  }

  if (channel === "mention" && !preference.mentionEnabled) {
    return "mention_disabled";
  }

  if (activeRoomMutes(roomMutes, createdAtTs).some((mute) => mute.roomId === groupId)) {
    return "room_muted";
  }

  if (isWithinQuietHours(createdAtTs, preference)) {
    return "quiet_hours";
  }

  return undefined;
}

function updatePushDeviceDeliveryState(
  pluginDb: PluginDb,
  userId: string,
  device: NotificationPushDevice,
  status: NotificationPushDevice["lastDeliveryStatus"],
  error: string | undefined,
  deliveredAt: number | undefined,
): void {
  const retryCount = status === "retryable_failure"
    ? device.retryCount + 1
    : 0;
  pluginDb.prepare(
    "UPDATE notification_push_devices SET last_delivery_status = ?, last_delivery_error = ?, last_delivered_at = ?, retry_count = ?, updated_at = ? WHERE id = ? AND user_id = ?",
  ).run(
    status,
    error ?? null,
    deliveredAt ?? null,
    retryCount,
    Date.now(),
    device.id,
    userId,
  );
}

function dispatchPushNotifications(
  pluginDb: PluginDb,
  userId: string,
  preference: NotificationPreference,
  payload: NotificationPushDispatchPayload,
): void {
  if (!preference.pushEnabled) {
    return;
  }

  const rows = pluginDb.prepare("SELECT * FROM notification_push_devices WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  const deliveredAt = Date.now();

  for (const row of rows) {
    const device = mapNotificationPushDeviceRow(row);
    if (device.provider === "webpush") {
      const subscription = parseStoredNotificationPushSubscription(row);
      if (!subscription) {
        updatePushDeviceDeliveryState(pluginDb, userId, device, "permanent_failure", "webpush_subscription_missing", undefined);
        continue;
      }

      void sendWebPushNotification(subscription, {
        notificationId: payload.notificationId,
        recipientId: userId,
        kind: payload.kind,
        title: payload.title,
        body: payload.body,
        route: payload.route,
      }).then((result) => {
        if (result.status === "sent") {
          updatePushDeviceDeliveryState(pluginDb, userId, device, "sent", undefined, Date.now());
          return;
        }

        updatePushDeviceDeliveryState(pluginDb, userId, device, result.status, result.error, undefined);
      }).catch(() => {
        updatePushDeviceDeliveryState(pluginDb, userId, device, "retryable_failure", "webpush_delivery_failed", undefined);
      });
      continue;
    }

    if (device.endpoint.includes("fail")) {
      updatePushDeviceDeliveryState(pluginDb, userId, device, "retryable_failure", "mock_provider_unreachable", undefined);
      continue;
    }

    updatePushDeviceDeliveryState(pluginDb, userId, device, "sent", undefined, deliveredAt);
  }
}

export function extractCommunityGroupIdFromNotificationRoute(route: string | undefined): string | null {
  const match = /^\/groups\/([^/?#]+)/.exec(String(route || ""));
  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

export function getNotificationSettings(pluginDb: PluginDb, userId: string): NotificationSettings {
  const preferenceRow = pluginDb.prepare("SELECT * FROM notification_preferences WHERE user_id = ?").get(userId);
  const preference = mapNotificationPreferenceRow(preferenceRow, userId);
  const roomMuteRows = pluginDb.prepare("SELECT * FROM notification_room_mutes WHERE user_id = ? ORDER BY updated_at DESC").all(userId);
  const roomMutes = activeRoomMutes(roomMuteRows.map(mapNotificationRoomMuteRow), Date.now());
  const deviceRows = pluginDb.prepare("SELECT * FROM notification_push_devices WHERE user_id = ? ORDER BY created_at DESC").all(userId);

  return {
    preference,
    roomMutes,
    devices: deviceRows.map(mapNotificationPushDeviceRow),
  };
}

export function updateNotificationPreference(
  pluginDb: PluginDb,
  userId: string,
  patch: NotificationPreferencePatch,
): NotificationSettings {
  const current = getNotificationSettings(pluginDb, userId).preference;
  let previewMode = current.previewMode;
  if (patch.previewMode === "rich") {
    previewMode = "rich";
  } else if (patch.previewMode === "safe") {
    previewMode = "safe";
  }

  const next: NotificationPreference = {
    userId,
    replyEnabled: patch.replyEnabled ?? current.replyEnabled,
    mentionEnabled: patch.mentionEnabled ?? current.mentionEnabled,
    pushEnabled: patch.pushEnabled ?? current.pushEnabled,
    previewMode,
    quietHours: {
      enabled: patch.quietHoursEnabled ?? current.quietHours.enabled,
      start: QUIET_HOURS_START,
      end: QUIET_HOURS_END,
      timezone: patch.timezone ? normalizeNotificationTimezone(patch.timezone) : current.quietHours.timezone,
    },
    updatedAt: Date.now(),
  };

  pluginDb.prepare(
    "INSERT INTO notification_preferences (user_id, reply_enabled, mention_enabled, push_enabled, preview_mode, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET reply_enabled = excluded.reply_enabled, mention_enabled = excluded.mention_enabled, push_enabled = excluded.push_enabled, preview_mode = excluded.preview_mode, quiet_hours_enabled = excluded.quiet_hours_enabled, quiet_hours_start = excluded.quiet_hours_start, quiet_hours_end = excluded.quiet_hours_end, timezone = excluded.timezone, updated_at = excluded.updated_at",
  ).run(
    next.userId,
    next.replyEnabled ? 1 : 0,
    next.mentionEnabled ? 1 : 0,
    next.pushEnabled ? 1 : 0,
    next.previewMode,
    next.quietHours.enabled ? 1 : 0,
    next.quietHours.start,
    next.quietHours.end,
    next.quietHours.timezone,
    next.updatedAt,
  );

  return getNotificationSettings(pluginDb, userId);
}

export function muteNotificationRoom(
  pluginDb: PluginDb,
  userId: string,
  roomId: string,
  duration: NotificationRoomMuteDuration,
): NotificationSettings {
  const nowTs = Date.now();
  let muteUntil: number | null = null;
  if (duration === "8h") {
    muteUntil = nowTs + (8 * 60 * 60 * 1000);
  } else if (duration === "1w") {
    muteUntil = nowTs + (7 * 24 * 60 * 60 * 1000);
  }

  pluginDb.prepare(
    "INSERT INTO notification_room_mutes (user_id, room_id, mute_until, is_indefinite, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, room_id) DO UPDATE SET mute_until = excluded.mute_until, is_indefinite = excluded.is_indefinite, updated_at = excluded.updated_at",
  ).run(
    userId,
    roomId,
    muteUntil,
    duration === "indefinite" ? 1 : 0,
    nowTs,
  );

  return getNotificationSettings(pluginDb, userId);
}

export function unmuteNotificationRoom(pluginDb: PluginDb, userId: string, roomId: string): NotificationSettings {
  pluginDb.prepare("DELETE FROM notification_room_mutes WHERE user_id = ? AND room_id = ?").run(userId, roomId);
  return getNotificationSettings(pluginDb, userId);
}

export function registerNotificationPushDevice(
  pluginDb: PluginDb,
  userId: string,
  input: NotificationPushDeviceInput,
): NotificationSettings {
  const endpoint = stringValue(input.endpoint);
  if (!endpoint) {
    return getNotificationSettings(pluginDb, userId);
  }

  const provider: NotificationPushProvider = input.provider === "webpush" ? "webpush" : "mock";
  const subscription = provider === "webpush"
    ? normalizeWebPushSubscription(input.subscription)
    : null;
  if (provider === "webpush" && !subscription) {
    return getNotificationSettings(pluginDb, userId);
  }
  const existing = pluginDb.prepare("SELECT * FROM notification_push_devices WHERE user_id = ? AND endpoint = ?").get(userId, endpoint);
  const nowTs = Date.now();
  const existingId = existing ? stringValue(existing.id) : undefined;
  const existingLastDeliveryStatus = existing ? stringValue(existing.last_delivery_status) : undefined;
  const existingLastDeliveryError = existing ? stringValue(existing.last_delivery_error) : undefined;
  const deviceId = existingId ?? makeId("notification_device");
  const createdAt = existing?.created_at ? numberValue(existing.created_at, nowTs) : nowTs;

  pluginDb.prepare(
    "INSERT INTO notification_push_devices (id, user_id, provider, endpoint, label, last_delivery_status, last_delivery_error, last_delivered_at, retry_count, subscription_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, endpoint) DO UPDATE SET provider = excluded.provider, label = excluded.label, subscription_json = excluded.subscription_json, updated_at = excluded.updated_at",
  ).run(
    deviceId,
    userId,
    provider,
    endpoint,
    stringValue(input.label) ?? null,
    existingLastDeliveryStatus ?? "idle",
    existingLastDeliveryError ?? null,
    existing?.last_delivered_at ? numberValue(existing.last_delivered_at) : null,
    existing?.retry_count ? numberValue(existing.retry_count) : 0,
    subscription ? JSON.stringify(subscription) : null,
    createdAt,
    nowTs,
  );

  return getNotificationSettings(pluginDb, userId);
}

export function removeNotificationPushDevice(pluginDb: PluginDb, userId: string, deviceId: string): NotificationSettings {
  pluginDb.prepare("DELETE FROM notification_push_devices WHERE id = ? AND user_id = ?").run(deviceId, userId);
  return getNotificationSettings(pluginDb, userId);
}

export function enqueueManagedCommunityNotification(input: {
  pluginDb: PluginDb;
  targetUserId: string;
  groupId: string;
  notificationId: string;
  title: string;
  safeBody: string;
  richBody: string;
  kind: NotificationItem["kind"];
  refType?: string;
  refId?: string;
  createdAtTs: number;
  channel: CommunityNotificationChannel;
}): EnqueueNotificationResult {
  const settings = getNotificationSettings(input.pluginDb, input.targetUserId);
  const suppressedBy = deliverySuppressionReason(
    settings.preference,
    settings.roomMutes,
    input.channel,
    input.groupId,
    input.createdAtTs,
  );
  if (suppressedBy) {
    return {
      inserted: false,
      suppressedBy,
      preference: settings.preference,
    };
  }

  const body = notificationBodyForPreview(settings.preference.previewMode, input.safeBody, input.richBody);
  const pushTitle = notificationTitleForPushPreview(settings.preference.previewMode, input.title);
  const result = input.pluginDb.prepare(
    "INSERT OR IGNORE INTO notifications (id, title, body, kind, ts, read, user_id, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    input.notificationId,
    input.title,
    body,
    input.kind,
    input.createdAtTs,
    0,
    input.targetUserId,
    input.refType ?? null,
    input.refId ?? null,
  );

  if (result.changes > 0) {
    dispatchPushNotifications(input.pluginDb, input.targetUserId, settings.preference, {
      notificationId: input.notificationId,
      kind: input.kind,
      title: pushTitle,
      body,
      route: input.refType === "route" ? input.refId : undefined,
    });
  }

  return {
    inserted: result.changes > 0,
    preference: settings.preference,
  };
}