import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type OfficialService,
  type OfficialServiceMode,
  type OfficialServiceQueryError,
  type OfficialServiceQueryResponse,
} from "../lib/api";
import { useApp } from "../store/app";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./official-services.css";

const MODE_LABELS: Record<OfficialServiceMode, string> = {
  EXISTING_LOCAL: "خدمة محلية",
  LOCAL_FORM_BRIDGE: "استعلام مباشر داخل موطني",
  SECURE_EXTERNAL_PORTAL: "بوابة رسمية آمنة",
  LOCAL_GUIDE_AND_DOWNLOADS: "دليل وروابط رسمية",
  PENDING_URL_VALIDATION: "قيد التحقق",
  EXCLUDED: "مستبعدة",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "غير متاح";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "غير متاح";
  return new Intl.DateTimeFormat("ar-LB", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function buildInitialValues(service: OfficialService | null): Record<string, string> {
  if (!service?.inputFields?.length) return {};

  return Object.fromEntries(service.inputFields.map((field) => [
    field.key,
    field.type === "select" ? field.options?.[0]?.value || "" : "",
  ]));
}

function resolveOfficialServiceUrl(service: OfficialService): string {
  return service.portalUrl || service.sourceUrl;
}

function toOfficialServiceQueryError(nextError: unknown): OfficialServiceQueryError {
  if (nextError && typeof nextError === "object") {
    return nextError as OfficialServiceQueryError;
  }
  return { message: "تعذر تنفيذ الاستعلام الرسمي حالياً" } as OfficialServiceQueryError;
}

function downloadKindLabel(kind: string): string {
  if (kind === "video") return "فيديو رسمي";
  if (kind === "pdf") return "ملف PDF رسمي";
  return "رابط رسمي";
}

export default function OfficialServiceDetailPage() {
  const { serviceId = "" } = useParams<{ serviceId: string }>();
  const { apiBaseUrl } = useApp();
  const [service, setService] = useState<OfficialService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OfficialServiceQueryResponse | null>(null);
  const [embedPortal, setEmbedPortal] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [showOfficialFallback, setShowOfficialFallback] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setResult(null);
    setFallbackUrl("");
    setShowOfficialFallback(false);

    api.getOfficialService(serviceId, apiBaseUrl)
      .then((nextService) => {
        if (!active) return;
        setService(nextService);
        setFormValues(buildInitialValues(nextService));
        setFallbackUrl(resolveOfficialServiceUrl(nextService));
      })
      .catch((nextError) => {
        if (!active) return;
        setService(null);
        setError(nextError instanceof Error ? nextError.message : "تعذر تحميل تفاصيل الخدمة الرسمية");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl, serviceId]);

  const statusTone = useMemo(() => {
    if (!service?.enabled || service?.mode === "PENDING_URL_VALIDATION") return "official-result-pill official-result-pill--warn";
    return "official-result-pill official-result-pill--ok";
  }, [service]);

  function handleBridgeFieldChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  async function handleQuerySubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!service) return;

    setSubmitting(true);
    setError("");
    setShowOfficialFallback(false);

    try {
      const nextResult = await api.queryOfficialService(service.id, formValues, apiBaseUrl);
      setResult(nextResult);
      setFallbackUrl(nextResult.fallbackUrl || resolveOfficialServiceUrl(service));
    } catch (nextError) {
      const details = toOfficialServiceQueryError(nextError);
      setResult(null);
      setFallbackUrl(details.fallbackUrl || details.sourceUrl || resolveOfficialServiceUrl(service));
      setShowOfficialFallback(details.reason === "upstream_unavailable");
      setError(details.message || "تعذر تنفيذ الاستعلام الرسمي حالياً");
    } finally {
      setSubmitting(false);
    }
  }

  function renderBridgeForm(currentService: OfficialService) {
    const officialUrl = resolveOfficialServiceUrl(currentService);
    return (
      <>
        <section className="official-detail-panel">
          <div className="official-detail-head">
            <h3>الاستعلام داخل موطني</h3>
            <span className={statusTone}>{currentService.enabled ? "الخدمة مفعلة" : "الخدمة غير مفعلة"}</span>
          </div>
          <div className="official-service-actions">
            <a className="official-link-btn official-link-btn--primary" href={officialUrl} target="_blank" rel="noreferrer">
              فتح المصدر الرسمي
            </a>
          </div>
          <p>{currentService.helpTextAr}</p>
          <form className="official-service-form" onSubmit={handleQuerySubmit}>
            <div className="official-form-grid">
              {(currentService.inputFields || []).map((field) => (
                <div className="official-field" key={field.key}>
                  <label htmlFor={field.key}>{field.labelAr}</label>
                  {field.type === "select" ? (
                    <select
                      id={field.key}
                      name={field.key}
                      value={formValues[field.key] || ""}
                      onChange={handleBridgeFieldChange}
                      disabled={submitting}
                    >
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.labelAr}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={field.key}
                      name={field.key}
                      type="text"
                      value={formValues[field.key] || ""}
                      onChange={handleBridgeFieldChange}
                      placeholder={field.placeholderAr || field.labelAr}
                      disabled={submitting}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="official-service-actions">
              <button className="official-btn" type="submit" disabled={submitting || !currentService.enabled}>
                {submitting ? "جارٍ جلب النتيجة الرسمية..." : "تنفيذ الاستعلام الرسمي"}
              </button>
            </div>
          </form>

          {showOfficialFallback ? (
            <div className="official-fallback-panel">
              <h4>المسار البديل حالياً</h4>
              <p>تعذّر على موطني الوصول إلى المصدر الرسمي لهذه الخدمة الآن. يمكنك متابعة العملية مباشرةً عبر الرابط الرسمي والمحاولة لاحقاً من داخل موطني.</p>
              <div className="official-service-actions">
                <a className="official-link-btn official-link-btn--primary" href={fallbackUrl || officialUrl} target="_blank" rel="noreferrer">
                  فتح الرابط الرسمي مباشرة
                </a>
              </div>
            </div>
          ) : null}
        </section>

        {result ? (
          <section className="official-result-panel">
            <div className="official-detail-head">
              <h3>النتيجة الرسمية</h3>
              <span className="official-result-pill official-result-pill--ok">{formatDateTime(result.lastCheckedAt)}</span>
            </div>
            <div className="official-service-actions">
              <a className="official-link-btn" href={result.fallbackUrl} target="_blank" rel="noreferrer">
                متابعة عبر المصدر الرسمي
              </a>
            </div>
            <p>{result.result.summaryAr}</p>
            <div className="official-result-grid">
              {result.result.items.length > 0 ? result.result.items.map((item) => (
                <div className="official-result-item" key={`${item.labelAr}-${item.valueAr}`}>
                  <strong>{item.labelAr}</strong>
                  <span>{item.valueAr}</span>
                </div>
              )) : <div className="official-empty">لم يعرض المصدر الرسمي تفاصيل إضافية لهذه العملية.</div>}
            </div>
          </section>
        ) : null}
      </>
    );
  }

  function renderExternalOnly(currentService: OfficialService) {
    const officialUrl = resolveOfficialServiceUrl(currentService);
    return (
      <section className="official-detail-panel">
        <div className="official-detail-head">
          <h3>الوصول عبر المصدر الرسمي فقط</h3>
          <span className="official-result-pill official-result-pill--warn">خارج موطني فقط</span>
        </div>
        <div className="official-service-actions">
          <a className="official-link-btn official-link-btn--primary" href={officialUrl} target="_blank" rel="noreferrer">
            فتح المصدر الرسمي
          </a>
        </div>
        <p>{currentService.helpTextAr}</p>
        <div className="official-warning">تم إيقاف الوصول المضمن لهذه الخدمة داخل موطني. افتح الرابط الرسمي من جهازك لإدخال البيانات أو متابعة الطلب مباشرةً من الجهة الرسمية.</div>
        {currentService.guideBulletsAr?.length ? (
          <ul>
            {currentService.guideBulletsAr.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
        ) : null}
      </section>
    );
  }

  function renderSecurePortal(currentService: OfficialService) {
    const portalUrl = resolveOfficialServiceUrl(currentService);
    return (
      <section className="official-detail-panel">
        <div className="official-detail-head">
          <h3>بوابة رسمية آمنة</h3>
          <span className={currentService.privacy === "HIGH" ? "official-result-pill official-result-pill--warn" : "official-result-pill official-result-pill--ok"}>
            {currentService.privacy === "HIGH" ? "بيانات حساسة" : "وصول آمن"}
          </span>
        </div>
        <div className="official-service-actions">
          <a className="official-link-btn official-link-btn--primary" href={portalUrl} target="_blank" rel="noreferrer">
            فتح البوابة الرسمية
          </a>
          <button className="official-link-btn" type="button" onClick={() => setEmbedPortal((current) => !current)}>
            {embedPortal ? "إخفاء المعاينة المضمنة" : "محاولة فتحها داخل موطني"}
          </button>
        </div>
        <p>{currentService.helpTextAr}</p>
        <div className="official-info">لا يقوم موطني بتخزين بيانات الدخول أو النتائج الطبية لهذه البوابة.</div>
        {embedPortal ? (
          <>
            <div className="official-warning">قد تمنع الجهة الرسمية عرض هذه البوابة داخل الإطار بسبب سياسات الأمان. إذا لم تظهر، استخدم الزر الخارجي أعلاه.</div>
            <iframe className="official-service-frame" title={currentService.titleAr} src={portalUrl} />
          </>
        ) : null}
      </section>
    );
  }

  function renderGuideDownloads(currentService: OfficialService) {
    return (
      <>
        <section className="official-detail-panel">
          <div className="official-detail-head">
            <h3>الدليل المختصر داخل موطني</h3>
            <span className="official-result-pill official-result-pill--ok">روابط رسمية مجمعة</span>
          </div>
          <p>{currentService.helpTextAr}</p>
          {currentService.guideBulletsAr?.length ? (
            <ul>
              {currentService.guideBulletsAr.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          ) : null}
        </section>

        <section className="official-detail-panel">
          <div className="official-detail-head">
            <h3>التحميلات والروابط الرسمية</h3>
            <span className="official-inline-pill">{currentService.downloads?.length || 0} مورد</span>
          </div>
          <div className="official-download-grid">
            {(currentService.downloads || []).map((download) => (
              <article className="official-download-card" key={download.id}>
                <h3>{download.titleAr}</h3>
                <p>{downloadKindLabel(download.kind)}</p>
                <div className="official-service-actions">
                  <a className="official-link-btn official-link-btn--primary" href={download.url} target="_blank" rel="noreferrer">
                    فتح المورد
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderPending(currentService: OfficialService) {
    return (
      <section className="official-detail-panel">
        <div className="official-detail-head">
          <h3>الخدمة قيد التحقق</h3>
          <span className="official-result-pill official-result-pill--warn">قيد المراجعة التقنية</span>
        </div>
        <div className="official-service-actions">
          <a className="official-link-btn" href={resolveOfficialServiceUrl(currentService)} target="_blank" rel="noreferrer">
            فتح الرابط الحالي
          </a>
        </div>
        <p>{currentService.helpTextAr}</p>
        <div className="official-warning">لن تُفعّل هذه الخدمة داخل موطني قبل تثبيت الرابط الرسمي الصحيح ونجاح فحص الصحة.</div>
        {currentService.knownIssuesAr?.length ? (
          <ul>
            {currentService.knownIssuesAr.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        ) : null}
        <div className="official-status-grid">
          <div className="official-status-card">
            <strong>آخر فحص</strong>
            <span>{formatDateTime(currentService.lastCheckedAt)}</span>
          </div>
          <div className="official-status-card">
            <strong>آخر رمز حالة</strong>
            <span>{currentService.lastStatusCode ?? "غير متاح"}</span>
          </div>
          <div className="official-status-card">
            <strong>وضع الرابط</strong>
            <span>{currentService.lastHealthOk ? "متاح" : "غير متاح"}</span>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return <main className="official-service-detail" dir="rtl"><div className="official-info">جارٍ تحميل تفاصيل الخدمة الرسمية...</div></main>;
  }

  if (!service) {
    return (
      <main className="official-service-detail" dir="rtl">
        <div className="official-alert">{error || "تعذر العثور على هذه الخدمة الرسمية."}</div>
        <Link className="official-back-link" to="/services/official">العودة إلى مركز الخدمات الرسمية</Link>
      </main>
    );
  }

  let detailContent: ReactNode = null;
  if (service.externalOnly) {
    detailContent = renderExternalOnly(service);
  } else {
    switch (service.mode) {
      case "LOCAL_FORM_BRIDGE":
        detailContent = renderBridgeForm(service);
        break;
      case "SECURE_EXTERNAL_PORTAL":
        detailContent = renderSecurePortal(service);
        break;
      case "LOCAL_GUIDE_AND_DOWNLOADS":
        detailContent = renderGuideDownloads(service);
        break;
      case "PENDING_URL_VALIDATION":
        detailContent = renderPending(service);
        break;
    }
  }

  return (
    <main className="official-service-detail" dir="rtl">
      <section className="official-detail-hero">
        <div className="official-back-row">
          <Link className="official-back-link" to="/services/official">العودة إلى مركز الخدمات الرسمية</Link>
          <span className="official-detail-eyebrow">الخدمة {service.listingNo}</span>
        </div>
        <h1>{service.titleAr}</h1>
        <p>{service.summaryAr}</p>
        <div className="official-detail-badges">
          <span className={statusTone}>{MODE_LABELS[service.mode]}</span>
          <span className="official-inline-pill">{service.providerAr}</span>
          {service.externalOnly ? <span className="official-inline-pill">خارج موطني فقط</span> : null}
          <span className={`official-inline-pill${service.privacy === "HIGH" ? " official-inline-pill--high" : ""}`}>
            {service.privacy === "HIGH" ? "خصوصية مرتفعة" : "خصوصية اعتيادية"}
          </span>
          <span className="official-inline-pill">{service.storeInputs ? "قد تحفظ المدخلات" : "لا يتم حفظ المدخلات"}</span>
        </div>
      </section>

      {error ? <div className="official-alert">{error}</div> : null}

      <section className="official-detail-grid">
        <div className="official-detail-stack">{detailContent}</div>

        <aside className="official-detail-panel">
          <div className="official-detail-head">
            <h3>معلومات الخدمة</h3>
            <span className="official-inline-pill">{service.enabled ? "متاحة" : "غير مفعلة"}</span>
          </div>
          <p>{service.helpTextAr}</p>
          {service.guideBulletsAr?.length ? (
            <ul>
              {service.guideBulletsAr.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          ) : null}
          <div className="official-status-grid">
            <div className="official-status-card">
              <strong>المصدر الرسمي</strong>
              <span>{service.providerAr}</span>
            </div>
            <div className="official-status-card">
              <strong>آخر فحص</strong>
              <span>{formatDateTime(service.lastCheckedAt)}</span>
            </div>
            <div className="official-status-card">
              <strong>آخر رمز حالة</strong>
              <span>{service.lastStatusCode ?? "غير متاح"}</span>
            </div>
          </div>
          <div className="official-service-actions">
            <a className="official-link-btn official-link-btn--primary" href={resolveOfficialServiceUrl(service)} target="_blank" rel="noreferrer">
              فتح المصدر الرسمي
            </a>
          </div>
        </aside>
      </section>
    </main>
  );
}
