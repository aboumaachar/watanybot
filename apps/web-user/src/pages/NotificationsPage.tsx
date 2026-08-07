import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Alert24Regular, ArrowCounterclockwise24Regular, CheckmarkCircle24Regular } from "../theme/watany-v4/legacyIconBridge";
import { useNavigate } from "react-router-dom";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import InlineInfoButton from "../components/InlineInfoButton";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import type {
  NotificationItem,
  NotificationPushProvider,
  NotificationPushSubscription,
  NotificationRoomMuteDuration,
  NotificationSettings,
} from "../types/domain";
import { useApp } from "../store/app";
import { api } from "../lib/api";
import { emitWatanyFeatureBadgeCounts } from "../features/notification-badges";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/notifications-layout-fix.css";


import { WatanyFeatureTemplate } from "../components/template";

function publishNotificationBadgeCounts(items: NotificationItem[]) {
  emitWatanyFeatureBadgeCounts({
    notifications: items.filter((item) => !item.read).length,
  });
}

function resolveNotificationRoute(item: NotificationItem): string | null {
  if (item.refType === "route" && typeof item.refId === "string" && item.refId.startsWith("/")) {
    return item.refId;
  }

  return null;
}

function resolveNotificationRoomId(item: NotificationItem): string | null {
  const route = resolveNotificationRoute(item);
  if (!route) {
    return null;
  }

  const match = /^\/groups\/([^/?#]+)/.exec(route);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function describeRoomMuteState(isMuted: boolean, isIndefinite: boolean | undefined): string {
  if (!isMuted) {
    return "غير مكتومة";
  }

  return isIndefinite ? "مكتومة بلا مدة" : "مكتومة مؤقتاً";
}

function describeDeviceDeliveryStatus(status: NotificationSettings["devices"][number]["lastDeliveryStatus"]): {
  tone: "verified" | "pending";
  label: string;
} {
  if (status === "permanent_failure") {
    return {
      tone: "pending",
      label: "يحتاج إعادة الربط",
    };
  }

  if (status === "retryable_failure") {
    return {
      tone: "pending",
      label: "آخر إرسال يحتاج إعادة محاولة",
    };
  }

  if (status === "sent") {
    return {
      tone: "verified",
      label: "تم الإرسال",
    };
  }

  return {
    tone: "verified",
    label: "جاهز",
  };
}

type BrowserNotificationPermission = NotificationPermission | "unsupported";

function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof globalThis === "undefined" || !("Notification" in globalThis)) {
    return "unsupported";
  }

  return Notification.permission;
}

function supportsBrowserPush(): boolean {
  if (typeof globalThis === "undefined") {
    return false;
  }

  return "Notification" in globalThis && "serviceWorker" in navigator && "PushManager" in globalThis;
}

function urlBase64ToArrayBuffer(base64Value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64Value.length % 4)) % 4);
  const normalized = `${base64Value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = globalThis.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}

function serializePushSubscription(subscription: PushSubscription): NotificationPushSubscription | null {
  const snapshot = subscription.toJSON();
  const endpoint = typeof snapshot.endpoint === "string" && snapshot.endpoint.trim()
    ? snapshot.endpoint.trim()
    : subscription.endpoint;
  const keys = snapshot.keys;

  if (!endpoint || !keys?.p256dh || !keys.auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime: snapshot.expirationTime ?? subscription.expirationTime ?? null,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  };
}

function resolvePushRegistrationErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();
    if (normalizedMessage.includes("permission denied") || normalizedMessage.includes("incognito") || normalizedMessage.includes("private")) {
      return "لا يمكن ربط تنبيهات المتصفح من نافذة خاصة أو خفية. افتح موطني في نافذة عادية ثم أعد المحاولة.";
    }
  }

  return "تعذّر تفعيل تنبيهات المتصفح.";
}

type NotificationSettingsPanelProps = {
  settings: NotificationSettings;
  previewMode: NotificationSettings["preference"]["previewMode"];
  quietHoursEnabled: boolean;
  pushEnabled: boolean;
  replyEnabled: boolean;
  mentionEnabled: boolean;
  uniqueRoomIds: string[];
  pushSupported: boolean;
  pushPermission: BrowserNotificationPermission;
  pushActionPending: boolean;
  hasWebPushDevice: boolean;
  onTogglePreviewMode: () => void;
  onToggleQuietHours: () => void;
  onTogglePush: () => void;
  onToggleReply: () => void;
  onToggleMention: () => void;
  onRegisterPush: () => void;
  onMuteRoom: (roomId: string, duration: NotificationRoomMuteDuration) => void;
  onUnmuteRoom: (roomId: string) => void;
  onRemoveDevice: (deviceId: string, provider: NotificationPushProvider) => void;
};

function NotificationSettingsPanel(props: Readonly<NotificationSettingsPanelProps>) {
  const {
    settings,
    previewMode,
    quietHoursEnabled,
    pushEnabled,
    replyEnabled,
    mentionEnabled,
    uniqueRoomIds,
    pushSupported,
    pushPermission,
    pushActionPending,
    hasWebPushDevice,
    onTogglePreviewMode,
    onToggleQuietHours,
    onTogglePush,
    onToggleReply,
    onToggleMention,
    onRegisterPush,
    onMuteRoom,
    onUnmuteRoom,
    onRemoveDevice,
  } = props;

  return (
    <section className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card utility-list-card utility-list-card--compact watany-utility-list-card" data-testid="notification-settings-panel">
      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-row">
        <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-copy">
          <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card-title">تفضيلات الخصوصية والتنبيه</div>
          <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card-sub">إدارة معاينات الإشعارات وساعات الهدوء وكتم الغرف والأجهزة المسجّلة.</div>
        </div>
      </div>

      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__footer" style={{ justifyContent: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={onTogglePreviewMode}>
          {previewMode === "rich" ? "استخدام المعاينة الآمنة" : "تفعيل المعاينة الموسعة"}
        </button>
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={onToggleQuietHours}>
          {quietHoursEnabled ? "إيقاف ساعات الهدوء 22:00-07:00" : "تفعيل ساعات الهدوء 22:00-07:00"}
        </button>
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={onTogglePush}>
          {pushEnabled ? "إيقاف التنبيهات الفورية" : "تفعيل التنبيهات الفورية"}
        </button>
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={onToggleReply}>
          {replyEnabled ? "إيقاف تنبيهات الردود" : "تفعيل تنبيهات الردود"}
        </button>
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={onToggleMention}>
          {mentionEnabled ? "إيقاف تنبيهات الإشارات" : "تفعيل تنبيهات الإشارات"}
        </button>
      </div>

      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__footer" style={{ justifyContent: "flex-start", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
        <button
          className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-secondary watany-ui-inline-action"
          disabled={!pushSupported || pushActionPending}
          onClick={onRegisterPush}
        >
          {pushActionPending ? "جارٍ ربط هذا المتصفح..." : hasWebPushDevice ? "إعادة ربط هذا المتصفح" : "ربط هذا المتصفح بالتنبيهات الفورية"}
        </button>
        {!pushSupported ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">هذا المتصفح لا يدعم التنبيهات الفورية عبر Service Worker.</div> : null}
        {pushPermission === "denied" ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">تم حظر التنبيهات من المتصفح. فعّل الإذن من إعدادات المتصفح ثم أعد المحاولة.</div> : null}
        {pushPermission === "granted" ? <span className="pill watany-ui-pill verified">إذن المتصفح مفعّل</span> : null}
      </div>

      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__footer" style={{ justifyContent: "flex-start", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
        <span className={`pill watany-ui-pill ${previewMode === "rich" ? "verified" : "pending"}`}>{previewMode === "rich" ? "معاينة موسعة" : "معاينة آمنة"}</span>
        <span className={`pill watany-ui-pill ${quietHoursEnabled ? "verified" : "pending"}`}>{quietHoursEnabled ? "ساعات الهدوء مفعّلة" : "ساعات الهدوء غير مفعّلة"}</span>
        <span className={`pill watany-ui-pill ${pushEnabled ? "verified" : "pending"}`}>{pushEnabled ? "التنبيهات الفورية مفعّلة" : "التنبيهات الفورية غير مفعّلة"}</span>
      </div>

      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized results" style={{ marginTop: "0.75rem", gap: "0.75rem" }}>
        {uniqueRoomIds.map((roomId) => {
          const mute = settings.roomMutes.find((entry) => entry.roomId === roomId);
          const muteStateLabel = describeRoomMuteState(Boolean(mute), mute?.isIndefinite);
          return (
            <div key={roomId} className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__footer" style={{ justifyContent: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
              <span className="pill watany-ui-pill pending">{roomId}</span>
              <span className={`pill watany-ui-pill ${mute ? "verified" : "pending"}`}>{muteStateLabel}</span>
              <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={() => onMuteRoom(roomId, "8h")}>
                كتم 8 ساعات
              </button>
              <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={() => onMuteRoom(roomId, "1w")}>
                كتم أسبوع
              </button>
              <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={() => onMuteRoom(roomId, "indefinite")}>
                كتم دائم
              </button>
              {mute ? (
                <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-secondary watany-ui-inline-action" onClick={() => onUnmuteRoom(roomId)}>
                  إزالة الكتم
                </button>
              ) : null}
            </div>
          );
        })}

        {settings.devices.map((device) => {
          const deliveryState = describeDeviceDeliveryStatus(device.lastDeliveryStatus);
          return (
            <div key={device.id} className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__footer" style={{ justifyContent: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
              <span className="pill watany-ui-pill verified">{device.label || device.endpoint}</span>
              <span className={`pill watany-ui-pill ${deliveryState.tone}`}>{deliveryState.label}</span>
              <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-secondary watany-ui-inline-action" onClick={() => onRemoveDevice(device.id, device.provider)}>
                إزالة الجهاز
              </button>
            </div>
          );
        })}

        {settings.devices.length === 0 ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">لا توجد أجهزة مسجّلة حالياً.</div> : null}
      </div>
    </section>
  );
}

type NotificationCardProps = {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  onToggle: (id: string) => void;
};

function NotificationCard(props: Readonly<NotificationCardProps>) {
  const { item, onOpen, onToggle } = props;
  const targetRoute = resolveNotificationRoute(item);

  return (
    <div className={`wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card notif-item utility-list-card utility-list-card--compact watany-utility-list-card ${item.read ? "read" : "unread"}`}>
      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-row">
        <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-copy">
          <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card-title">{item.title}</div>
          <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card-sub">{new Date(item.ts).toLocaleString("ar-LB")}</div>
        </div>
        <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-actions">
          <InlineInfoButton text={item.body} label={`عرض محتوى الإشعار ${item.title}`} />
        </div>
      </div>
      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__footer">
        <span className={`pill watany-ui-pill ${item.read ? "verified" : "pending"}`}>{item.read ? "مقروء" : "بانتظار المراجعة"}</span>
        {targetRoute ? (
          <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-secondary watany-ui-inline-action" onClick={() => onOpen(item)}>
            فتح المحادثة
          </button>
        ) : null}
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized btn btn-ghost watany-ui-inline-action" onClick={() => onToggle(item.id)}>
          {item.read ? "إعادة التعيين كغير مقروء" : "تعيين كمقروء"}
        </button>
      </div>
    </div>
  );
}

function NotificationsPageLegacy() {
  const { apiBaseUrl, profile } = useApp();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [pushPermission, setPushPermission] = useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());
  const [pushActionPending, setPushActionPending] = useState(false);
  const [error, setError] = useState("");
  const isAuthed = profile.isAuthed;

  useEffect(() => {
    setPushPermission(getBrowserNotificationPermission());
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) {
      setNotifications([]);
      setSettings(null);
      setError("");
      return;
    }

    Promise.all([
      api.getNotifications(apiBaseUrl),
      api.getNotificationSettings(apiBaseUrl),
    ])
      .then(([items, nextSettings]) => {
        setNotifications(items);
        setSettings(nextSettings);
      })
      .catch(() => setError("تعذّر تحميل سجل الإشعارات."));
  }, [apiBaseUrl, isAuthed]);

  useEffect(() => {
    publishNotificationBadgeCounts(notifications);
  }, [notifications]);

  async function refreshNotifications() {
    if (!isAuthed) {
      setNotifications([]);
      setSettings(null);
      setError("");
      return;
    }

    setError("");
    try {
      const [items, nextSettings] = await Promise.all([
        api.getNotifications(apiBaseUrl),
        api.getNotificationSettings(apiBaseUrl),
      ]);
      setNotifications(items);
      setSettings(nextSettings);
      publishNotificationBadgeCounts(items);
    } catch {
      setError("تعذّر تحديث سجل الإشعارات.");
    }
  }

  async function updateSettings(action: Promise<NotificationSettings>, fallbackMessage: string) {
    setError("");
    try {
      const nextSettings = await action;
      setSettings(nextSettings);
    } catch {
      setError(fallbackMessage);
    }
  }

  async function togglePreference(field: "replyEnabled" | "mentionEnabled" | "pushEnabled", value: boolean) {
    if (!isAuthed) {
      return;
    }

    await updateSettings(
      api.updateNotificationPreferences({ [field]: value }, apiBaseUrl),
      "تعذّر تحديث تفضيلات الإشعارات.",
    );
  }

  async function togglePreviewMode(useRichPreview: boolean) {
    if (!isAuthed) {
      return;
    }

    await updateSettings(
      api.updateNotificationPreferences({ previewMode: useRichPreview ? "rich" : "safe" }, apiBaseUrl),
      "تعذّر تحديث نمط المعاينة.",
    );
  }

  async function toggleQuietHours(enabled: boolean) {
    if (!isAuthed) {
      return;
    }

    await updateSettings(
      api.updateNotificationPreferences({ quietHoursEnabled: enabled }, apiBaseUrl),
      "تعذّر تحديث ساعات الهدوء.",
    );
  }

  async function muteRoom(roomId: string, duration: NotificationRoomMuteDuration) {
    await updateSettings(
      api.muteNotificationRoom(roomId, duration, apiBaseUrl),
      "تعذّر تحديث كتم الغرفة.",
    );
  }

  async function unmuteRoom(roomId: string) {
    await updateSettings(
      api.unmuteNotificationRoom(roomId, apiBaseUrl),
      "تعذّر إزالة كتم الغرفة.",
    );
  }

  async function registerPushDevice() {
    if (!isAuthed) {
      return;
    }

    if (!supportsBrowserPush()) {
      setPushPermission("unsupported");
      setError("هذا المتصفح لا يدعم التنبيهات الفورية عبر Service Worker.");
      return;
    }

    setError("");
    setPushActionPending(true);
    try {
      const pushConfig = await api.getNotificationPushPublicConfig(apiBaseUrl);
      if (!pushConfig.configured || !pushConfig.publicKey) {
        throw new Error(pushConfig.error || "notification_push_unavailable");
      }

      let permission = getBrowserNotificationPermission();
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      setPushPermission(permission);

      if (permission !== "granted") {
        setError(permission === "denied"
          ? "تم رفض إذن التنبيهات من المتصفح. فعّله من إعدادات المتصفح ثم أعد المحاولة."
          : "يجب السماح بالتنبيهات لتسجيل هذا المتصفح.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(pushConfig.publicKey),
      });
      const serializedSubscription = serializePushSubscription(subscription);
      if (!serializedSubscription) {
        setError("تعذّر قراءة اشتراك التنبيهات من المتصفح.");
        return;
      }

      let nextSettings = await api.registerNotificationPushSubscription({
        label: "متصفح هذا الجهاز",
        subscription: serializedSubscription,
      }, apiBaseUrl);
      if (!nextSettings.preference.pushEnabled) {
        nextSettings = await api.updateNotificationPreferences({ pushEnabled: true }, apiBaseUrl);
      }
      setSettings(nextSettings);
    } catch (error) {
      setError(resolvePushRegistrationErrorMessage(error));
    } finally {
      setPushActionPending(false);
    }
  }

  async function removeDevice(deviceId: string, provider: NotificationPushProvider) {
    setError("");
    try {
      const nextSettings = provider === "webpush"
        ? await api.removeNotificationPushSubscription(deviceId, apiBaseUrl)
        : await api.removeNotificationDevice(deviceId, apiBaseUrl);
      setSettings(nextSettings);

      if (provider === "webpush" && supportsBrowserPush()) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          await subscription?.unsubscribe();
        } catch {
          // Ignore browser unsubscribe failures once server authority has removed the device.
        }
      }
    } catch {
      setError("تعذّر إزالة جهاز التنبيهات.");
    }
  }

  async function toggleNotification(id: string) {
    if (!isAuthed) {
      return;
    }

    setError("");
    const target = notifications.find((item) => item.id === id);
    if (!target) return;
    try {
      const updated = await api.markNotification(id, !target.read, apiBaseUrl);
      setNotifications((prev) => {
        const nextItems = prev.map((item) => (item.id === id ? updated : item));
        publishNotificationBadgeCounts(nextItems);
        return nextItems;
      });
    } catch {
      setError("تعذّر تحديث حالة الإشعار.");
    }
  }

  async function clearNotifications() {
    if (!isAuthed) {
      setNotifications([]);
      setError("");
      return;
    }

    setError("");
    try {
      const items = await api.clearNotifications(apiBaseUrl);
      setNotifications(items);
      publishNotificationBadgeCounts(items);
    } catch {
      setError("تعذّر تحديث سجل الإشعارات.");
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!isAuthed) {
      return;
    }

    const targetRoute = resolveNotificationRoute(item);
    if (!targetRoute) {
      return;
    }

    setError("");
    if (!item.read) {
      try {
        const updated = await api.markNotification(item.id, true, apiBaseUrl);
        setNotifications((prev) => {
          const nextItems = prev.map((entry) => (entry.id === item.id ? updated : entry));
          publishNotificationBadgeCounts(nextItems);
          return nextItems;
        });
      } catch {
        setError("تعذّر فتح الإشعار حالياً.");
        return;
      }
    }

    navigate(targetRoute);
  }

  const unreadCount = notifications.filter((item) => !item.read).length;
  const previewMode = settings?.preference.previewMode ?? "safe";
  const quietHoursEnabled = settings?.preference.quietHours.enabled ?? false;
  const pushEnabled = settings?.preference.pushEnabled ?? false;
  const replyEnabled = settings?.preference.replyEnabled ?? true;
  const mentionEnabled = settings?.preference.mentionEnabled ?? true;
  const pushSupported = supportsBrowserPush();
  const hasWebPushDevice = settings?.devices.some((device) => device.provider === "webpush") ?? false;
  const uniqueRoomIds = Array.from(new Set(
    notifications
      .map((item) => resolveNotificationRoomId(item))
      .filter((roomId): roomId is string => Boolean(roomId)),
  ));
  const readAllStyle = { "--utility-color": "#2563eb" } as CSSProperties;
  const refreshStyle = { "--utility-color": "#0f766e" } as CSSProperties;
  const unreadStyle = { "--utility-color": "#7c3aed" } as CSSProperties;

  return (
    <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel utility-page watany-utility-page">
      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-header watany-utility-page__header">
        <UtilityHeaderTitleRow
          className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized"
          titleClassName="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-title"
          title="سجل الإشعارات"
          infoText="راجع الإشعارات وحدّث حالتها أو علّمها كمقروءة."
          infoLabel="حول سجل الإشعارات"
        />
      </div>

      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-grid utility-action-grid--compact">
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card watany-utility-action-card" onClick={() => void clearNotifications()} style={readAllStyle}>
          <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={<CheckmarkCircle24Regular aria-hidden />} />
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">تعليم مقروء</span>
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">تحديث جميع الإشعارات الحالية إلى حالة المقروء.</span>
        </button>
        <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card watany-utility-action-card" onClick={() => void refreshNotifications()} style={refreshStyle}>
          <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={<ArrowCounterclockwise24Regular aria-hidden />} />
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">تحديث</span>
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">إعادة تحميل الإشعارات لضمان عرض أحدث البيانات.</span>
        </button>
        <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card utility-action-card--static watany-utility-action-card" style={unreadStyle}>
          <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={<Alert24Regular aria-hidden />} />
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">غير مقروءة</span>
          <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">{`${unreadCount} من أصل ${notifications.length || 0} إشعار بحاجة إلى مراجعة.`}</span>
        </div>
      </div>

      {error ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel-error">{error}</div> : null}
      {isAuthed && settings ? (
        <NotificationSettingsPanel
          settings={settings}
          previewMode={previewMode}
          quietHoursEnabled={quietHoursEnabled}
          pushEnabled={pushEnabled}
          replyEnabled={replyEnabled}
          mentionEnabled={mentionEnabled}
          uniqueRoomIds={uniqueRoomIds}
          pushSupported={pushSupported}
          pushPermission={pushPermission}
          pushActionPending={pushActionPending}
          hasWebPushDevice={hasWebPushDevice}
          onTogglePreviewMode={() => void togglePreviewMode(previewMode !== "rich")}
          onToggleQuietHours={() => void toggleQuietHours(!quietHoursEnabled)}
          onTogglePush={() => void togglePreference("pushEnabled", !pushEnabled)}
          onToggleReply={() => void togglePreference("replyEnabled", !replyEnabled)}
          onToggleMention={() => void togglePreference("mentionEnabled", !mentionEnabled)}
          onRegisterPush={() => void registerPushDevice()}
          onMuteRoom={(roomId, duration) => void muteRoom(roomId, duration)}
          onUnmuteRoom={(roomId) => void unmuteRoom(roomId)}
          onRemoveDevice={(deviceId, provider) => void removeDevice(deviceId, provider)}
        />
      ) : null}
      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized results watany-utility-page__results">
        {isAuthed ? null : <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">سجّل الدخول لعرض إشعاراتك الشخصية.</div>}
        {notifications.map((item) => (
          <NotificationCard
            key={item.id}
            item={item}
            onOpen={(notification) => void openNotification(notification)}
            onToggle={(id) => void toggleNotification(id)}
          />
        ))}
        {isAuthed && notifications.length === 0 ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">لا توجد إشعارات متاحة حالياً.</div> : null}
      </div>
    </div>
  );
}




// APEX_PHASE3D_UTILITY_ROUTE_READY: next safe slice may wrap this route with WatanyUtilityRoute after component-specific review.
export default function NotificationsPage() {
  return (
    <WatanyFeatureTemplate
      category="general"
      eyebrow="WatanyBot unified surface"
      title="Notifications"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.2."
      meta={[{ label: "Route", value: "/notifications" }]}
      className="watany-template-batch-v142"
    >
      <div data-watany-template-batch="v1.4.2" data-watany-template-route="/notifications">
        <NotificationsPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}


