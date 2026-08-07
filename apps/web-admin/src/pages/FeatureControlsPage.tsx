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
        <h2>Feature Controls</h2>
        <p className="muted">Global switches for the public web-user application. Changes only go live after save.</p>
      </div>

      <div className="feature-overview card">
        <div>
          <div className="eyebrow">Web User Controls</div>
          <div className="feature-overview__title">{enabledCount} / {FEATURES.length} features enabled</div>
          <p className="muted">Last saved: {lastSavedLabel}</p>
          <p className="muted">This panel is independent from the public app and controls what end users can see and use.</p>
        </div>
        <div className="feature-overview__actions">
          <button className="ghost" onClick={handleReset} disabled={saving}>Reset Locally</button>
          <button className="accent" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Publish to Web User"}
          </button>
        </div>
      </div>

      {message ? <div className="feature-banner feature-banner--ok">{message}</div> : null}
      {error ? <div className="feature-banner feature-banner--error">{error}</div> : null}

      {loading ? (
        <div className="page-loading">Loading feature controls...</div>
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
                    <button className="ghost sm" onClick={() => toggleAll(group.features, true)}>Enable All</button>
                    <button className="ghost sm" onClick={() => toggleAll(group.features, false)}>Disable All</button>
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
          <span className="feature-save-bar__label">Warning: Unsaved changes - publish to apply</span>
          <div className="feature-save-bar__actions">
            <button className="ghost sm" onClick={discardChanges} disabled={saving}>
              Discard
            </button>
            <button className="accent" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save & Publish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}