import { useEffect, useMemo, useState } from "react";
import {
  api,
  type OfficialService,
  type OfficialServiceHealthResponse,
  type OfficialServiceMode,
} from "../../lib/api";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../../pages/official-services.css";

type OfficialServicesAdminPanelProps = {
  apiBaseUrl: string;
};

type DraftState = {
  sourceUrl: string;
  fallbackMessageAr: string;
  mode: OfficialServiceMode;
  externalOnly: boolean;
};

const MODE_OPTIONS: Array<{ value: OfficialServiceMode; label: string }> = [
  { value: "LOCAL_FORM_BRIDGE", label: "استعلام مباشر داخل موطني" },
  { value: "SECURE_EXTERNAL_PORTAL", label: "بوابة رسمية آمنة" },
  { value: "LOCAL_GUIDE_AND_DOWNLOADS", label: "دليل وروابط رسمية" },
  { value: "PENDING_URL_VALIDATION", label: "قيد التحقق" },
  { value: "EXISTING_LOCAL", label: "خدمة محلية" },
];

function buildDrafts(items: OfficialService[]): Record<string, DraftState> {
  return Object.fromEntries(items.map((service) => [
    service.id,
    {
      sourceUrl: service.sourceUrl,
      fallbackMessageAr: service.fallbackMessageAr || "",
      mode: service.mode,
      externalOnly: service.externalOnly ?? false,
    },
  ]));
}

export default function OfficialServicesAdminPanel({ apiBaseUrl }: Readonly<OfficialServicesAdminPanelProps>) {
  const [services, setServices] = useState<OfficialService[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [healthMap, setHealthMap] = useState<Record<string, OfficialServiceHealthResponse | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stats = useMemo(() => {
    return {
      total: services.length,
      enabled: services.filter((service) => service.enabled).length,
      pending: services.filter((service) => service.mode === "PENDING_URL_VALIDATION").length,
      unhealthy: services.filter((service) => service.lastHealthOk === false).length,
    };
  }, [services]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = globalThis.setTimeout(() => setNotice(null), 3200);
    return () => globalThis.clearTimeout(timer);
  }, [notice]);

  async function loadServices() {
    setLoading(true);
    setError(null);

    try {
      const items = await api.listAdminOfficialServices(apiBaseUrl);
      setServices(items);
      setDrafts(buildDrafts(items));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحميل إدارة الخدمات الرسمية");
      setServices([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }

  // loadServices intentionally not included in deps; stable for this effect
  useEffect(() => {
    void loadServices();
  }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateDraft(serviceId: string, patch: Partial<DraftState>) {
    setDrafts((current) => ({
      ...current,
      [serviceId]: {
        ...(current[serviceId] || { sourceUrl: "", fallbackMessageAr: "", mode: "PENDING_URL_VALIDATION", externalOnly: false }),
        ...patch,
      },
    }));
  }

  async function handleToggle(service: OfficialService) {
    setBusyKey(`toggle:${service.id}`);
    setError(null);

    try {
      await api.updateAdminOfficialService(service.id, { enabled: !service.enabled }, apiBaseUrl);
      setNotice(service.enabled ? "تم تعطيل الخدمة." : "تم تفعيل الخدمة.");
      await loadServices();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحديث حالة الخدمة");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSave(service: OfficialService) {
    const draft = drafts[service.id];
    if (!draft) return;

    setBusyKey(`save:${service.id}`);
    setError(null);

    try {
      await api.updateAdminOfficialService(service.id, {
        sourceUrl: draft.sourceUrl.trim(),
        fallbackMessageAr: draft.fallbackMessageAr.trim(),
        mode: draft.mode,
        externalOnly: draft.externalOnly,
      }, apiBaseUrl);
      setNotice("تم حفظ إعدادات الخدمة الرسمية.");
      await loadServices();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حفظ إعدادات الخدمة");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleHealthCheck(service: OfficialService) {
    setBusyKey(`health:${service.id}`);
    setError(null);

    try {
      const health = await api.checkOfficialServiceHealth(service.id, apiBaseUrl);
      setHealthMap((current) => ({ ...current, [service.id]: health }));
      setNotice(health.reachable ? "الرابط الرسمي متاح حالياً." : "الرابط الرسمي لا يستجيب حالياً.");
      await loadServices();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تنفيذ فحص الرابط الرسمي");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="official-admin-panel">
      <section className="official-admin-card">
        <div className="official-admin-header">
          <div>
            <h2>إدارة الخدمات الرسمية السريعة</h2>
            <p>بدّل الحالة، حدّث الرابط الرسمي، غيّر نمط العرض، ونفّذ فحص صحة مباشر من داخل لوحة الإدارة.</p>
          </div>
          <button className="official-admin-btn official-admin-btn--ghost wt-cta-glow" type="button" onClick={() => void loadServices()}>
            إعادة التحميل
          </button>
        </div>
        <div className="official-admin-stats">
          <div className="official-admin-stat">
            <strong>إجمالي الخدمات</strong>
            <span>{stats.total}</span>
          </div>
          <div className="official-admin-stat">
            <strong>المفعلة</strong>
            <span>{stats.enabled}</span>
          </div>
          <div className="official-admin-stat">
            <strong>قيد التحقق</strong>
            <span>{stats.pending}</span>
          </div>
          <div className="official-admin-stat">
            <strong>بحاجة متابعة</strong>
            <span>{stats.unhealthy}</span>
          </div>
        </div>
      </section>

      {loading ? <div className="official-info">جارٍ تحميل إدارة الخدمات الرسمية...</div> : null}
      {error ? <div className="official-alert">{error}</div> : null}
      {notice ? <div className="official-info">{notice}</div> : null}

      <section className="official-admin-grid">
        {services.map((service) => {
          const draft = drafts[service.id];
          const health = healthMap[service.id];
          const isBusy = busyKey?.includes(service.id);

          return (
            <article className="official-admin-card" key={service.id}>
              <div className="official-admin-card-head">
                <div>
                  <div className="official-inline-meta">
                    <span className="official-inline-pill">الخدمة {service.listingNo}</span>
                    <span className={`official-inline-pill${service.enabled ? " official-inline-pill--ok" : " official-inline-pill--warn"}`}>
                      {service.enabled ? "مفعلة" : "معطلة"}
                    </span>
                  </div>
                  <h3>{service.titleAr}</h3>
                </div>
                <span className="official-inline-pill">{service.providerAr}</span>
              </div>

              <p>{service.summaryAr}</p>

              <div className="official-admin-form-grid">
                <div className="official-field">
                  <label htmlFor={`${service.id}-url`}>الرابط الرسمي</label>
                  <input
                    id={`${service.id}-url`}
                    type="url"
                    value={draft?.sourceUrl || ""}
                    onChange={(event) => updateDraft(service.id, { sourceUrl: event.target.value })}
                    disabled={isBusy}
                  />
                </div>

                <div className="official-field">
                  <label htmlFor={`${service.id}-mode`}>نمط الخدمة</label>
                  <select
                    id={`${service.id}-mode`}
                    value={draft?.mode || service.mode}
                    onChange={(event) => updateDraft(service.id, { mode: event.target.value as OfficialServiceMode })}
                    disabled={isBusy}
                  >
                    {MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="official-field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor={`${service.id}-fallback`}>رسالة المتابعة / التعذر</label>
                  <input
                    id={`${service.id}-fallback`}
                    type="text"
                    value={draft?.fallbackMessageAr || ""}
                    onChange={(event) => updateDraft(service.id, { fallbackMessageAr: event.target.value })}
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className="official-admin-toggle">
                <label htmlFor={`${service.id}-enabled`}>
                  <input
                    id={`${service.id}-enabled`}
                    type="checkbox"
                    checked={service.enabled}
                    onChange={() => void handleToggle(service)}
                    disabled={isBusy}
                  />
                  <span>تفعيل الخدمة داخل موطني</span>
                </label>
                <span className="official-muted">آخر فحص: {health?.lastCheckedAt || service.lastCheckedAt || "غير متاح"}</span>
              </div>

              <div className="official-admin-toggle">
                <label htmlFor={`${service.id}-external-only`}>
                  <input
                    id={`${service.id}-external-only`}
                    type="checkbox"
                    checked={draft?.externalOnly ?? service.externalOnly ?? false}
                    onChange={(event) => updateDraft(service.id, { externalOnly: event.target.checked })}
                    disabled={isBusy}
                  />
                  <span>استخدام الرابط الخارجي فقط</span>
                </label>
                <span className="official-muted">يعطّل المعاينة أو النماذج داخل موطني ويُبقي الوصول عبر الرابط الرسمي فقط.</span>
              </div>

              <div className="official-status-grid">
                <div className="official-status-card">
                  <strong>آخر رمز حالة</strong>
                  <span>{health?.statusCode ?? service.lastStatusCode ?? "غير متاح"}</span>
                </div>
                <div className="official-status-card">
                  <strong>حالة الوصول</strong>
                  <span>{(health?.reachable ?? service.lastHealthOk) ? "متاح" : "بحاجة متابعة"}</span>
                </div>
                <div className="official-status-card">
                  <strong>المدخلات</strong>
                  <span>{service.storeInputs ? "قد تحفظ" : "لا تحفظ"}</span>
                </div>
              </div>

              {service.knownIssuesAr?.length ? (
                <ul>
                  {service.knownIssuesAr.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              ) : null}

              <div className="official-admin-actions">
                <button className="official-admin-btn wt-cta-glow wt-cta-processing" type="button" onClick={() => void handleSave(service)} disabled={isBusy} aria-busy={isBusy}>
                  حفظ التعديلات
                </button>
                <button className="official-admin-btn official-admin-btn--ghost wt-cta-glow wt-cta-processing" type="button" onClick={() => void handleHealthCheck(service)} disabled={isBusy} aria-busy={isBusy}>
                  فحص الرابط الآن
                </button>
                <a className="official-link-btn" href={draft?.sourceUrl || service.sourceUrl} target="_blank" rel="noreferrer">
                  فتح الرابط
                </a>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
