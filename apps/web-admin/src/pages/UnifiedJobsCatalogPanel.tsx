import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminNotice, AdminStatusBadge } from "../components/admin/AdminPrimitives";
import { AddressWidgetFieldAdapter, type AddressWidgetValue } from "@watany/address-network";
import FormCreatorPlugin, { type FormCreatorField } from "../components/forms/FormCreatorPlugin";

type LegacyOpportunity = {
  id: string; title: string; organization: string; location?: string; status: string;
  updatedAt?: string; createdAt?: string;
};
type BuilderField = {
  fieldKey: string; label: string; fieldType: string; required: boolean;
  placeholder: string; helpText: string; options: string[];
};
type BuilderJob = {
  id: string; organization_name: string; title: string; slug: string; summary?: string;
  description?: string; employment_type?: string; work_mode?: string; governorate?: string;
  caza?: string; locality?: string; salary_text?: string; status: string;
  application_count?: number; closes_at?: string; created_at?: string; updated_at?: string;
  collect_applications?: boolean; location_data?: AddressWidgetValue; application_form_id?: string; application_form_version?: number;
};
type TemplateJob = {
  id: string; slug: string; employerName: string; name: string; titleAr: string; jobId?: string;
  employmentType: string; status: string; currentVersion: number; updatedAt: string;
};
type MarketplaceJob = {
  id: string; title_ar: string; status: "draft" | "active" | "paused" | "closed" | "filled";
  location_city?: string; job_type?: string; applications_count?: number; published_at?: string;
  employer?: { company_name?: string } | null;
};
type SharedForm = { id: string; slug: string; name: string; status: string; currentVersion: number };
type BuilderForm = {
  title: string; organizationName: string; slug: string; summary: string; description: string;
  employmentType: string; workMode: string; locationData: AddressWidgetValue; applicationFormId: string;
  salaryText: string; closesAt: string; collectApplications: boolean;
};
type CatalogKind = "campaign" | "builder" | "template" | "legacy" | "marketplace";
type CatalogRow = {
  key: string; kind: CatalogKind; id: string; title: string; organization: string; location: string;
  status: string; applications: number | null; updatedAt?: string; publicPath?: string; managePath?: string;
};
type Props = {
  legacyOpportunities: LegacyOpportunity[];
  onEditLegacy: (id: string) => void;
  onOpenTemplates: (templateId?: string) => void;
  onOpenTemplateApplications: (templateId: string) => void;
};

const EMPTY_FORM: BuilderForm = { title: "", organizationName: "", slug: "", summary: "", description: "", employmentType: "FULL_TIME", workMode: "ONSITE", locationData: {}, applicationFormId: "", salaryText: "", closesAt: "", collectApplications: true };
const DEFAULT_FIELD = (): BuilderField => ({ fieldKey: `question_${Date.now()}`, label: "", fieldType: "text", required: false, placeholder: "", helpText: "", options: [] });
const BUILDER_STATUSES = ["DRAFT", "PUBLISHED", "SUSPENDED", "CLOSED", "ARCHIVED"] as const;
const MARKET_STATUSES = ["draft", "active", "paused", "closed", "filled"] as const;
const STATIC_CAMPAIGNS: CatalogRow[] = [
  { key: "campaign:ainelhafeh", kind: "campaign", id: "ainelhafeh", title: "قطاف التفاح في عين الحفة – تنورين", organization: "موطني", location: "عين الحفة – تنورين", status: "PUBLISHED", applications: null, publicPath: "/jobs/ainelhafeh", managePath: "/jobs/ainelhafeh" },
  { key: "campaign:ain-mreisseh", kind: "campaign", id: "ain-mreisseh", title: "مساعد مدير مبنى – عين المريسة", organization: "موطني", location: "عين المريسة – بيروت", status: "PUBLISHED", applications: null, publicPath: "/jobs/ain-mreisseh-building-assistant", managePath: "/jobs/ain-mreisseh-building-assistant" },
  { key: "campaign:middle-east-security", kind: "campaign", id: "middle-east-security", title: "فرصة عمل في الأمن والحماية", organization: "ميدل إيست سيكوري لبنان", location: "لبنان", status: "PUBLISHED", applications: null, publicPath: "/jobs/middle-east-security", managePath: "/jobs/middle-east-security" },
];

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("ar-LB");
}
function locationOf(job: BuilderJob) { const location = job.location_data; return [location?.governorateName || job.governorate, location?.cazaName || job.caza, location?.villageName || location?.municipalityName || job.locality, location?.manualText].filter(Boolean).join(" / ") || "-"; }
function apiErrorMessage(error: unknown) { return getAdminErrorMessage(error, "تعذر تحميل جميع مصادر الوظائف."); }
function toCreatorFields(items: BuilderField[]): FormCreatorField[] {
  return items.map((field) => ({ key: field.fieldKey, label: field.label, type: field.fieldType as FormCreatorField["type"], required: field.required, placeholder: field.placeholder, helpText: field.helpText, options: field.options }));
}
function fromCreatorFields(items: FormCreatorField[]): BuilderField[] {
  return items.map((field) => ({ fieldKey: field.key, label: field.label, fieldType: field.type, required: Boolean(field.required), placeholder: field.placeholder || "", helpText: field.helpText || "", options: field.options || [] }));
}
function legacyLocation(job: BuilderJob): AddressWidgetValue {
  if (job.location_data && Object.keys(job.location_data).length) return job.location_data;
  return { governorateName: job.governorate, cazaName: job.caza, villageName: job.locality };
}
function hasLocationSelection(value: AddressWidgetValue): boolean {
  const administrative = Boolean(value.governorateId || value.governorateName || value.cazaId || value.cazaName || value.municipalityId || value.municipalityName || value.villageId || value.villageName || value.manualText);
  const coordinates = typeof value.latitude === "number" && Number.isFinite(value.latitude) && typeof value.longitude === "number" && Number.isFinite(value.longitude);
  return administrative || coordinates;
}

export default function UnifiedJobsCatalogPanel({ legacyOpportunities, onEditLegacy, onOpenTemplates, onOpenTemplateApplications }: Readonly<Props>) {
  const navigate = useNavigate();
  const [builderJobs, setBuilderJobs] = useState<BuilderJob[]>([]);
  const [templateJobs, setTemplateJobs] = useState<TemplateJob[]>([]);
  const [marketJobs, setMarketJobs] = useState<MarketplaceJob[]>([]);
  const [sharedForms, setSharedForms] = useState<SharedForm[]>([]);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"" | CatalogKind>("");
  const [builderEditingId, setBuilderEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BuilderForm>(EMPTY_FORM);
  const [fields, setFields] = useState<BuilderField[]>([DEFAULT_FIELD()]);

  const loadSources = async () => {
    setLoading(true); setError(""); setSourceErrors([]);
    const failures: string[] = [];
    const [builderResult, templateResult, marketResult, sharedFormsResult] = await Promise.allSettled([
      adminFetch("/api/jobs/builder/jobs/mine"),
      adminFetch("/api/jobs/application-templates/manage"),
      adminFetch("/api/v2/jobs/admin/jobs"),
      adminFetch("/api/admin/forms?status=PUBLISHED"),
    ]);
    if (builderResult.status === "fulfilled" && builderResult.value.ok) {
      const data = await builderResult.value.json() as { items?: BuilderJob[] };
      setBuilderJobs(data.items || []);
    } else { setBuilderJobs([]); failures.push("منشئ الوظائف"); }
    if (templateResult.status === "fulfilled" && templateResult.value.ok) {
      const data = await templateResult.value.json() as { items?: TemplateJob[] };
      setTemplateJobs(data.items || []);
    } else { setTemplateJobs([]); failures.push("نماذج التوظيف"); }
    if (marketResult.status === "fulfilled" && marketResult.value.ok) {
      const data = await marketResult.value.json() as { jobs?: MarketplaceJob[] };
      setMarketJobs(data.jobs || []);
    } else { setMarketJobs([]); failures.push("وظائف السوق"); }
    if (sharedFormsResult.status === "fulfilled" && sharedFormsResult.value.ok) {
      const data = await sharedFormsResult.value.json() as { items?: SharedForm[] };
      setSharedForms(data.items || []);
    } else { setSharedForms([]); failures.push("النماذج المشتركة"); }
    setSourceErrors(failures);
    setLoading(false);
  };

  useEffect(() => { void loadSources().catch((reason) => { setLoading(false); setError(apiErrorMessage(reason)); }); }, []);

  const catalog = useMemo<CatalogRow[]>(() => {
    const linkedLegacyIds = new Set(templateJobs.map((job) => job.jobId).filter((value): value is string => Boolean(value)));
    return [
      ...STATIC_CAMPAIGNS,
      ...builderJobs.map((job) => ({ key: `builder:${job.id}`, kind: "builder" as const, id: job.id, title: job.title, organization: job.organization_name || "-", location: locationOf(job), status: job.status, applications: Number(job.application_count ?? 0), updatedAt: job.updated_at || job.created_at, publicPath: job.status === "PUBLISHED" ? `/jobs/opportunities/${job.slug}` : undefined })),
      ...templateJobs.map((job) => ({ key: `template:${job.id}`, kind: "template" as const, id: job.id, title: job.titleAr || job.name, organization: job.employerName || "-", location: "-", status: job.status, applications: null, updatedAt: job.updatedAt, publicPath: `/jobs/${job.slug}/application` })),
      ...marketJobs.map((job) => ({ key: `market:${job.id}`, kind: "marketplace" as const, id: job.id, title: job.title_ar, organization: job.employer?.company_name || "السوق", location: job.location_city || "-", status: job.status, applications: Number(job.applications_count ?? 0), updatedAt: job.published_at, managePath: "/market" })),
      ...legacyOpportunities.filter((job) => !linkedLegacyIds.has(job.id)).map((job) => ({ key: `legacy:${job.id}`, kind: "legacy" as const, id: job.id, title: job.title, organization: job.organization || "-", location: job.location || "-", status: job.status, applications: null, updatedAt: job.updatedAt || job.createdAt })),
    ];
  }, [builderJobs, templateJobs, marketJobs, legacyOpportunities]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ar");
    return catalog.filter((row) => (!kindFilter || row.kind === kindFilter) && (!needle || `${row.title} ${row.organization} ${row.location} ${row.status}`.toLocaleLowerCase("ar").includes(needle)));
  }, [catalog, query, kindFilter]);

  const updateForm = (field: keyof BuilderForm, value: BuilderForm[keyof BuilderForm]) => setForm((current) => ({ ...current, [field]: value }));
  const resetBuilder = () => { setBuilderEditingId(null); setForm(EMPTY_FORM); setFields([DEFAULT_FIELD()]); setError(""); };

  const editBuilder = async (id: string) => {
    setError(""); setNotice("");
    try {
      const response = await adminFetch(`/api/jobs/builder/jobs/${id}/manage`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { item: BuilderJob & { fields?: BuilderField[] } };
      const item = data.item;
      setBuilderEditingId(item.id);
      setForm({ title: item.title || "", organizationName: item.organization_name || "", slug: item.slug || "", summary: item.summary || "", description: item.description || "", employmentType: item.employment_type || "FULL_TIME", workMode: item.work_mode || "ONSITE", locationData: legacyLocation(item), applicationFormId: item.application_form_id || "", salaryText: item.salary_text || "", closesAt: item.closes_at ? String(item.closes_at).slice(0, 16) : "", collectApplications: item.collect_applications !== false });
      setFields(item.fields?.length ? item.fields.map((field) => ({ ...field, placeholder: field.placeholder || "", helpText: field.helpText || "", options: field.options || [] })) : [DEFAULT_FIELD()]);
      document.getElementById("unified-job-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (reason) { setError(getAdminErrorMessage(reason, "تعذر فتح الوظيفة للتعديل.")); }
  };
  const saveBuilder = async (publish: boolean) => {
    if (!form.title.trim() || !form.organizationName.trim()) { setError("عنوان الوظيفة وجهة العمل مطلوبان."); return; }
    if (!hasLocationSelection(form.locationData)) { setError("\u0645\u0643\u0627\u0646 \u0627\u0644\u0639\u0645\u0644 \u0639\u0628\u0631 \u0627\u0644\u0645\u062d\u062f\u062f \u0627\u0644\u062c\u063a\u0631\u0627\u0641\u064a \u0627\u0644\u0634\u0627\u0645\u0644 \u0645\u0637\u0644\u0648\u0628 \u0642\u0628\u0644 \u062d\u0641\u0638 \u0627\u0644\u0648\u0638\u064a\u0641\u0629."); return; }
    const normalizedFields = fields.filter((field) => field.label.trim() || field.fieldKey.trim());
    if (normalizedFields.some((field) => !field.label.trim() || !field.fieldKey.trim())) { setError("كل سؤال يحتاج عنواناً ومفتاحاً ثابتاً."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = { ...form, title: form.title.trim(), organizationName: form.organizationName.trim(), closesAt: form.closesAt || null, locationData: form.locationData, fields: normalizedFields };
      const path = builderEditingId ? `/api/jobs/builder/jobs/${builderEditingId}` : "/api/jobs/builder/jobs";
      const response = await adminFetch(path, { method: builderEditingId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { item?: BuilderJob; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || `HTTP ${response.status}`);
      if (publish) {
        const publishResponse = await adminFetch(`/api/jobs/builder/jobs/${data.item.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "PUBLISHED" }) });
        if (!publishResponse.ok) throw new Error(`PUBLISH_HTTP_${publishResponse.status}`);
      }
      setNotice(publish ? "تم حفظ الوظيفة ونشرها." : "تم حفظ الوظيفة كمسودة.");
      resetBuilder();
      await loadSources();
    } catch (reason) { setError(getAdminErrorMessage(reason, "تعذر حفظ الوظيفة. تحقق من بيانات الإعلان وإعدادات التقديم.")); }
    finally { setSaving(false); }
  };

  const changeBuilderStatus = async (id: string, status: string) => {
    setError("");
    const response = await adminFetch(`/api/jobs/builder/jobs/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) { setError(`تعذر تحديث حالة الوظيفة (HTTP ${response.status}).`); return; }
    await loadSources();
  };
  const duplicateBuilder = async (id: string) => {
    setError(""); setNotice("");
    try {
      const response = await adminFetch(`/api/jobs/builder/jobs/${id}/duplicate`, { method: "POST" });
      const data = await response.json() as { item?: BuilderJob; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || `HTTP ${response.status}`);
      await loadSources();
      await editBuilder(data.item.id);
      setNotice("تم استنساخ الوظيفة كقالب مسودة مستقل.");
    } catch (reason) { setError(getAdminErrorMessage(reason, "تعذر استنساخ الوظيفة كقالب.")); }
  };

  const deleteBuilder = async (row: CatalogRow) => {
    const confirmation = globalThis.prompt(`لحذف الوظيفة نهائياً، اكتب العنوان كما هو:
${row.title}`);
    if (confirmation === null) return;
    if (confirmation !== row.title) { setError("لم يتطابق تأكيد الحذف مع عنوان الوظيفة."); return; }
    setError(""); setNotice("");
    try {
      const response = await adminFetch(`/api/jobs/builder/jobs/${row.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmTitle: confirmation }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (builderEditingId === row.id) resetBuilder();
      setNotice("تم حذف الوظيفة وسجلات التقديم التابعة لها.");
      await loadSources();
    } catch (reason) { setError(getAdminErrorMessage(reason, "تعذر حذف الوظيفة.")); }
  };

  const changeMarketplaceStatus = async (id: string, status: string) => {
    setError("");
    const response = await adminFetch(`/api/v2/jobs/admin/jobs/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) { setError(`تعذر تحديث حالة وظيفة السوق (HTTP ${response.status}).`); return; }
    await loadSources();
  };

  const manageRow = (row: CatalogRow) => {
    if (row.kind === "builder") { void editBuilder(row.id); return; }
    if (row.kind === "template") { onOpenTemplateApplications(row.id); return; }
    if (row.kind === "legacy") { onEditLegacy(row.id); return; }
    if (row.kind === "marketplace") { navigate("/market"); return; }
    if (row.managePath?.startsWith("/")) { navigate(row.managePath); return; }
    if (row.managePath) window.open(row.managePath, "_blank", "noopener,noreferrer");
  };

  const renderRowActions = (row: CatalogRow) => {
    if (row.kind === "builder") return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button className="ghost sm" type="button" onClick={() => void editBuilder(row.id)}>تعديل</button>
      {row.status === "PUBLISHED" ? <button className="ghost sm" type="button" onClick={() => void changeBuilderStatus(row.id, "SUSPENDED")}>تعليق</button> : null}
      {row.status === "SUSPENDED" ? <button className="ghost sm" type="button" onClick={() => void changeBuilderStatus(row.id, "PUBLISHED")}>إعادة النشر</button> : null}
      <button className="ghost sm" type="button" onClick={() => void duplicateBuilder(row.id)}>استنساخ كقالب</button>
      {row.publicPath ? <a className="ghost sm" href={row.publicPath} target="_blank" rel="noreferrer">معاينة</a> : null}
      <button className="ghost sm danger" type="button" onClick={() => void deleteBuilder(row)}>حذف</button>
    </div>;
    return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button className="ghost sm" type="button" onClick={() => manageRow(row)}>إدارة الطلبات</button>
      {row.kind === "template" ? <button className="ghost sm" type="button" onClick={() => onOpenTemplates(row.id)}>تعديل النموذج</button> : null}
      {row.publicPath ? <a className="ghost sm" href={row.publicPath} target="_blank" rel="noreferrer">معاينة</a> : null}
    </div>;
  };

  const sourceLabel = (kind: CatalogKind) => kind === "builder" ? "وظيفة متكاملة" : kind === "template" ? "نموذج توظيف" : kind === "legacy" ? "فرصة مدنية" : kind === "marketplace" ? "سوق الوظائف" : "حملة متخصصة";

  return (
    <div className="unified-jobs-catalog" dir="rtl">
      <AdminNotice tone={sourceErrors.length ? "warning" : "info"}>
        {sourceErrors.length ? `القائمة المعروضة غير مكتملة: تعذر تحميل ${sourceErrors.join("، ")}.` : "هذه القائمة تجمع مالكي الوظائف الحاليين في شاشة واحدة مع إبقاء كل تعديل لدى مالكه الأصلي لمنع ازدواج البيانات."}
      </AdminNotice>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {notice ? <div className="alert success" role="status">{notice}</div> : null}
      <section className="admin-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 12 }}>
          <div><strong>{catalog.length}</strong><div className="muted">كل السجلات الوظيفية</div></div>
          <div><strong>{builderJobs.length}</strong><div className="muted">وظائف متكاملة</div></div>
          <div><strong>{templateJobs.length}</strong><div className="muted">نماذج توظيف</div></div>
          <div><strong>{legacyOpportunities.length}</strong><div className="muted">فرص مدنية</div></div>
          <div><strong>{marketJobs.length}</strong><div className="muted">وظائف السوق</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <input aria-label="البحث في كل الوظائف" placeholder="ابحث بالعنوان، الجهة، المنطقة أو الحالة" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="تصفية حسب مصدر الإدارة" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "" | CatalogKind)}>
            <option value="">كل مصادر الإدارة</option>
            <option value="builder">وظائف متكاملة</option><option value="template">نماذج توظيف</option><option value="legacy">فرص مدنية</option><option value="marketplace">سوق الوظائف</option><option value="campaign">حملات متخصصة</option>
          </select>
          <button className="ghost" type="button" disabled={loading} onClick={() => void loadSources()}>{loading ? "جارٍ التحديث..." : "تحديث القائمة"}</button>
        </div>
      </section>

      <section id="unified-job-editor" className="admin-panel" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
          <div><h3>{builderEditingId ? "تعديل وظيفة متكاملة" : "إنشاء وظيفة متكاملة"}</h3><p className="muted">إنشاء منظم مع نموذج تقديم قابل للتخصيص. الاسم والهاتف والبريد حقول أساسية تلقائية للمتقدم.</p></div>
          {builderEditingId ? <button className="ghost" type="button" onClick={resetBuilder}>إلغاء التعديل</button> : null}
        </div>        <h4>المعلومات الأساسية</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <label><span>عنوان الوظيفة *</span><input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="مثال: موظف أمن وحماية" /></label>
          <label><span>جهة العمل *</span><input value={form.organizationName} onChange={(event) => updateForm("organizationName", event.target.value)} placeholder="اسم الشركة أو الجهة" /></label>
          <label><span>الرابط المختصر</span><input dir="ltr" value={form.slug} onChange={(event) => updateForm("slug", event.target.value)} placeholder="security-officer" /></label>
          <label><span>نوع الدوام</span><select value={form.employmentType} onChange={(event) => updateForm("employmentType", event.target.value)}><option value="FULL_TIME">دوام كامل</option><option value="PART_TIME">دوام جزئي</option><option value="CONTRACT">عقد</option><option value="FREELANCE">عمل حر</option><option value="INTERNSHIP">تدريب عملي</option></select></label>
          <label><span>نمط العمل</span><select value={form.workMode} onChange={(event) => updateForm("workMode", event.target.value)}><option value="ONSITE">حضوري</option><option value="HYBRID">هجين</option><option value="REMOTE">عن بُعد</option><option value="FIELD">ميداني</option></select></label>
          <label><span>الراتب / التعويض</span><input value={form.salaryText} onChange={(event) => updateForm("salaryText", event.target.value)} placeholder="بحسب المؤهلات" /></label>
          <label><span>إغلاق باب التقديم</span><input type="datetime-local" value={form.closesAt} onChange={(event) => updateForm("closesAt", event.target.value)} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={form.collectApplications} onChange={(event) => updateForm("collectApplications", event.target.checked)} /><span>استقبال طلبات التقديم داخل موطني</span></label>
        </div>
        <p className="muted">يمكن نشر الوظيفة من دون نموذج تقديم. عند إيقاف هذا الخيار يظهر الإعلان للزوار من دون جمع طلبات داخل المنصة.</p>
        <h4>مكان العمل — المحدد الجغرافي الشامل</h4>
        <AddressWidgetFieldAdapter
          name="job-location"
          value={form.locationData}
          onChange={(value) => updateForm("locationData", value)}
          required
          helperText="حدّد الموقع الإداري المعتمد للوظيفة. يمكن إضافة إحداثيات أو عنوان يدوي عند الحاجة."
          featureFlags={{ gpsEnabled: true, mapEnabled: true, manualPinEnabled: true }}
        />
        <label style={{ display: "grid", gap: 4, marginTop: 10 }}><span>الملخص</span><textarea rows={2} value={form.summary} onChange={(event) => updateForm("summary", event.target.value)} placeholder="ملخص قصير يظهر في بطاقة الوظيفة" /></label>
        <label style={{ display: "grid", gap: 4, marginTop: 10 }}><span>الوصف الكامل</span><textarea rows={5} value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="المهام، الشروط، الخبرة المطلوبة، ساعات العمل وأي تفاصيل مهمة" /></label>
        {form.collectApplications ? <section style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <label><span>نموذج التقديم</span><select value={form.applicationFormId} onChange={(event) => updateForm("applicationFormId", event.target.value)}>
            <option value="">نموذج خاص بهذه الوظيفة</option>
            {sharedForms.map((item) => <option key={item.id} value={item.id}>{item.name} — الإصدار {item.currentVersion}</option>)}
          </select></label>
          {form.applicationFormId ? <AdminNotice tone="info">سيتم تثبيت الإصدار المنشور الحالي من النموذج المشترك داخل الوظيفة عند الحفظ، بحيث لا تغيّر الإصدارات المستقبلية الطلبات الجارية تلقائياً.</AdminNotice> : <FormCreatorPlugin
            title="منشئ نموذج التقديم"
            description="ابنِ نموذجاً خاصاً بهذه الوظيفة، أو اختر أعلاه نموذجاً منشوراً قابلاً لإعادة الاستخدام."
            fields={toCreatorFields(fields)}
            onChange={(nextFields) => setFields(fromCreatorFields(nextFields))}
          />}
        </section> : <AdminNotice tone="info">جمع الطلبات متوقف لهذه الوظيفة؛ يمكن نشر الإعلان بدون نموذج تقديم.</AdminNotice>}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="ghost" type="button" disabled={saving} onClick={() => void saveBuilder(false)}>{saving ? "جارٍ الحفظ..." : "حفظ كمسودة"}</button>
          <button className="accent" type="button" disabled={saving} onClick={() => void saveBuilder(true)}>{saving ? "جارٍ الحفظ..." : "حفظ ونشر"}</button>
        </div>
      </section>

      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>الوظيفة</th><th>الجهة</th><th>مصدر الإدارة</th><th>الموقع</th><th>الحالة</th><th>الطلبات</th><th>آخر تحديث</th><th>الإجراءات</th></tr></thead>
          <tbody>
            {loading && catalog.length === 0 ? <tr><td colSpan={8} className="muted center">جارٍ تحميل كل الوظائف...</td></tr> : null}
            {!loading && filtered.length === 0 ? <tr><td colSpan={8} className="muted center">لا توجد وظائف مطابقة.</td></tr> : null}
            {filtered.map((row) => <tr key={row.key}>
              <td><strong>{row.title}</strong><div className="muted" dir="ltr">{row.id}</div></td>
              <td>{row.organization}</td><td>{sourceLabel(row.kind)}</td><td>{row.location}</td>
              <td>{row.kind === "builder" ? <select aria-label={`حالة ${row.title}`} value={row.status} onChange={(event) => void changeBuilderStatus(row.id, event.target.value)}>{BUILDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select> : row.kind === "marketplace" ? <select aria-label={`حالة ${row.title}`} value={row.status} onChange={(event) => void changeMarketplaceStatus(row.id, event.target.value)}>{MARKET_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select> : <AdminStatusBadge status={row.status} />}</td>
              <td>{row.applications == null ? "-" : row.applications}</td><td className="muted">{formatDate(row.updatedAt)}</td>
              <td>{renderRowActions(row)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
