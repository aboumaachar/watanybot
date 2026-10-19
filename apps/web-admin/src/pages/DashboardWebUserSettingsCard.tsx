import { useEffect, useMemo, useState } from "react";
import {
  defaultPublishedWebUserSettings,
  type PublishedWebUserSettings,
  WEB_USER_CHANNELS,
  WEB_USER_CONTRAST_MODES,
  WEB_USER_FONT_SIZES,
  WEB_USER_LAYOUT_MODES,
  WEB_USER_NAV_STYLES,
  WEB_USER_THEME_MODES,
  WEB_USER_VISUAL_THEMES,
} from "@watany/shared/web-user-settings";
import {
  getAdminErrorMessage,
  getWebUserSettings,
  saveWebUserSettings,
} from "../lib/api";

const FIELD_STYLE: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const INPUT_STYLE: React.CSSProperties = {
  border: "1px solid var(--stroke)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "rgba(15, 23, 42, 0.04)",
  color: "inherit",
};

function SelectField({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}>) {
  return (
    <label style={FIELD_STYLE}>
      <span className="muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={INPUT_STYLE}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: Readonly<{
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}>) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--stroke)", borderRadius: 10 }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function DashboardWebUserSettingsCard() {
  const [settings, setSettings] = useState<PublishedWebUserSettings>(defaultPublishedWebUserSettings);
  const [savedSettings, setSavedSettings] = useState<PublishedWebUserSettings>(defaultPublishedWebUserSettings);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPublishedSettings() {
      setLoading(true);
      setError("");
      try {
        const payload = await getWebUserSettings();
        if (!active) return;
        setSettings(payload.settings);
        setSavedSettings(payload.settings);
        setLastSavedAt(payload.lastUpdatedAt);
      } catch (loadError) {
        if (!active) return;
        setError(getAdminErrorMessage(loadError, "Failed to load web-user settings."));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPublishedSettings();
    return () => {
      active = false;
    };
  }, []);

  const hasPendingChanges = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) return "لم يُحفظ بعد";

    try {
      return new Date(lastSavedAt).toLocaleString();
    } catch {
      return lastSavedAt;
    }
  }, [lastSavedAt]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const persisted = await saveWebUserSettings(settings);
      setSettings(persisted.settings);
      setSavedSettings(persisted.settings);
      setLastSavedAt(persisted.lastUpdatedAt);
      setMessage("Web-user component settings were published successfully.");
    } catch (saveError) {
      setError(getAdminErrorMessage(saveError, "Saving web-user settings failed."));
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof PublishedWebUserSettings>(key: K, value: PublishedWebUserSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setMessage("");
    setError("");
  }

  return (
    <div className="card span-12">
      <div className="section-head">
        <div>
          <h3>إعدادات مكونات المستخدم</h3>
          <p className="muted">انشر الإعدادات العامة الافتراضية لقشرة التطبيق وضوابط المحادثة وقوالب التصميم.</p>
        </div>
        <div className="pill">آخر حفظ: {lastSavedLabel}</div>
      </div>

      <div className="feature-overview" style={{ marginTop: 12 }}>
        <div>
          <div className="eyebrow">الإعدادات الافتراضية المنشورة</div>
          <div className="feature-overview__title">
            {hasPendingChanges ? "تغييرات إعدادات المكونات معلقة" : "الإعدادات الافتراضية المنشورة متزامنة"}
          </div>
          <p className="muted">يجلب تطبيق المستخدم هذه القيم عند بدء التشغيل ويطبقها على إعدادات مكوناته الحالية.</p>
        </div>
        <div className="feature-overview__actions">
          <button className="ghost" onClick={() => { setSettings(savedSettings); setMessage("تم تجاهل تغييرات إعدادات المكونات غير المحفوظة."); setError(""); }} disabled={!hasPendingChanges || loading || saving}>
            تجاهل التغييرات
          </button>
          <button className="accent" onClick={handleSave} disabled={!hasPendingChanges || loading || saving}>
            {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </button>
        </div>
      </div>

      {message ? <div className="feature-banner feature-banner--ok">{message}</div> : null}
      {error ? <div className="feature-banner feature-banner--error">{error}</div> : null}

      {loading ? (
        <div className="page-loading">جارٍ تحميل إعدادات المستخدم...</div>
      ) : (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <section className="feature-group">
            <div className="feature-group__header">
              <div>
                <h3>المظهر</h3>
                <p className="muted">ضوابط السمة والتباين والخط المستخدمة في واجهة المستخدم.</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <SelectField label="Theme mode" value={settings.themeMode} options={WEB_USER_THEME_MODES} onChange={(value) => update("themeMode", value as PublishedWebUserSettings["themeMode"])} />
              <SelectField label="Contrast mode" value={settings.contrastMode} options={WEB_USER_CONTRAST_MODES} onChange={(value) => update("contrastMode", value as PublishedWebUserSettings["contrastMode"])} />
              <SelectField label="Font size" value={settings.fontSize} options={WEB_USER_FONT_SIZES} onChange={(value) => update("fontSize", value as PublishedWebUserSettings["fontSize"])} />
            </div>
          </section>

          <section className="feature-group">
            <div className="feature-group__header">
              <div>
                <h3>سلوك المحادثة</h3>
                <p className="muted">الإعدادات الافتراضية لظهور المصادر وسلوك الصوت ووضع القناة الأولي.</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <CheckboxField label="Show answer sources" checked={settings.showSources} onChange={(value) => update("showSources", value)} />
              <CheckboxField label="Enable speak replies" checked={settings.speakReplies} onChange={(value) => update("speakReplies", value)} />
              <CheckboxField label="Enable dictation" checked={settings.dictationEnabled} onChange={(value) => update("dictationEnabled", value)} />
              <SelectField label="Default channel" value={settings.channel} options={WEB_USER_CHANNELS} onChange={(value) => update("channel", value as PublishedWebUserSettings["channel"])} />
            </div>
          </section>

          <section className="feature-group">
            <div className="feature-group__header">
              <div>
                <h3>قالب التصميم</h3>
                <p className="muted">قيم السمة والتخطيط والتنقل نفسها المستخدمة في محدد التصميم العام.</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <SelectField label="Visual theme" value={settings.design.theme} options={WEB_USER_VISUAL_THEMES} onChange={(value) => update("design", { ...settings.design, theme: value as PublishedWebUserSettings["design"]["theme"] })} />
              <SelectField label="Layout mode" value={settings.design.layout} options={WEB_USER_LAYOUT_MODES} onChange={(value) => update("design", { ...settings.design, layout: value as PublishedWebUserSettings["design"]["layout"] })} />
              <SelectField label="Navigation style" value={settings.design.nav} options={WEB_USER_NAV_STYLES} onChange={(value) => update("design", { ...settings.design, nav: value as PublishedWebUserSettings["design"]["nav"] })} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}