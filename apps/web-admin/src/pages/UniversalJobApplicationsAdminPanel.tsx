import { useEffect, useMemo, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminNotice, AdminStatusBadge } from "../components/admin/AdminPrimitives";
import FormCreatorPlugin, { type FormCreatorField } from "../components/forms/FormCreatorPlugin";

type FieldType = "text" | "textarea" | "integer" | "phone" | "email" | "date" | "yes_no" | "select" | "multi_select" | "universal_locator";
type FieldDef = { key: string; labelAr: string; type: FieldType; required?: boolean; placeholder?: string; helpText?: string; options?: string[]; reusableFromProfile?: boolean; reusableFromPrevious?: boolean; adminList?: boolean; filterable?: boolean; condition?: { field: string; equals?: boolean | string | number; includes?: string } };
type Template = { id: string; slug: string; employerId?: string; employerName: string; ownerUserId?: string; jobId?: string; name: string; titleAr: string; introAr: string; employmentType: string; status: string; currentVersion: number; draftFields: FieldDef[]; draftSettings: Record<string, unknown>; updatedAt: string };
type Application = { id: string; reference: string; templateId: string; templateTitle?: string; employerName?: string; applicantName: string; phone: string; ageYears?: number; mohafaza?: string; caza?: string; village?: string; answers: Record<string, unknown>; status: string; followUpStatus: string; adminNotes: string; version: number; createdAt: string; updatedAt: string };
type History = { version: number; eventType: string; snapshot: Record<string, unknown>; actorId: string; createdAt: string };

type TemplateForm = { id?: string; slug: string; employerName: string; employerId: string; name: string; titleAr: string; introAr: string; fields: FieldDef[] };
const EMPTY_TEMPLATE: TemplateForm = { slug: "", employerName: "", employerId: "", name: "", titleAr: "", introAr: "", fields: [] };
const STATUS_OPTIONS = ["pending", "reviewing", "shortlisted", "approved", "rejected", "hired", "withdrawn"];
const FOLLOW_OPTIONS = ["not_contacted", "to_contact", "contacted", "interview_scheduled", "interview_completed", "waiting_documents", "follow_up_required", "closed", "no_response", "withdrawn"];

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ar-LB"); }
function toCreatorFields(fields: FieldDef[]): FormCreatorField[] {
  return fields.map((field) => ({ key: field.key, label: field.labelAr, type: field.type, required: field.required, placeholder: field.placeholder, helpText: field.helpText, options: field.options }));
}
function fromCreatorFields(fields: FormCreatorField[], previous: FieldDef[]): FieldDef[] {
  return fields.map((field) => {
    const prior = previous.find((item) => item.key === field.key);
    return {
      ...prior,
      key: field.key,
      labelAr: field.label,
      type: field.type as FieldType,
      required: Boolean(field.required),
      placeholder: field.placeholder,
      helpText: field.helpText,
      options: field.options,
      reusableFromPrevious: prior?.reusableFromPrevious ?? true,
    };
  });
}

export default function UniversalJobApplicationsAdminPanel({ view, focusTemplateId }: Readonly<{ view: "templates" | "applications"; focusTemplateId?: string }>) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(EMPTY_TEMPLATE);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [q, setQ] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [followFilter, setFollowFilter] = useState("");
  const [accreditedFilter, setAccreditedFilter] = useState("");
  const [minExperience, setMinExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTemplates = async () => {
    const response = await adminFetch("/api/jobs/application-templates/manage");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { items?: Template[] };
    setTemplates(data.items || []);
  };

  const loadApplications = async (templateOverride?: string) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const effectiveTemplate = templateOverride ?? templateFilter;
    if (effectiveTemplate) params.set("template_id", effectiveTemplate);
    if (statusFilter) params.set("status", statusFilter);
    if (followFilter) params.set("follow_up_status", followFilter);
    if (accreditedFilter) params.set("accredited", accreditedFilter);
    if (minExperience) params.set("min_experience", minExperience);
    const response = await adminFetch(`/api/jobs/application-template-applications?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { items?: Application[] };
    setApplications(data.items || []);
  };

  const loadAll = async () => {
    setLoading(true); setError("");
    try { await loadTemplates(); if (view === "applications") { if (focusTemplateId) setTemplateFilter(focusTemplateId); await loadApplications(focusTemplateId); } }
    catch (err) { setError(getAdminErrorMessage(err, "تعذر تحميل نظام نماذج التوظيف.")); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadAll(); }, [view, focusTemplateId]);

  const editTemplate = (item: Template) => setTemplateForm({ id: item.id, slug: item.slug, employerName: item.employerName, employerId: item.employerId || "", name: item.name, titleAr: item.titleAr, introAr: item.introAr, fields: item.draftFields || [] });
  useEffect(() => { if (view === "templates" && focusTemplateId && templates.length) { const item = templates.find((candidate) => candidate.id === focusTemplateId); if (item) editTemplate(item); } }, [view, focusTemplateId, templates]);

  const saveTemplate = async () => {
    if (!templateForm.slug.trim() || !templateForm.employerName.trim() || !templateForm.name.trim() || !templateForm.titleAr.trim()) { setError("الرمز والجهة واسم النموذج والعنوان مطلوبة."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await adminFetch(templateForm.id ? `/api/jobs/application-templates/manage/${templateForm.id}` : "/api/jobs/application-templates/manage", {
        method: templateForm.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: templateForm.slug.trim(), employerId: templateForm.employerId.trim() || undefined, employerName: templateForm.employerName.trim(), name: templateForm.name.trim(), titleAr: templateForm.titleAr.trim(), introAr: templateForm.introAr.trim(), fields: templateForm.fields, employmentType: "FULL_TIME", allowProfileAutofill: true, allowPreviousAutofill: true, allowBlankStart: true }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setTemplateForm(EMPTY_TEMPLATE); setNotice("تم حفظ النموذج."); await loadTemplates();
    } catch (err) { setError(getAdminErrorMessage(err, "تعذر حفظ النموذج.")); }
    finally { setSaving(false); }
  };

  const publish = async (id: string) => {
    setError(""); try { const response = await adminFetch(`/api/jobs/application-templates/manage/${id}/publish`, { method: "POST" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); setNotice("تم نشر إصدار جديد من النموذج."); await loadTemplates(); } catch (err) { setError(getAdminErrorMessage(err, "تعذر نشر النموذج.")); }
  };

  const clone = async (item: Template) => {
    const slug = `${item.slug}-copy-${Date.now().toString().slice(-6)}`;
    setError(""); try { const response = await adminFetch(`/api/jobs/application-templates/manage/${item.id}/clone`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, name: `${item.name} - نسخة`, titleAr: item.titleAr, employerName: item.employerName, employerId: item.employerId }) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); setNotice("تم نسخ النموذج كمسودة مستقلة دون نسخ أي طلبات."); await loadTemplates(); } catch (err) { setError(getAdminErrorMessage(err, "تعذر نسخ النموذج.")); }
  };

  const openApplication = async (item: Application) => {
    setSelected(item); setHistory([]); setError("");
    try { const response = await adminFetch(`/api/jobs/application-template-applications/${item.id}/history`); if (response.ok) { const data = await response.json() as { items?: History[] }; setHistory(data.items || []); } }
    catch { /* detail remains usable */ }
  };

  const mutateApplication = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const response = await adminFetch(`/api/jobs/application-template-applications/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...patch, expectedVersion: selected.version }) });
      const data = await response.json() as { item?: Application; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || `HTTP ${response.status}`);
      setSelected(data.item); await loadApplications(); await openApplication(data.item); setNotice("تم تحديث الطلب وتسجيل العملية في السجل.");
    } catch (err) { setError(getAdminErrorMessage(err, "تعذر تحديث الطلب. حدّث البيانات إذا كان الطلب قد تغيّر من جلسة أخرى.")); }
    finally { setSaving(false); }
  };

  const selectedLocation = useMemo(() => selected ? [selected.mohafaza, selected.caza, selected.village].filter(Boolean).join(" / ") : "", [selected]);

  if (view === "templates") return (
    <div className="universal-jobs-admin" dir="rtl">
      <AdminNotice tone="info">النماذج المنشورة تحفظ بإصدارات مستقلة. تعديل المسودة ثم النشر ينشئ إصداراً جديداً ولا يغير الطلبات السابقة.</AdminNotice>
      {error ? <div className="alert" role="alert">{error}</div> : null}{notice ? <div className="alert success" role="status">{notice}</div> : null}
      <section className="admin-panel" style={{ marginBottom: 16 }}><h3>{templateForm.id ? "تعديل مسودة النموذج" : "إنشاء نموذج طلب توظيف"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <label><span>الرمز / Slug *</span><input value={templateForm.slug} disabled={Boolean(templateForm.id)} onChange={(e) => setTemplateForm((c) => ({ ...c, slug: e.target.value }))} /></label>
          <label><span>جهة العمل *</span><input value={templateForm.employerName} onChange={(e) => setTemplateForm((c) => ({ ...c, employerName: e.target.value }))} /></label>
          <label><span>معرف جهة العمل</span><input value={templateForm.employerId} onChange={(e) => setTemplateForm((c) => ({ ...c, employerId: e.target.value }))} /></label>
          <label><span>اسم النموذج *</span><input value={templateForm.name} onChange={(e) => setTemplateForm((c) => ({ ...c, name: e.target.value }))} /></label>
          <label style={{ gridColumn: "1/-1" }}><span>العنوان العام *</span><input value={templateForm.titleAr} onChange={(e) => setTemplateForm((c) => ({ ...c, titleAr: e.target.value }))} /></label>
          <label style={{ gridColumn: "1/-1" }}><span>المقدمة</span><textarea rows={2} value={templateForm.introAr} onChange={(e) => setTemplateForm((c) => ({ ...c, introAr: e.target.value }))} /></label>
        </div>
        <FormCreatorPlugin title="منشئ النموذج" description="أنشئ نموذجاً قابلاً لإعادة الاستخدام، بما في ذلك حقول المحدد الجغرافي الشامل." fields={toCreatorFields(templateForm.fields)} allowedTypes={["text","textarea","integer","phone","email","date","yes_no","select","multi_select","universal_locator"]} onChange={(fields) => setTemplateForm((current) => ({ ...current, fields: fromCreatorFields(fields, current.fields) }))} compact />
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><button className="accent" type="button" disabled={saving} onClick={() => void saveTemplate()}>{saving ? "جارٍ الحفظ..." : "حفظ المسودة"}</button>{templateForm.id ? <button className="ghost" type="button" onClick={() => setTemplateForm(EMPTY_TEMPLATE)}>إلغاء</button> : null}</div>
      </section>
      <div className="table-wrap"><table className="admin-table"><thead><tr><th>النموذج</th><th>جهة العمل</th><th>الحالة</th><th>الإصدار</th><th>آخر تحديث</th><th>الإجراءات</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>جارٍ التحميل...</td></tr> : templates.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><div className="muted" dir="ltr">{item.slug}</div></td><td>{item.employerName}</td><td><AdminStatusBadge status={item.status} /></td><td>{item.currentVersion}</td><td>{formatDate(item.updatedAt)}</td><td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="ghost sm" onClick={() => editTemplate(item)}>تعديل</button><button className="ghost sm" onClick={() => void publish(item.id)}>نشر إصدار</button><button className="ghost sm" onClick={() => void clone(item)}>نسخ النموذج</button><a className="ghost sm" href={`/jobs/${item.slug}/application`} target="_blank" rel="noreferrer">معاينة</a></td></tr>)}</tbody></table></div>
    </div>
  );

  return (
    <div className="universal-jobs-admin" dir="rtl">
      <AdminNotice tone="info">لوحة موحدة لمتابعة طلبات النماذج. الموقع المعروض مصدره المحدد الجغرافي الشامل، وتغييرات الحالة محمية برقم إصدار.</AdminNotice>
      {error ? <div className="alert" role="alert">{error}</div> : null}{notice ? <div className="alert success" role="status">{notice}</div> : null}
      <section className="admin-panel" style={{ marginBottom: 14 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}><input placeholder="الاسم، الهاتف أو رقم الطلب" value={q} onChange={(e) => setQ(e.target.value)} /><select value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)}><option value="">كل النماذج</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">كل حالات الطلب</option>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={followFilter} onChange={(e) => setFollowFilter(e.target.value)}><option value="">كل حالات المتابعة</option>{FOLLOW_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={accreditedFilter} onChange={(e) => setAccreditedFilter(e.target.value)}><option value="">كل الاعتمادات</option><option value="true">معتمد</option><option value="false">غير معتمد</option></select><input type="number" min={0} placeholder="خبرة لا تقل عن..." value={minExperience} onChange={(e) => setMinExperience(e.target.value)} /><button className="accent" onClick={() => void loadApplications()}>تطبيق الفلاتر</button></div></section>
      <div className="table-wrap"><table className="admin-table"><thead><tr><th>المتقدم</th><th>الهاتف</th><th>العمر</th><th>الموقع</th><th>الخبرة</th><th>الاعتماد</th><th>حالة الطلب</th><th>المتابعة</th><th>التاريخ</th></tr></thead><tbody>{applications.length === 0 ? <tr><td colSpan={9}>لا توجد طلبات مطابقة.</td></tr> : applications.map((item) => <tr key={item.id} onClick={() => void openApplication(item)} style={{ cursor: "pointer" }}><td><strong>{item.applicantName}</strong><div className="muted" dir="ltr">{item.reference}</div></td><td dir="ltr">{item.phone || "-"}</td><td>{item.ageYears ?? "غير مسجل"}</td><td>{[item.mohafaza, item.caza, item.village].filter(Boolean).join(" / ") || "-"}</td><td>{String(item.answers.years_experience ?? "-")}</td><td>{item.answers.accredited_driver === true ? "معتمد" : item.answers.accredited_driver === false ? "غير معتمد" : "-"}</td><td><AdminStatusBadge status={item.status} /></td><td>{item.followUpStatus}</td><td>{formatDate(item.createdAt)}</td></tr>)}</tbody></table></div>
      {selected ? <section className="admin-panel" style={{ marginTop: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><div><h3>{selected.applicantName}</h3><div className="muted" dir="ltr">{selected.reference}</div></div><button className="ghost" onClick={() => setSelected(null)}>إغلاق</button></div><p><strong>رقم الهاتف:</strong> <span dir="ltr">{selected.phone || "-"}</span></p><p><strong>الموقع:</strong> {selectedLocation || "-"}</p><p><strong>العمر:</strong> {selected.ageYears ?? "غير مسجل"}</p><p><strong>سنوات الخبرة:</strong> {String(selected.answers.years_experience ?? "-")}</p><p><strong>سائق معتمد:</strong> {selected.answers.accredited_driver === true ? "نعم" : selected.answers.accredited_driver === false ? "لا" : "-"}</p><details><summary>كل إجابات النموذج</summary><pre style={{ whiteSpace: "pre-wrap", direction: "rtl" }}>{JSON.stringify(selected.answers, null, 2)}</pre></details><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}><label><span>حالة الطلب</span><select value={selected.status} onChange={(e) => void mutateApplication({ status: e.target.value })}>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span>المتابعة</span><select value={selected.followUpStatus} onChange={(e) => void mutateApplication({ followUpStatus: e.target.value })}>{FOLLOW_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label style={{ gridColumn: "1/-1" }}><span>ملاحظات الإدارة</span><textarea rows={3} value={selected.adminNotes} onChange={(e) => setSelected((current) => current ? { ...current, adminNotes: e.target.value } : current)} onBlur={() => void mutateApplication({ adminNotes: selected.adminNotes })} /></label></div><h4>سجل التغييرات</h4>{history.length ? <ul>{history.map((entry) => <li key={`${entry.version}-${entry.createdAt}`}>الإصدار {entry.version} — {entry.eventType} — {formatDate(entry.createdAt)}</li>)}</ul> : <p className="muted">لا توجد تغييرات إدارية مسجلة بعد.</p>}</section> : null}
    </div>
  );
}
