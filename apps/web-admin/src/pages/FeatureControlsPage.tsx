import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  FEATURES,
  defaultFeatureFlags,
  type FeatureCategory,
  type FeatureId,
  type FeatureMeta,
} from "@watany/shared/features";
import { getAdminErrorMessage, getFeatureFlags, saveFeatureFlags } from "../lib/api";
import { AdminFluentIcon } from "../components/AdminFluentIcon";
import { AdminConfirmDialog } from "../components/admin/AdminPrimitives";

const CATEGORIES: FeatureCategory[] = ["core", "services", "communication"];

function FeatureRow({
  feature,
  enabled,
  onToggle,
}: Readonly<{
  feature: FeatureMeta;
  enabled: boolean;
  onToggle: () => void;
}>) {
  const lockedClassName = feature.canDisable ? "" : " is-locked";
  const offClassName = enabled ? "" : " is-off";

  return (
    <div className={`feature-row${offClassName}${lockedClassName}`}>
      <div className="feature-row__icon">
        <AdminFluentIcon name={feature.icon} />
      </div>
      <div className="feature-row__body">
        <div className="feature-row__title">{feature.label}</div>
        <div className="feature-row__desc">{feature.desc}</div>
      </div>
      <label className="feature-switch" aria-label={`Toggle ${feature.label}`}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!feature.canDisable}
          onChange={onToggle}
        />
        <span className="feature-switch__track">
          <span className="feature-switch__thumb" />
        </span>
      </label>
    </div>
  );
}

export default function FeatureControlsPage() {
  const [flags, setFlags] = useState<Record<FeatureId, boolean>>(defaultFeatureFlags);
  const [savedFlags, setSavedFlags] = useState<Record<FeatureId, boolean>>(defaultFeatureFlags);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingBroadAction, setPendingBroadAction] = useState<{ label: string; message: string; run: () => void } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const remote = await getFeatureFlags();
        if (!isMounted) return;
        const next = { ...defaultFeatureFlags(), ...remote.flags } as Record<FeatureId, boolean>;
        setFlags(next);
        setSavedFlags(next);
        setLastSavedAt(remote.lastUpdatedAt);
      } catch (error) {
        if (!isMounted) return;
        setError(getAdminErrorMessage(error, "تعذر تحميل إعدادات الميزات الحالية."));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      features: FEATURES.filter((feature) => feature.category === category),
    }));
  }, []);

  const enabledCount = useMemo(() => {
    return Object.values(flags).filter(Boolean).length;
  }, [flags]);

  const hasPendingChanges = useMemo(
    () => FEATURES.some((feature) => flags[feature.id] !== savedFlags[feature.id]),
    [flags, savedFlags],
  );

  function setFlag(featureId: FeatureId, value: boolean) {
    setFlags((prev) => ({ ...prev, [featureId]: value }));
    setMessage(null);
    setError(null);
  }

  function toggleAll(features: FeatureMeta[], enabled: boolean) {
    setFlags((prev) => {
      const next = { ...prev };
      for (const feature of features) {
        if (feature.canDisable) {
          next[feature.id] = enabled;
        }
      }
      return next;
    });
    setMessage(null);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const next = await saveFeatureFlags(flags);
      const resolved = { ...defaultFeatureFlags(), ...next.flags } as Record<FeatureId, boolean>;
      setFlags(resolved);
      setSavedFlags(resolved);
      setLastSavedAt(next.lastUpdatedAt);
      setMessage("تم نشر إعدادات الميزات لجميع مستخدمي التطبيق.");
    } catch (error) {
      setError(getAdminErrorMessage(error, "فشل حفظ الإعدادات."));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setFlags(defaultFeatureFlags());
    setMessage("تمت إعادة القيم محلياً. اضغط حفظ لنشرها.");
    setError(null);
  }

  function discardChanges() {
    setFlags(savedFlags);
    setMessage(null);
    setError(null);
  }

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) return "Not saved yet";

    try {
      return new Date(lastSavedAt).toLocaleString();
    } catch {
      return lastSavedAt;
    }
  }, [lastSavedAt]);

  return (
    <div className="feature-page">
      <div className="page-header">
        <h2>التحكم بالميزات</h2>
        <p className="muted">مفاتيح عامة لتطبيق المستخدم. لا تصبح التغييرات نافذة إلا بعد الحفظ.</p>
      </div>

      <div className="feature-overview card">
        <div>
          <div className="eyebrow">ضوابط المستخدم</div>
          <div className="feature-overview__title">{enabledCount} / {FEATURES.length} ميزات مفعّلة</div>
          <p className="muted">آخر حفظ: {lastSavedLabel}</p>
          <p className="muted">هذه اللوحة مستقلة عن التطبيق العام وتتحكم بما يمكن للمستخدمين رؤيته واستعماله.</p>
        </div>
        <div className="feature-overview__actions">
          <button className="ghost" onClick={() => setPendingBroadAction({ label: "إعادة الضبط محلياً", message: "استعادة جميع الضوابط إلى قيمها المحلية الافتراضية. لا يُنشر شيء قبل الحفظ والنشر.", run: handleReset })} disabled={saving}>إعادة الضبط محلياً</button>
          <button className="accent" onClick={handleSave} disabled={saving || loading}>
            {saving ? "جارٍ الحفظ..." : "نشر للمستخدم"}
          </button>
        </div>
      </div>

      {message ? <div className="feature-banner feature-banner--ok">{message}</div> : null}
      {error ? <div className="feature-banner feature-banner--error">{error}</div> : null}

      {loading ? (
        <div className="page-loading">جارٍ تحميل ضوابط الميزات...</div>
      ) : (
        <div className="feature-groups">
          {grouped.map((group) => {
            const groupEnabled = group.features.filter((feature) => flags[feature.id]).length;

            return (
              <section key={group.category} className="feature-group card">
                <div className="feature-group__header">
                  <div>
                    <h3>{group.label}</h3>
                    <p className="muted">{groupEnabled} / {group.features.length} enabled</p>
                  </div>
                  <div className="feature-group__actions">
                    <button className="ghost sm" onClick={() => setPendingBroadAction({ label: `تفعيل كل ميزات ${group.label}`, message: `تغيير كل ميزة قابلة للفتح في ${group.label} محلياً. تبقى الميزات المقفلة دون تغيير ولا يُنشر شيء بعد.`, run: () => toggleAll(group.features, true) })}>تفعيل الكل</button>
                    <button className="ghost sm" onClick={() => setPendingBroadAction({ label: `تعطيل كل ميزات ${group.label}`, message: `تغيير كل ميزة قابلة للفتح في ${group.label} محلياً. تبقى الميزات المقفلة دون تغيير ولا يُنشر شيء بعد.`, run: () => toggleAll(group.features, false) })}>تعطيل الكل</button>
                  </div>
                </div>

                <div className="feature-group__list">
                  {group.features.map((feature) => (
                    <FeatureRow
                      key={feature.id}
                      feature={feature}
                      enabled={flags[feature.id]}
                      onToggle={() => setFlag(feature.id, !flags[feature.id])}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {hasPendingChanges && (
        <div className="feature-save-bar">
          <span className="feature-save-bar__label">تنبيه: تغييرات غير محفوظة، انشر لتطبيقها</span>
          <div className="feature-save-bar__actions">
            <button className="ghost sm" onClick={discardChanges} disabled={saving}>
              تجاهل التغييرات
            </button>
            <button className="accent" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save & Publish"}
            </button>
          </div>
        </div>
      )}
      {pendingBroadAction ? <AdminConfirmDialog title={pendingBroadAction.label} message={pendingBroadAction.message} confirmLabel="تطبيق محلياً" onCancel={() => setPendingBroadAction(null)} onConfirm={() => { pendingBroadAction.run(); setPendingBroadAction(null); }} /> : null}
    </div>
  );
}