import { describe, expect, it } from "vitest";
import { initPluginDb } from "../db/plugin-db";
import {
  enqueueManagedCommunityNotification,
  getNotificationSettings,
  muteNotificationRoom,
  registerNotificationPushDevice,
  updateNotificationPreference,
} from "./notification-authority";

async function createPluginDb() {
  return initPluginDb(":memory:", true, {
    info: () => undefined,
    warn: () => undefined,
  });
}

describe("notification authority", () => {
  it("stores safe previews by default and rich previews after explicit opt-in", async () => {
    const pluginDb = await createPluginDb();
    const userId = "community-member-preview-1";

    const safeResult = enqueueManagedCommunityNotification({
      pluginDb,
      targetUserId: userId,
      groupId: "health-room",
      notificationId: "notif-safe-preview",
      title: "رد جديد",
      safeBody: "معاينة آمنة",
      richBody: "معاينة موسعة",
      kind: "system",
      refType: "route",
      refId: "/groups/health-room?messageId=msg-safe",
      createdAtTs: Date.now(),
      channel: "reply",
    });

    expect(safeResult).toMatchObject({ inserted: true });
    expect(pluginDb.prepare("SELECT * FROM notifications WHERE id = ? AND (user_id IS NULL OR user_id = ?)").get(
      "notif-safe-preview",
      userId,
    )).toMatchObject({
      body: "معاينة آمنة",
    });

    updateNotificationPreference(pluginDb, userId, { previewMode: "rich" });
    const richResult = enqueueManagedCommunityNotification({
      pluginDb,
      targetUserId: userId,
      groupId: "health-room",
      notificationId: "notif-rich-preview",
      title: "رد جديد",
      safeBody: "معاينة آمنة أخرى",
      richBody: "هذه معاينة موسعة للنص الكامل",
      kind: "system",
      refType: "route",
      refId: "/groups/health-room?messageId=msg-rich",
      createdAtTs: Date.now(),
      channel: "reply",
    });

    expect(richResult).toMatchObject({ inserted: true });
    expect(pluginDb.prepare("SELECT * FROM notifications WHERE id = ? AND (user_id IS NULL OR user_id = ?)").get(
      "notif-rich-preview",
      userId,
    )).toMatchObject({
      body: "هذه معاينة موسعة للنص الكامل",
    });
  });

  it("suppresses notifications during quiet hours and for muted rooms", async () => {
    const pluginDb = await createPluginDb();
    const userId = "community-member-quiet-1";
    const groupId = "quiet-room";

    updateNotificationPreference(pluginDb, userId, {
      quietHoursEnabled: true,
      timezone: "Asia/Beirut",
    });

    const quietHoursResult = enqueueManagedCommunityNotification({
      pluginDb,
      targetUserId: userId,
      groupId,
      notificationId: "notif-quiet-hours",
      title: "رد جديد",
      safeBody: "معاينة آمنة",
      richBody: "معاينة موسعة",
      kind: "system",
      refType: "route",
      refId: "/groups/health-room?messageId=msg-quiet",
      createdAtTs: Date.parse("2026-06-24T20:30:00.000Z"),
      channel: "reply",
    });

    expect(quietHoursResult).toMatchObject({
      inserted: false,
      suppressedBy: "quiet_hours",
    });

    updateNotificationPreference(pluginDb, userId, { quietHoursEnabled: false });
    muteNotificationRoom(pluginDb, userId, groupId, "8h");

    const roomMuteResult = enqueueManagedCommunityNotification({
      pluginDb,
      targetUserId: userId,
      groupId,
      notificationId: "notif-muted-room",
      title: "رد جديد",
      safeBody: "معاينة آمنة",
      richBody: "معاينة موسعة",
      kind: "system",
      refType: "route",
      refId: "/groups/health-room?messageId=msg-muted",
      createdAtTs: Date.now(),
      channel: "mention",
    });

    expect(roomMuteResult).toMatchObject({
      inserted: false,
      suppressedBy: "room_muted",
    });
  });

  it("tracks retryable push failures on registered devices", async () => {
    const pluginDb = await createPluginDb();
    const userId = "community-member-push-1";
    const groupId = "push-room";

    updateNotificationPreference(pluginDb, userId, { pushEnabled: true });
    registerNotificationPushDevice(pluginDb, userId, {
      provider: "mock",
      endpoint: "mock://fail/member-browser",
      label: "Member Browser",
    });

    const result = enqueueManagedCommunityNotification({
      pluginDb,
      targetUserId: userId,
      groupId,
      notificationId: "notif-push-failure",
      title: "رد جديد",
      safeBody: "معاينة آمنة",
      richBody: "معاينة موسعة",
      kind: "system",
      refType: "route",
      refId: "/groups/health-room?messageId=msg-push",
      createdAtTs: Date.now(),
      channel: "reply",
    });

    expect(result).toMatchObject({ inserted: true });
    expect(getNotificationSettings(pluginDb, userId).devices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        endpoint: "mock://fail/member-browser",
        lastDeliveryStatus: "retryable_failure",
        lastDeliveryError: "mock_provider_unreachable",
        retryCount: 1,
      }),
    ]));
  });
});