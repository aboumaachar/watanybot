import { WatanyFeatureTemplate } from "../components/template";
import { useEffect, useMemo, useState } from "react";
import {
  AppsList24Regular,
  Bookmark24Regular,
  Desktop24Regular,
  FullScreenMaximize24Regular,
  Image24Regular,
  TextFont24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { Link } from "react-router-dom";
import { WatanyAppIcon, type WatanyDrawerItem } from "../components/watanybot/WatanyAppIcon";
import { useApp } from "../store/app";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/settings-page.css";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const FONT_OPTIONS: Array<{ value: "normal" | "large" | "xlarge"; label: string }> = [
  { value: "normal", label: "عادي" },
  { value: "large", label: "كبير" },
  { value: "xlarge", label: "كبير جداً" },
];

const SETTINGS_QUICK_TOOL_ITEMS: ReadonlyArray<WatanyDrawerItem> = [
  { id: "chat", label: "Chat", labelAr: "محادثة موطني", route: "/chat", icon: "chat", color: "green" },
  { id: "search", label: "Search", labelAr: "البحث", route: "/search", icon: "search", color: "navy" },
];

type SettingsDraft = {
  fontSize: "normal" | "large" | "xlarge";
  themeMode: "system" | "light" | "dark";
  contrastMode: "normal" | "high";
  showSources: boolean;
  speakReplies: boolean;
  dictationEnabled: boolean;
};

function isPwaStandalone() {
  return globalThis.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    return;
  }

  await document.exitFullscreen();
}

function SettingsPageTemplateContent() {
  const {
    profile,
    hasRole,
    fontSize,
    setFontSize,
    themeMode,
    setThemeMode,
    contrastMode,
    setContrastMode,
    showSources,
    setShowSources,
    speakReplies,
    setSpeakReplies,
    dictationEnabled,
    setDictationEnabled,
  } = useApp();

  const currentSettings = useMemo<SettingsDraft>(() => ({
    fontSize,
    themeMode,
    contrastMode,
    showSources,
    speakReplies,
    dictationEnabled,
  }), [
    contrastMode,
    dictationEnabled,
    fontSize,
    showSources,
    speakReplies,
    themeMode,
  ]);

  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);
  const [installState, setInstallState] = useState<"idle" | "installed" | "dismissed">("idle");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>("");
  const [avatarFileName, setAvatarFileName] = useState<string>("");
  const [draft, setDraft] = useState<SettingsDraft>(currentSettings);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    const cachedAvatar = localStorage.getItem("watany_user_avatar_data_url") || "";
    const cachedAvatarName = localStorage.getItem("watany_user_avatar_file_name") || "";
    setAvatarDataUrl(cachedAvatar);
    setAvatarFileName(cachedAvatarName);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPrompt);
    };

    const handleInstalled = () => {
      setInstallState("installed");
      setDeferredPrompt(null);
    };

    globalThis.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    globalThis.addEventListener("appinstalled", handleInstalled);

    return () => {
      globalThis.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      globalThis.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    setDraft(currentSettings);
  }, [currentSettings]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timerId = globalThis.setTimeout(() => {
      setSaveState("idle");
    }, 2000);

    return () => {
      globalThis.clearTimeout(timerId);
    };
  }, [saveState]);

  const canInstallPwa = useMemo(() => {
    if (isPwaStandalone()) return false;
    return Boolean(deferredPrompt);
  }, [deferredPrompt]);

  const canAccessBookmarks = hasRole(["admin", "superadmin"]);

  const installHelpText = useMemo(() => {
    if (isPwaStandalone()) {
      return "التطبيق مثبت ويعمل كوضع مستقل.";
    }

    if (installState === "installed") {
      return "تم تثبيت التطبيق بنجاح.";
    }

    if (installState === "dismissed") {
      return "تم تجاهل طلب التثبيت، يمكنك المحاولة لاحقاً.";
    }

    return "إذا كان التثبيت غير متاح، افتح الموقع من متصفح يدعم التثبيت ثم أعد المحاولة.";
  }, [installState]);

  const hasPendingChanges = useMemo(() => {
    return (
      draft.fontSize !== currentSettings.fontSize
      || draft.themeMode !== currentSettings.themeMode
      || draft.contrastMode !== currentSettings.contrastMode
      || draft.showSources !== currentSettings.showSources
      || draft.speakReplies !== currentSettings.speakReplies
      || draft.dictationEnabled !== currentSettings.dictationEnabled
    );
  }, [currentSettings, draft]);

  function updateDraft<Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) {
    setSaveState("idle");
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSaveSettings() {
    setFontSize(draft.fontSize);
    setThemeMode(draft.themeMode);
    setContrastMode(draft.contrastMode);
    setShowSources(draft.showSources);
    setSpeakReplies(draft.speakReplies);
    setDictationEnabled(draft.dictationEnabled);
    setSaveState("saved");
  }

  function handleCancelChanges() {
    setDraft(currentSettings);
    setSaveState("idle");
  }

  function handleResetDefaults() {
    setDraft({
      fontSize: "normal",
      themeMode: "system",
      contrastMode: "normal",
      showSources: true,
      speakReplies: true,
      dictationEnabled: false,
    });
    setSaveState("idle");
  }

  async function handleInstallPwa() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setInstallState(choice.outcome === "accepted" ? "installed" : "dismissed");
    setDeferredPrompt(null);
  }

  function handleAvatarFileChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setAvatarDataUrl(result);
      setAvatarFileName(file.name);
      localStorage.setItem("watany_user_avatar_data_url", result);
      localStorage.setItem("watany_user_avatar_file_name", file.name);
    };
    reader.readAsDataURL(file);
  }

  function clearAvatar() {
    setAvatarDataUrl("");
    setAvatarFileName("");
    localStorage.removeItem("watany_user_avatar_data_url");
    localStorage.removeItem("watany_user_avatar_file_name");
  }

  return (
    <div className="settings-page" dir="rtl">
      <section className="settings-card">
        <div className="settings-card__header">
          <h2>إعدادات الحساب</h2>
          <p>إعدادات خاصة بالمستخدم المسجّل تشمل العرض، المفضلات، والتثبيت.</p>
        </div>

        <div className="settings-grid">
          <article className="settings-block">
            <h3><TextFont24Regular aria-hidden /> حجم الخط</h3>
            <div className="settings-chip-row">
              {FONT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`settings-chip ${draft.fontSize === option.value ? "is-active" : ""}`}
                  onClick={() => updateDraft("fontSize", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </article>

          <article className="settings-block">
            <h3><Bookmark24Regular aria-hidden /> المفضلة والمحفوظات</h3>
            <div className="settings-links">
              {canAccessBookmarks ? <Link to="/bookmarks" className="settings-link">فتح المفضّلة</Link> : null}
              <Link to="/saved" className="settings-link">فتح المحفوظات</Link>
            </div>
          </article>

          <article className="settings-block">
            <h3><Desktop24Regular aria-hidden /> تثبيت التطبيق (PWA)</h3>
            <div className="settings-actions-row">
              <button type="button" className="settings-btn" onClick={handleInstallPwa} disabled={!canInstallPwa}>
                تثبيت التطبيق
              </button>
              <button type="button" className="settings-btn settings-btn--secondary" onClick={toggleFullscreen}>
                <FullScreenMaximize24Regular aria-hidden /> ملء الشاشة
              </button>
            </div>
            <p className="settings-help">{installHelpText}</p>
          </article>

          <article className="settings-block">
            <h3><Image24Regular aria-hidden /> صورة المستخدم</h3>
            <div className="settings-avatar-row">
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt="صورة المستخدم" className="settings-avatar" />
              ) : (
                <div className="settings-avatar settings-avatar--placeholder" aria-hidden>{(profile.name || "و").charAt(0)}</div>
              )}
              <div className="settings-avatar-meta">
                <label className="settings-upload-label">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAvatarFileChange(e.target.files?.[0] || null)}
                  />
                  <span>اختيار صورة</span>
                </label>
                {avatarFileName ? <span className="settings-file-name">{avatarFileName}</span> : null}
                {avatarDataUrl ? (
                  <button type="button" className="settings-link-btn" onClick={clearAvatar}>إزالة الصورة</button>
                ) : null}
              </div>
            </div>
          </article>
          <article className="settings-block">
            <h3><AppsList24Regular aria-hidden /> تفضيلات إضافية</h3>
            <div className="settings-toggles">
              <label>
                <input type="checkbox" checked={draft.showSources} onChange={(e) => updateDraft("showSources", e.target.checked)} />
                <span>إظهار المصادر</span>
              </label>
              <label>
                <input type="checkbox" checked={draft.speakReplies} onChange={(e) => updateDraft("speakReplies", e.target.checked)} />
                <span>قراءة الردود صوتياً</span>
              </label>
              <label>
                <input type="checkbox" checked={draft.dictationEnabled} onChange={(e) => updateDraft("dictationEnabled", e.target.checked)} />
                <span>تفعيل الإملاء الصوتي</span>
              </label>
              <label>
                <span>المظهر</span>
                <select value={draft.themeMode} onChange={(e) => updateDraft("themeMode", e.target.value as "system" | "light" | "dark")}>
                  <option value="system">تلقائي</option>
                  <option value="light">فاتح</option>
                  <option value="dark">داكن</option>
                </select>
              </label>
              <label>
                <span>التباين</span>
                <select value={draft.contrastMode} onChange={(e) => updateDraft("contrastMode", e.target.value as "normal" | "high")}>
                  <option value="normal">عادي</option>
                  <option value="high">عالٍ</option>
                </select>
              </label>
            </div>
          </article>
        </div>

        <section className="settings-quick-tools" aria-label="أدوات سريعة">
          {SETTINGS_QUICK_TOOL_ITEMS.map((item) => (
            <WatanyAppIcon key={item.id} item={item} />
          ))}
        </section>

        <div className="settings-footer">
          <button
            type="button"
            className="settings-btn settings-btn--ghost"
            onClick={handleCancelChanges}
            disabled={!hasPendingChanges}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="settings-btn settings-btn--ghost"
            onClick={handleResetDefaults}
          >
            إعادة تعيين
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={handleSaveSettings}
            disabled={!hasPendingChanges}
          >
            حفظ
          </button>
        </div>
        {saveState === "saved" ? <p className="settings-save-state">تم تطبيق الإعدادات الجديدة.</p> : null}
      </section>
    </div>
  );
}
function SettingsPageUnifiedTemplatePage() {
  return (
    <WatanyFeatureTemplate
      title="Settings"
      description="Manage app preferences and account options."
      category="profile"
    >
      <div data-watany-template-batch="v1.4.3">
        <SettingsPageTemplateContent />
      </div>
    </WatanyFeatureTemplate>
  );
}

export default SettingsPageUnifiedTemplatePage;


