import { CalendarInput } from '../aided-input';

// ADDRESS_NETWORK_CANONICAL_ADDRESS_WIDGET_MIGRATION_REVIEWED
import { useEffect, useMemo, useState } from "react";
import { resolveApparatusIcon } from "../../lib/apparatusIcons";
import { Warning24Regular } from "../../theme/watany-v4/legacyIconBridge";
import type { RecruitmentAnnouncement } from "../../types/domain";
import { api } from "../../lib/api";
import { useApp } from "../../store/app";
import type { LebanonAddressValue } from "../address/addressTypes";
import { normalizeLebanonAddressValue } from "../address/addressValidation";
import { LebanonAddressSelector } from "../address/LebanonAddressSelector";

type RecruitmentFormState = {
  title: string;
  apparatusName: string;
  announcementNumber: string;
  startDate: string;
  endDate: string;
  status: RecruitmentAnnouncement["status"];
  conditionsText: string;
  requiredDocumentsText: string;
  eligibleCategoriesText: string;
  applicationLocation: LebanonAddressValue;
  applicationMethod: string;
  sourceName: string;
  sourceUrl: string;
  notes: string;
};

const EMPTY_APPLICATION_LOCATION = normalizeLebanonAddressValue(null);

const EMPTY_FORM: RecruitmentFormState = {
  title: "",
  apparatusName: "",
  announcementNumber: "",
  startDate: "",
  endDate: "",
  status: "draft",
  conditionsText: "",
  requiredDocumentsText: "",
  eligibleCategoriesText: "",
  applicationLocation: EMPTY_APPLICATION_LOCATION,
  applicationMethod: "",
  sourceName: "",
  sourceUrl: "",
  notes: "",
};

function formatDateTime(value: string | undefined): string {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ar-LB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function toDateTimeLocalValue(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function toIsoOrUndefined(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n|[،,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(items: string[]): string {
  return items.join("/n");
}

function formatApplicationLocation(value: LebanonAddressValue): string {
  return value.displayAddress.trim();
}

function hasSourceEvidence(form: RecruitmentFormState): boolean {
  return Boolean(form.sourceUrl.trim() || form.sourceName.trim() || form.notes.trim());
}

function statusMeta(status: RecruitmentAnnouncement["status"]): { label: string; tone: "active" | "scheduled" | "muted" } {
  switch (status) {
    case "published":
      return { label: "منشور", tone: "active" };
    case "draft":
      return { label: "مسودة", tone: "scheduled" };
    case "expired":
      return { label: "منتهي", tone: "muted" };
    case "cancelled":
      return { label: "ملغى", tone: "muted" };
    default:
      return { label: status, tone: "muted" };
  }
}

function announcementToForm(announcement: RecruitmentAnnouncement): RecruitmentFormState {
  return {
    title: announcement.title,
    apparatusName: announcement.apparatusName,
    announcementNumber: announcement.announcementNumber || "",
    startDate: toDateTimeLocalValue(announcement.startDate),
    endDate: toDateTimeLocalValue(announcement.endDate),
    status: announcement.status,
    conditionsText: joinLines(announcement.conditions),
    requiredDocumentsText: joinLines(announcement.requiredDocuments),
    eligibleCategoriesText: joinLines(announcement.eligibleCategories),
    applicationLocation: normalizeLebanonAddressValue(announcement.applicationLocation),
    applicationMethod: announcement.applicationMethod || "",
    sourceName: announcement.sourceName || "",
    sourceUrl: announcement.sourceUrl || "",
    notes: announcement.notes || "",
  };
}

export default function RecruitmentAdminPanel() {
  const { apiBaseUrl } = useApp();
  const [announcements, setAnnouncements] = useState<RecruitmentAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecruitmentFormState>(EMPTY_FORM);

  async function loadAnnouncements() {
    setLoading(true);
    setError(null);
    try {
      const items = await api.getAdminRecruitmentAnnouncements(apiBaseUrl);
      setAnnouncements(items);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر تحميل التعاميم");
    } finally {
      setLoading(false);
    }
  }

  // loadAnnouncements intentionally omitted from deps
  useEffect(() => {
    void loadAnnouncements();
  }, [apiBaseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = useMemo(() => {
    return {
      total: announcements.length,
      published: announcements.filter((item) => item.status === "published").length,
      draft: announcements.filter((item) => item.status === "draft").length,
      inactive: announcements.filter((item) => item.status === "expired" || item.status === "cancelled").length,
    };
  }, [announcements]);
  let submitLabel = "نشر الإعلان";
  if (editingId) {
    submitLabel = "حفظ التعديل";
  }
  if (busy === "create" || (editingId !== null && busy === `update:${editingId}`)) {
    submitLabel = "جارٍ الحفظ…";
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function updateForm<K extends keyof RecruitmentFormState>(key: K, value: RecruitmentFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!form.title.trim() || !form.apparatusName.trim()) return;
    if (form.status === "published" && !hasSourceEvidence(form)) {
      setError("لا يمكن نشر إعلان التطويع من دون رابط مصدر أو اسم مصدر أو ملاحظة توثيق.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      apparatusName: form.apparatusName.trim(),
      announcementNumber: form.announcementNumber.trim() || undefined,
      startDate: toIsoOrUndefined(form.startDate),
      endDate: toIsoOrUndefined(form.endDate),
      status: form.status,
      conditions: parseLines(form.conditionsText),
      requiredDocuments: parseLines(form.requiredDocumentsText),
      eligibleCategories: parseLines(form.eligibleCategoriesText),
      applicationLocation: formatApplicationLocation(form.applicationLocation) || undefined,
      applicationMethod: form.applicationMethod.trim() || undefined,
      sourceName: form.sourceName.trim() || undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    setBusy(editingId ? `update:${editingId}` : "create");
    setError(null);
    try {
      if (editingId) {
        await api.updateAdminRecruitmentAnnouncement(editingId, payload, apiBaseUrl);
      } else {
        await api.createAdminRecruitmentAnnouncement(payload, apiBaseUrl);
      }
      resetForm();
      await loadAnnouncements();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حفظ إعلان التطويع");
    } finally {
      setBusy(null);
    }
  }

  function handleEdit(announcement: RecruitmentAnnouncement) {
    setEditingId(announcement.id);
    setForm(announcementToForm(announcement));
  }

  async function handleDelete(announcement: RecruitmentAnnouncement) {
    if (!globalThis.confirm(`سيتم حذف إعلان التطويع التالي:/n${announcement.title}`)) return;

    setBusy(`delete:${announcement.id}`);
    setError(null);
    try {
      await api.deleteAdminRecruitmentAnnouncement(announcement.id, apiBaseUrl);
      if (editingId === announcement.id) {
        resetForm();
      }
      await loadAnnouncements();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "تعذر حذف إعلان التطويع");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="sa-section-stack">
      {loading && announcements.length === 0 && !error ? (
        <div className="screen-loader">
          <div className="screen-loader__spinner" />
          <span>جارٍ تحميل التعاميم…</span>
        </div>
      ) : null}

      {error ? (
        <section className="admin-payments-banner admin-payments-banner--error">
          <Warning24Regular aria-hidden />
          <span>{error}</span>
        </section>
      ) : null}

      <section className="admin-payments-metrics">
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">الإجمالي</span>
          <strong>{metrics.total}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">منشور</span>
          <strong>{metrics.published}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">مسودات</span>
          <strong>{metrics.draft}</strong>
        </article>
        <article className="admin-payments-metric">
          <span className="admin-payments-metric__label">غير نشط</span>
          <strong>{metrics.inactive}</strong>
        </article>
      </section>

      <section className="admin-payments-grid admin-payments-grid--lists">
        <form className="admin-payments-card admin-payments-form admin-payments-card--wide" onSubmit={handleSubmit}>
          <div className="admin-payments-card__header">
            <h2>{editingId ? "تعديل إعلان تطويع" : "إعلان تطويع جديد"}</h2>
            <span>أنشئ أو حدّث الإعلانات الرسمية للجيش والأجهزة الأمنية المعتمدة.</span>
          </div>

          <div className="admin-payments-form__row">
            <label className="admin-payments-field">
              <span>العنوان</span>
              <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="مثال: مباراة تطويع رتباء متطوعين" />
            </label>
            <label className="admin-payments-field">
              <span>الجهاز</span>
              <input value={form.apparatusName} onChange={(event) => updateForm("apparatusName", event.target.value)} placeholder="الجيش اللبناني" />
            </label>
          </div>

          <div className="admin-payments-form__row">
            <label className="admin-payments-field">
              <span>رقم الإعلان</span>
              <input value={form.announcementNumber} onChange={(event) => updateForm("announcementNumber", event.target.value)} placeholder="اختياري" />
            </label>
            <label className="admin-payments-field">
              <span>الحالة</span>
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value as RecruitmentAnnouncement["status"])}>
                <option value="draft">مسودة</option>
                <option value="published">منشور</option>
                <option value="expired">منتهي</option>
                <option value="cancelled">ملغى</option>
              </select>
            </label>
          </div>

          <div className="admin-payments-form__row">
            <label className="admin-payments-field">
              <span>يبدأ عند</span>
              <CalendarInput label="تاريخ البداية" value={form.startDate} includeTime onChange={(next) => updateForm("startDate", next)} />
            </label>
            <label className="admin-payments-field">
              <span>ينتهي عند</span>
              <CalendarInput label="تاريخ النهاية" value={form.endDate} includeTime onChange={(next) => updateForm("endDate", next)} />
            </label>
          </div>

          <label className="admin-payments-field">
            <span>الفئات المؤهلة</span>
            <textarea data-aided-input-prose-list="eligible-categories" value={form.eligibleCategoriesText} onChange={(event) => updateForm("eligibleCategoriesText", event.target.value)} rows={3} placeholder="عنصر واحد في كل سطر" />
          </label>
          <label className="admin-payments-field">
            <span></span>
            <textarea value={form.conditionsText} onChange={(event) => updateForm("conditionsText", event.target.value)} rows={4} placeholder="عنصر واحد في كل سطر" />
          </label>
          <label className="admin-payments-field">
            <span>المستندات المطلوبة</span>
            <textarea value={form.requiredDocumentsText} onChange={(event) => updateForm("requiredDocumentsText", event.target.value)} rows={4} placeholder="عنصر واحد في كل سطر" />
          </label>

          <div className="admin-payments-form__row">
            <label className="admin-payments-field">
              <span>مكان التقديم</span>
              <LebanonAddressSelector
                value={form.applicationLocation}
                exactAddressLabel="المركز أو القيادة"
                exactAddressPlaceholder="اكتب المركز أو القيادة أو حدّد العنوان الإداري"
                onChange={(addressValue) => updateForm("applicationLocation", addressValue)}
              />
            </label>
            <label className="admin-payments-field">
              <span></span>
              <input value={form.applicationMethod} onChange={(event) => updateForm("applicationMethod", event.target.value)} placeholder="حضورياً أو عبر رابط رسمي" />
            </label>
          </div>

          <div className="admin-payments-form__row">
            <label className="admin-payments-field">
              <span>اسم المصدر</span>
              <input value={form.sourceName} onChange={(event) => updateForm("sourceName", event.target.value)} placeholder="مثال: مديرية التوجيه" />
            </label>
            <label className="admin-payments-field">
              <span>رابط المصدر</span>
              <input value={form.sourceUrl} onChange={(event) => updateForm("sourceUrl", event.target.value)} placeholder="https://..." />
            </label>
          </div>

          <p className="admin-payments-inline-note">
            عند اختيار حالة "منشور" يجب إدخال رابط مصدر رسمي أو اسم المصدر أو ملاحظة توثيق داخل الحقل المخصص.
          </p>

          <label className="admin-payments-field">
            <span>ملاحظات</span>
            <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} rows={3} placeholder="ملاحظات إضافية أو توثيق يدوي للمصدر عند الحاجة" />
          </label>

          <div className="admin-payments-editor__actions">
            <button className="sa-group__btn wt-cta-glow wt-cta-processing" type="submit" disabled={!!busy || !form.title.trim() || !form.apparatusName.trim()} aria-busy={!!busy}>
              {submitLabel}
            </button>
            {editingId ? (
              <button className="sa-group__btn sa-group__btn--off wt-cta-glow" type="button" onClick={resetForm} disabled={!!busy}>
                إلغاء التعديل
              </button>
            ) : null}
          </div>
        </form>

        <article className="admin-payments-card admin-payments-card--wide">
          <div className="admin-payments-card__header">
            <h2>الإعلانات الحالية</h2>
            <span>يمكن تعديل الإعلان أو حذفه أو نسخ تفاصيله من هنا.</span>
          </div>
          <div className="admin-payments-list">
            {announcements.map((announcement) => {
              const status = statusMeta(announcement.status);
              return (
                <div key={announcement.id} className="admin-payments-list__item admin-payments-list__item--stacked">
                  <div className="admin-payments-list__topline">
                    <strong>{announcement.title}</strong>
                    <span className={`admin-payments-badge admin-payments-badge--${status.tone}`}>{status.label}</span>
                  </div>
                  <div className="admin-payments-inline-note">
                    <span className="admin-payments-apparatus">
                      {(() => {
                        const icon = resolveApparatusIcon(announcement.apparatusName);
                        return icon ? <img src={icon.src} alt={icon.alt} loading="lazy" /> : null;
                      })()}
                      <span>{announcement.apparatusName}</span>
                    </span>
                    <span>أُنشئ: {formatDateTime(announcement.createdAt)}</span>
                    <span>تحديث: {formatDateTime(announcement.updatedAt)}</span>
                  </div>
                  {announcement.conditions.length > 0 ? <p>: {announcement.conditions.join("، ")}</p> : null}
                  {announcement.requiredDocuments.length > 0 ? <p>المستندات: {announcement.requiredDocuments.join("، ")}</p> : null}
                  {announcement.applicationLocation ? <p>مكان التقديم: {announcement.applicationLocation}</p> : null}
                  <div className="admin-payments-list__actions">
                    <button className="sa-group__btn wt-cta-glow" type="button" onClick={() => handleEdit(announcement)} disabled={!!busy}>
                      تعديل
                    </button>
                    <button className="sa-group__btn sa-group__btn--off wt-cta-glow wt-cta-processing" type="button" onClick={() => void handleDelete(announcement)} disabled={busy === `delete:${announcement.id}`} aria-busy={busy === `delete:${announcement.id}`}>
                      {busy === `delete:${announcement.id}` ? "جارٍ الحذف…" : "حذف"}
                    </button>
                  </div>
                </div>
              );
            })}
            {announcements.length === 0 ? <p className="admin-payments-empty">لا توجد إعلانات تطويع محفوظة بعد.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

