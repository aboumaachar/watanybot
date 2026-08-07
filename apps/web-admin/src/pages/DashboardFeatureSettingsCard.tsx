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

const FEATURE_CATEGORIES: FeatureCategory[] = ["core", "services", "communication"];

function FeatureFlagRow({
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

export default function DashboardFeatureSettingsCard() {
  const [featureFlags, setFeatureFlags] = useState<Record<FeatureId, boolean>>(defaultFeatureFlags);
  const [savedFeatureFlags, setSavedFeatureFlags] = useState<Record<FeatureId, boolean>>(defaultFeatureFlags);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [featureLoading, setFeatureLoading] = useState(true);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [featureMessage, setFeatureMessage] = useState("");
  const [featureError, setFeatureError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPublishedFeatures() {
      setFeatureLoading(true);
      setFeatureError("");
      try {
        const remote = await getFeatureFlags();
        if (!active) return;
        const next = { ...defaultFeatureFlags(), ...remote.flags } as Record<FeatureId, boolean>;
        setFeatureFlags(next);
        setSavedFeatureFlags(next);
        setLastSavedAt(remote.lastUpdatedAt);
      } catch (error) {
        if (!active) return;
        setFeatureError(getAdminErrorMessage(error, "Failed to load published feature settings."));
      } finally {
        if (active) setFeatureLoading(false);
      }
    }

    void loadPublishedFeatures();

    return () => {
      active = false;
    };
  }, []);

  const featureGroups = useMemo(
    () =>
      FEATURE_CATEGORIES.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        features: FEATURES.filter((feature) => feature.category === category),
      })),
    []
  );

  const enabledFeatureCount = useMemo(
    () => Object.values(featureFlags).filter(Boolean).length,
    [featureFlags]
  );

  const hasPendingFeatureChanges = useMemo(
    () => FEATURES.some((feature) => featureFlags[feature.id] !== savedFeatureFlags[feature.id]),
    [featureFlags, savedFeatureFlags]
  );

  function setDashboardFeatureFlag(featureId: FeatureId, value: boolean) {
    setFeatureFlags((prev) => ({ ...prev, [featureId]: value }));
    setFeatureMessage("");
    setFeatureError("");
  }

  function setDashboardFeatureGroup(features: FeatureMeta[], enabled: boolean) {
    setFeatureFlags((prev) => {
      const next = { ...prev };
      for (const feature of features) {
        if (feature.canDisable) {
          next[feature.id] = enabled;
        }
      }
      return next;
    });
    setFeatureMessage("");
    setFeatureError("");
  }

  async function saveDashboardFeatureFlags() {
    setFeatureSaving(true);
    setFeatureMessage("");
    setFeatureError("");

    try {
      const persisted = await saveFeatureFlags(featureFlags);
      const next = { ...defaultFeatureFlags(), ...persisted.flags } as Record<FeatureId, boolean>;
      setFeatureFlags(next);
      setSavedFeatureFlags(next);
      setLastSavedAt(persisted.lastUpdatedAt);
      setFeatureMessage("Feature settings were saved and propagated to the web-user app.");
    } catch (error) {
      setFeatureError(getAdminErrorMessage(error, "Saving feature settings failed."));
    } finally {
      setFeatureSaving(false);
    }
  }

  function discardDashboardFeatureChanges() {
    setFeatureFlags(savedFeatureFlags);
    setFeatureMessage("Unsaved dashboard feature changes were discarded.");
    setFeatureError("");
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
    <div className="card span-12">
      <div className="section-head">
        <div>
          <h3>Feature Propagation</h3>
          <p className="muted">Admin-selected feature settings stay pending until saved, then propagate to the web-user experience.</p>
        </div>
        <div className="pill">{enabledFeatureCount} / {FEATURES.length} enabled</div>
      </div>

      <div className="feature-overview" style={{ marginTop: 12 }}>
        <div>
          <div className="eyebrow">Published Controls</div>
          <div className="feature-overview__title">
            {hasPendingFeatureChanges ? "Pending admin changes" : "Published settings are in sync"}
          </div>
          <p className="muted">Last saved: {lastSavedLabel}</p>
          <p className="muted">
            Use Save Settings to enforce the feature selections chosen here across the user-facing application.
          </p>
        </div>
        <div className="feature-overview__actions">
          <button className="ghost" onClick={discardDashboardFeatureChanges} disabled={!hasPendingFeatureChanges || featureSaving || featureLoading}>
            Discard Changes
          </button>
          <button className="accent" onClick={saveDashboardFeatureFlags} disabled={!hasPendingFeatureChanges || featureSaving || featureLoading}>
            {featureSaving ? "Savingâ€¦" : "Save Settings"}
          </button>
        </div>
      </div>

      {featureMessage ? <div className="feature-banner feature-banner--ok">{featureMessage}</div> : null}
      {featureError ? <div className="feature-banner feature-banner--error">{featureError}</div> : null}

      {featureLoading ? (
        <div className="page-loading">Loading feature settingsâ€¦</div>
      ) : (
        <div className="feature-groups" style={{ marginTop: 16 }}>
          {featureGroups.map((group) => {
            const groupEnabledCount = group.features.filter((feature) => featureFlags[feature.id]).length;

            return (
              <section key={group.category} className="feature-group">
                <div className="feature-group__header">
                  <div>
                    <h3>{group.label}</h3>
                    <p className="muted">{groupEnabledCount} / {group.features.length} enabled</p>
                  </div>
                  <div className="feature-group__actions">
                    <button className="ghost sm" onClick={() => setDashboardFeatureGroup(group.features, true)} disabled={featureSaving}>
                      Enable All
                    </button>
                    <button className="ghost sm" onClick={() => setDashboardFeatureGroup(group.features, false)} disabled={featureSaving}>
                      Disable All
                    </button>
                  </div>
                </div>

                <div className="feature-group__list">
                  {group.features.map((feature) => (
                    <FeatureFlagRow
                      key={feature.id}
                      feature={feature}
                      enabled={featureFlags[feature.id]}
                      onToggle={() => setDashboardFeatureFlag(feature.id, !featureFlags[feature.id])}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {hasPendingFeatureChanges && (
        <div className="feature-save-bar">
          <span className="feature-save-bar__label">âš  Unsaved changes â€” publish to apply</span>
          <div className="feature-save-bar__actions">
            <button className="ghost sm" onClick={discardDashboardFeatureChanges} disabled={featureSaving}>
              Discard
            </button>
            <button className="accent" onClick={saveDashboardFeatureFlags} disabled={featureSaving}>
              {featureSaving ? "Savingâ€¦" : "Save & Publish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}