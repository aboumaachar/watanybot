/** @vitest-environment happy-dom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotificationsPage from "./NotificationsPage";
import type { NotificationItem, NotificationSettings } from "../types/domain";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
  appState,
  getNotificationsMock,
  getNotificationSettingsMock,
  getNotificationPushPublicConfigMock,
  markNotificationMock,
  clearNotificationsMock,
  updateNotificationPreferencesMock,
  muteNotificationRoomMock,
  unmuteNotificationRoomMock,
  registerNotificationDeviceMock,
  registerNotificationPushSubscriptionMock,
  removeNotificationDeviceMock,
  removeNotificationPushSubscriptionMock,
  emitBadgeCountsMock,
  notificationRequestPermissionMock,
  pushManagerGetSubscriptionMock,
  pushManagerSubscribeMock,
  pushSubscriptionUnsubscribeMock,
} = vi.hoisted(() => ({
  appState: {
    apiBaseUrl: "http://api.test",
    profile: {
      id: "community-viewer-1",
      isAuthed: true,
    },
  },
  getNotificationsMock: vi.fn(),
  getNotificationSettingsMock: vi.fn(),
  getNotificationPushPublicConfigMock: vi.fn(),
  markNotificationMock: vi.fn(),
  clearNotificationsMock: vi.fn(),
  updateNotificationPreferencesMock: vi.fn(),
  muteNotificationRoomMock: vi.fn(),
  unmuteNotificationRoomMock: vi.fn(),
  registerNotificationDeviceMock: vi.fn(),
  registerNotificationPushSubscriptionMock: vi.fn(),
  removeNotificationDeviceMock: vi.fn(),
  removeNotificationPushSubscriptionMock: vi.fn(),
  emitBadgeCountsMock: vi.fn(),
  notificationRequestPermissionMock: vi.fn(),
  pushManagerGetSubscriptionMock: vi.fn(),
  pushManagerSubscribeMock: vi.fn(),
  pushSubscriptionUnsubscribeMock: vi.fn(),
}));

vi.mock("../store/app", () => ({
  useApp: () => ({
    apiBaseUrl: appState.apiBaseUrl,
    profile: appState.profile,
  }),
}));

vi.mock("../lib/api", () => ({
  api: {
    getNotifications: getNotificationsMock,
    getNotificationSettings: getNotificationSettingsMock,
    getNotificationPushPublicConfig: getNotificationPushPublicConfigMock,
    markNotification: markNotificationMock,
    clearNotifications: clearNotificationsMock,
    updateNotificationPreferences: updateNotificationPreferencesMock,
    muteNotificationRoom: muteNotificationRoomMock,
    unmuteNotificationRoom: unmuteNotificationRoomMock,
    registerNotificationDevice: registerNotificationDeviceMock,
    registerNotificationPushSubscription: registerNotificationPushSubscriptionMock,
    removeNotificationDevice: removeNotificationDeviceMock,
    removeNotificationPushSubscription: removeNotificationPushSubscriptionMock,
  },
}));

vi.mock("../features/notification-badges", () => ({
  emitWatanyFeatureBadgeCounts: emitBadgeCountsMock,
}));

vi.mock("../components/UtilityActionIcon", () => ({
  UtilityActionIcon: ({ icon }: any) => <span>{icon ? "icon" : null}</span>,
}));

vi.mock("../components/InlineInfoButton", () => ({
  default: ({ label }: any) => <button type="button">{label}</button>,
}));

vi.mock("../components/UtilityHeaderTitleRow", () => ({
  default: ({ title }: any) => <h1>{title}</h1>,
}));

vi.mock("../components/template", () => ({
  WatanyFeatureTemplate: ({ children }: any) => <div>{children}</div>,
}));

function GroupRouteMarker() {
  const location = useLocation();
  return <div data-opened-route>{`${location.pathname}${location.search}`}</div>;
}

type NotificationSettingsOverrides = {
  preference?: Partial<NotificationSettings["preference"]> & {
    quietHours?: Partial<NotificationSettings["preference"]["quietHours"]>;
  };
  roomMutes?: NotificationSettings["roomMutes"];
  devices?: NotificationSettings["devices"];
};

function createNotificationSettings(overrides?: NotificationSettingsOverrides): NotificationSettings {
  const preferenceOverrides = overrides?.preference;
  const quietHoursOverrides = preferenceOverrides?.quietHours;
  return {
    preference: {
      userId: "community-viewer-1",
      replyEnabled: true,
      mentionEnabled: true,
      pushEnabled: false,
      previewMode: "safe",
      updatedAt: Date.parse("2026-05-12T19:30:00.000Z"),
      ...preferenceOverrides,
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "07:00",
        timezone: "Asia/Beirut",
        ...quietHoursOverrides,
      },
    },
    roomMutes: overrides?.roomMutes ?? [],
    devices: overrides?.devices ?? [],
  };
}

function installPushBrowserMocks() {
  const activeSubscription = {
    endpoint: "https://push.example.test/subscriptions/member-browser",
    expirationTime: null,
    unsubscribe: pushSubscriptionUnsubscribeMock,
    toJSON: () => ({
      endpoint: "https://push.example.test/subscriptions/member-browser",
      expirationTime: null,
      keys: {
        p256dh: "test-p256dh-key",
        auth: "test-auth-key",
      },
    }),
  };

  notificationRequestPermissionMock.mockResolvedValue("granted");
  pushSubscriptionUnsubscribeMock.mockResolvedValue(true);
  pushManagerGetSubscriptionMock.mockResolvedValueOnce(null).mockResolvedValue(activeSubscription);
  pushManagerSubscribeMock.mockResolvedValue(activeSubscription);

  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: {
      permission: "default",
      requestPermission: notificationRequestPermissionMock,
    },
  });

  Object.defineProperty(globalThis, "PushManager", {
    configurable: true,
    value: function PushManager() {},
  });

  Object.defineProperty(globalThis.navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: pushManagerGetSubscriptionMock,
          subscribe: pushManagerSubscribeMock,
        },
      }),
    },
  });
}

async function flushEffects(times = 4) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await Promise.resolve();
    }
  });
}

describe("NotificationsPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    appState.profile = {
      id: "community-viewer-1",
      isAuthed: true,
    };
    getNotificationsMock.mockReset();
    getNotificationSettingsMock.mockReset();
    getNotificationPushPublicConfigMock.mockReset();
    markNotificationMock.mockReset();
    clearNotificationsMock.mockReset();
    updateNotificationPreferencesMock.mockReset();
    muteNotificationRoomMock.mockReset();
    unmuteNotificationRoomMock.mockReset();
    registerNotificationDeviceMock.mockReset();
    registerNotificationPushSubscriptionMock.mockReset();
    removeNotificationDeviceMock.mockReset();
    removeNotificationPushSubscriptionMock.mockReset();
    emitBadgeCountsMock.mockReset();
    notificationRequestPermissionMock.mockReset();
    pushManagerGetSubscriptionMock.mockReset();
    pushManagerSubscribeMock.mockReset();
    pushSubscriptionUnsubscribeMock.mockReset();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }

    if (container?.isConnected) {
      container.remove();
    }
  });

  it("marks unread route notifications as read before navigating to the thread", async () => {
    const notification: NotificationItem = {
      id: "notif-1",
      title: "تم ذكرك في المجموعة",
      body: "اذهب إلى المحادثة",
      kind: "system",
      ts: Date.parse("2026-05-12T19:30:00.000Z"),
      read: false,
      userId: "community-viewer-1",
      refType: "route",
      refId: "/groups/health-room?messageId=health-msg-9",
    };

    getNotificationsMock.mockResolvedValue([notification]);
    getNotificationSettingsMock.mockResolvedValue(createNotificationSettings());
    markNotificationMock.mockResolvedValue({ ...notification, read: true });
    clearNotificationsMock.mockResolvedValue([]);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/notifications"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/groups/:groupId" element={<GroupRouteMarker />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flushEffects(6);

    expect(getNotificationsMock).toHaveBeenCalledWith("http://api.test");

    const openButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("فتح المحادثة"));
    expect(openButton).toBeTruthy();
    if (!openButton) {
      return;
    }

    await act(async () => {
      openButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(markNotificationMock).toHaveBeenCalledWith("notif-1", true, "http://api.test");
    expect(container.querySelector("[data-opened-route]")?.textContent).toBe("/groups/health-room?messageId=health-msg-9");
  });

  it("surfaces a private-browser message when push subscription is denied after permission was granted", async () => {
    const notification: NotificationItem = {
      id: "notif-private-push",
      title: "تنبيه مجموعة",
      body: "اختبار تسجيل تنبيهات المتصفح",
      kind: "system",
      ts: Date.parse("2026-05-12T19:35:00.000Z"),
      read: false,
      userId: "community-viewer-1",
      refType: "route",
      refId: "/groups/health-room?messageId=health-msg-12",
    };

    installPushBrowserMocks();
    pushManagerGetSubscriptionMock.mockReset();
    pushManagerSubscribeMock.mockReset();
    pushManagerGetSubscriptionMock.mockResolvedValue(null);
    pushManagerSubscribeMock.mockRejectedValue(new DOMException("Registration failed - permission denied", "AbortError"));

    getNotificationsMock.mockResolvedValue([notification]);
    getNotificationSettingsMock.mockResolvedValue(createNotificationSettings());
    getNotificationPushPublicConfigMock.mockResolvedValue({
      provider: "webpush",
      configured: true,
      publicKey: "BElocalTestKeyAbc123",
      subject: "mailto:watanybot-local@localhost",
      source: "runtime_file",
    });
    clearNotificationsMock.mockResolvedValue([notification]);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/notifications"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flushEffects(6);

    const registerDeviceButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("ربط هذا المتصفح"));
    expect(registerDeviceButton).toBeTruthy();
    if (!registerDeviceButton) {
      return;
    }

    await act(async () => {
      registerDeviceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(registerNotificationPushSubscriptionMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("لا يمكن ربط تنبيهات المتصفح من نافذة خاصة أو خفية. افتح موطني في نافذة عادية ثم أعد المحاولة.");
  });

  it("keeps the user on notifications when marking a route notification fails", async () => {
    const notification: NotificationItem = {
      id: "notif-1-blocked",
      title: "تم تعليق العضوية قبل الفتح",
      body: "يجب إيقاف التنقل عند فشل تحديث الإشعار",
      kind: "system",
      ts: Date.parse("2026-05-12T19:32:00.000Z"),
      read: false,
      userId: "community-viewer-1",
      refType: "route",
      refId: "/groups/health-room?messageId=health-msg-blocked",
    };

    getNotificationsMock.mockResolvedValue([notification]);
    getNotificationSettingsMock.mockResolvedValue(createNotificationSettings());
    markNotificationMock.mockRejectedValue(new Error("notification not found"));
    clearNotificationsMock.mockResolvedValue([]);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/notifications"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/groups/:groupId" element={<GroupRouteMarker />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flushEffects(6);

    const openButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("فتح المحادثة"));
    expect(openButton).toBeTruthy();
    if (!openButton) {
      return;
    }

    await act(async () => {
      openButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(markNotificationMock).toHaveBeenCalledWith("notif-1-blocked", true, "http://api.test");
    expect(container.querySelector("[data-opened-route]")).toBeNull();
    expect(container.textContent).toContain("تعذّر فتح الإشعار حالياً.");
  });

  it("updates notification preferences, room mutes, and browser push registration from the settings panel", async () => {
    const notification: NotificationItem = {
      id: "notif-2",
      title: "تنبيه مجموعة",
      body: "تنبيه مرتبط بالغرفة",
      kind: "system",
      ts: Date.parse("2026-05-12T19:35:00.000Z"),
      read: false,
      userId: "community-viewer-1",
      refType: "route",
      refId: "/groups/health-room?messageId=health-msg-11",
    };
    const baseSettings = createNotificationSettings();
    const richPreviewSettings = createNotificationSettings({
      preference: {
        previewMode: "rich",
      },
    });
    const mutedSettings = createNotificationSettings({
      roomMutes: [
        {
          roomId: "health-room",
          isIndefinite: false,
          mutedUntil: "2026-05-13T03:35:00.000Z",
          updatedAt: Date.parse("2026-05-12T19:35:00.000Z"),
        },
      ],
    });
    const deviceSettings = createNotificationSettings({
      devices: [
        {
          id: "device-1",
          provider: "webpush",
          endpoint: "https://push.example.test/subscriptions/member-browser",
          label: "متصفح هذا الجهاز",
          lastDeliveryStatus: "idle",
          retryCount: 0,
          createdAt: Date.parse("2026-05-12T19:35:00.000Z"),
          updatedAt: Date.parse("2026-05-12T19:35:00.000Z"),
        },
      ],
    });
    const pushEnabledSettings = createNotificationSettings({
      preference: {
        pushEnabled: true,
      },
      devices: deviceSettings.devices,
    });

    installPushBrowserMocks();
    getNotificationsMock.mockResolvedValue([notification]);
    getNotificationSettingsMock.mockResolvedValue(baseSettings);
    getNotificationPushPublicConfigMock.mockResolvedValue({
      provider: "webpush",
      configured: true,
      publicKey: "BElocalTestKeyAbc123",
      subject: "mailto:watanybot-local@localhost",
      source: "runtime_file",
    });
    markNotificationMock.mockResolvedValue({ ...notification, read: true });
    clearNotificationsMock.mockResolvedValue([notification]);
    updateNotificationPreferencesMock.mockResolvedValueOnce(richPreviewSettings).mockResolvedValueOnce(pushEnabledSettings);
    muteNotificationRoomMock.mockResolvedValue(mutedSettings);
    unmuteNotificationRoomMock.mockResolvedValue(baseSettings);
    registerNotificationPushSubscriptionMock.mockResolvedValue(deviceSettings);
    removeNotificationPushSubscriptionMock.mockResolvedValue(baseSettings);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={["/notifications"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flushEffects(6);

    const richPreviewButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("تفعيل المعاينة الموسعة"));
    expect(richPreviewButton).toBeTruthy();
    if (!richPreviewButton) {
      return;
    }

    await act(async () => {
      richPreviewButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(updateNotificationPreferencesMock).toHaveBeenCalledWith({ previewMode: "rich" }, "http://api.test");

    const muteButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("كتم 8 ساعات"));
    expect(muteButton).toBeTruthy();
    if (!muteButton) {
      return;
    }

    await act(async () => {
      muteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(muteNotificationRoomMock).toHaveBeenCalledWith("health-room", "8h", "http://api.test");

    const registerDeviceButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("ربط هذا المتصفح"));
    expect(registerDeviceButton).toBeTruthy();
    if (!registerDeviceButton) {
      return;
    }

    await act(async () => {
      registerDeviceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(notificationRequestPermissionMock).toHaveBeenCalledTimes(1);
    expect(getNotificationPushPublicConfigMock).toHaveBeenCalledWith("http://api.test");
    expect(registerNotificationPushSubscriptionMock).toHaveBeenCalledWith({
      label: "متصفح هذا الجهاز",
      subscription: {
        endpoint: "https://push.example.test/subscriptions/member-browser",
        expirationTime: null,
        keys: {
          p256dh: "test-p256dh-key",
          auth: "test-auth-key",
        },
      },
    }, "http://api.test");
    expect(updateNotificationPreferencesMock).toHaveBeenNthCalledWith(2, { pushEnabled: true }, "http://api.test");

    const removeDeviceButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("إزالة الجهاز"));
    expect(removeDeviceButton).toBeTruthy();
    if (!removeDeviceButton) {
      return;
    }

    await act(async () => {
      removeDeviceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushEffects(6);

    expect(removeNotificationPushSubscriptionMock).toHaveBeenCalledWith("device-1", "http://api.test");
    expect(pushSubscriptionUnsubscribeMock).toHaveBeenCalledTimes(1);
  });
});