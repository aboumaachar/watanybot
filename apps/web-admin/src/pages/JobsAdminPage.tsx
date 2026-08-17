import { useEffect, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminFluentIcon } from "../components/AdminFluentIcon";

type OpportunityStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
type ApplicationStatus =
  | "NEW_APPLICATION"
  | "PROFILE_INCOMPLETE"
  | "REVIEWED"
  | "MATCHED"
  | "SENT_TO_EMPLOYER"
  | "INTERVIEW_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "FOLLOW_UP_NEEDED"
  | "CLOSED";

type Opportunity = {
  id: string;
  title: string;
  organization: string;
  location: string;
  category: string;
  summary: string;
  description: string;
  type: string;
  audience: string[];
  status: OpportunityStatus;
  adminVerified: boolean;
  applicationMethod: string;
  sourceName?: string;
  sourceUrl?: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
};

type Application = {
  id: string;
  opportunityId: string;
  applicantName: string;
  applicantPhone: string;
  applicantType: string;
  note?: string;
  status: ApplicationStatus;
  createdAt: string;
};

type Source = {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  crawlPolicy: string;
  enabled: boolean;
  notes: string;
};

const opportunityStatuses: OpportunityStatus[] = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"];
const applicationStatuses: ApplicationStatus[] = [
  "NEW_APPLICATION",
  "PROFILE_INCOMPLETE",
  "REVIEWED",
  "MATCHED",
  "SENT_TO_EMPLOYER",
  "INTERVIEW_REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "FOLLOW_UP_NEEDED",
  "CLOSED",
];

const emptyOpportunity = (): Partial<Opportunity> => ({
  title: "",
  organization: "",
  location: "",
  category: "",
  summary: "",
  description: "",
  type: "PAID_JOB",
  audience: ["PUBLIC"],
  applicationMethod: "",
  sourceName: "",
  sourceUrl: "",
  deadline: "",
  status: "DRAFT",
});

async function readItems<T>(path: string): Promise<T[]> {
  const response = await adminFetch(path);
  const data = await response.json() as { items?: T[] };
  return data.items ?? [];
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("ar-LB");
}

export default function JobsAdminPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState<Partial<Opportunity>>(emptyOpportunity());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"opportunities" | "applications" | "sources">("opportunities");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextOpportunities, nextApplications, nextSources] = await Promise.all([
        readItems<Opportunity>("/api/admin/opportunities"),
        readItems<Application>("/api/admin/opportunities/applications"),
        readItems<Source>("/api/admin/opportunities/sources"),
      ]);
      setOpportunities(nextOpportunities);
      setApplications(nextApplications);
      setSources(nextSources);
    } catch (err) {
      setError(getAdminErrorMessage(err, "تعذر تحميل إدارة فرص العمل."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateForm = (field: keyof Opportunity, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveOpportunity = async () => {
    if (!form.title?.trim() || !form.organization?.trim()) {
      setError("العنوان والجهة مطلوبان.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const path = editingId ? `/api/admin/opportunities/${editingId}` : "/api/admin/opportunities";
      const response = await adminFetch(path, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, title: form.title.trim(), organization: form.organization.trim() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setForm(emptyOpportunity());
      setEditingId(null);
      await load();
    } catch (err) {
      setError(getAdminErrorMessage(err, "تعذر حفظ الفرصة."));
    } finally {
      setSaving(false);
    }
  };

  const changeOpportunityStatus = async (id: string, action: "publish" | "archive" | "reject") => {
    try {
      await adminFetch(`/api/admin/opportunities/${id}/${action}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(getAdminErrorMessage(err, "تعذر تحديث حالة الفرصة."));
    }
  };

  const updateApplication = async (id: string, status: ApplicationStatus) => {
    try {
      await adminFetch(`/api/admin/opportunities/applications/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(getAdminErrorMessage(err, "تعذر تحديث الطلب."));
    }
  };

  const updateSource = async (source: Source, enabled: boolean) => {
    try {
      await adminFetch(`/api/admin/opportunities/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await load();
    } catch (err) {
      setError(getAdminErrorMessage(err, "تعذر تحديث المصدر."));
    }
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1180 }} dir="rtl">
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><AdminFluentIcon name="jobs" /> إدارة فرص العمل</h2>
          <p className="muted">إدارة الفرص المدنية وطلبات التقديم ومصادر الاستيراد.</p>
        </div>
        <button className="ghost" onClick={() => void load()} disabled={loading}>تحديث</button>
      </div>

      {error && <div className="alert" role="alert">{error}</div>}

      <div className="toolbar" role="tablist" aria-label="أقسام إدارة فرص العمل">
        {(["opportunities", "applications", "sources"] as const).map((value) => (
          <button key={value} className={tab === value ? "accent" : "ghost"} onClick={() => setTab(value)} role="tab" aria-selected={tab === value}>
            {value === "opportunities" ? "الفرص" : value === "applications" ? "الطلبات" : "المصادر"}
          </button>
        ))}
      </div>

      {tab === "opportunities" && (
        <>
          <section className="admin-panel" style={{ marginBottom: 20 }}>
            <h3>{editingId ? "تعديل الفرصة" : "إضافة فرصة مدنية"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {(["title", "organization", "location", "category", "applicationMethod", "sourceName", "sourceUrl", "deadline"] as const).map((field) => (
                <label key={field} style={{ display: "grid", gap: 4 }}>
                  <span>{field === "title" ? "العنوان *" : field === "organization" ? "الجهة *" : field}</span>
                  <input value={(form[field] as string) ?? ""} onChange={(event) => updateForm(field, event.target.value)} />
                </label>
              ))}
              <label style={{ display: "grid", gap: 4 }}><span>النوع</span><select value={form.type ?? "PAID_JOB"} onChange={(event) => updateForm("type", event.target.value)}><option value="PAID_JOB">وظيفة</option><option value="PART_TIME_JOB">دوام جزئي</option><option value="CONTRACT_JOB">عقد</option><option value="FREELANCE_SERVICE">خدمة حرة</option><option value="VOLUNTEER_WORK">تطوع</option><option value="INTERNSHIP">تدريب عملي</option></select></label>
              <label style={{ display: "grid", gap: 4 }}><span>الحالة</span><select value={form.status ?? "DRAFT"} onChange={(event) => updateForm("status", event.target.value)}>{opportunityStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label style={{ display: "grid", gap: 4, gridColumn: "1 / -1" }}><span>الملخص</span><textarea rows={2} value={form.summary ?? ""} onChange={(event) => updateForm("summary", event.target.value)} /></label>
              <label style={{ display: "grid", gap: 4, gridColumn: "1 / -1" }}><span>الوصف</span><textarea rows={3} value={form.description ?? ""} onChange={(event) => updateForm("description", event.target.value)} /></label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="accent" onClick={() => void saveOpportunity()} disabled={saving}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة الفرصة"}</button>{editingId && <button className="ghost" onClick={() => { setEditingId(null); setForm(emptyOpportunity()); }}>إلغاء</button>}</div>
          </section>

          <div className="table-wrap"><table className="admin-table"><thead><tr><th>العنوان</th><th>الجهة</th><th>الموقع</th><th>الحالة</th><th>آخر تحديث</th><th>الإجراءات</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="muted center">جارٍ التحميل...</td></tr> : opportunities.length === 0 ? <tr><td colSpan={6} className="muted center">لا توجد فرص.</td></tr> : opportunities.map((item) => <tr key={item.id}><td className="strong">{item.title}</td><td>{item.organization}</td><td>{item.location || "-"}</td><td><select value={item.status} onChange={(event) => { const next = event.target.value as OpportunityStatus; void adminFetch(`/api/admin/opportunities/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then(() => load()); }}>{opportunityStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td className="muted">{formatDate(item.updatedAt)}</td><td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="ghost sm" onClick={() => { setEditingId(item.id); setForm(item); }}>تعديل</button>{item.status !== "PUBLISHED" && <button className="ghost sm" onClick={() => void changeOpportunityStatus(item.id, "publish")}>نشر</button>}{item.status !== "ARCHIVED" && <button className="ghost sm danger" onClick={() => void changeOpportunityStatus(item.id, "archive")}>أرشفة</button>}</td></tr>)}</tbody></table></div>
        </>
      )}

      {tab === "applications" && <div className="table-wrap"><table className="admin-table"><thead><tr><th>المتقدم</th><th>الهاتف</th><th>الفرصة</th><th>الفئة</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>{applications.length === 0 ? <tr><td colSpan={6} className="muted center">لا توجد طلبات.</td></tr> : applications.map((item) => <tr key={item.id}><td className="strong">{item.applicantName}</td><td dir="ltr">{item.applicantPhone}</td><td>{opportunities.find((opportunity) => opportunity.id === item.opportunityId)?.title ?? item.opportunityId}</td><td>{item.applicantType}</td><td><select value={item.status} onChange={(event) => void updateApplication(item.id, event.target.value as ApplicationStatus)}>{applicationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td className="muted">{formatDate(item.createdAt)}</td></tr>)}</tbody></table></div>}

      {tab === "sources" && <div className="table-wrap"><table className="admin-table"><thead><tr><th>المصدر</th><th>النوع</th><th>سياسة الجمع</th><th>الرابط</th><th>مفعل</th></tr></thead><tbody>{sources.length === 0 ? <tr><td colSpan={5} className="muted center">لا توجد مصادر.</td></tr> : sources.map((source) => <tr key={source.id}><td className="strong">{source.name}</td><td>{source.sourceType}</td><td>{source.crawlPolicy}</td><td><a href={source.url} target="_blank" rel="noreferrer">فتح المصدر</a></td><td><input type="checkbox" checked={source.enabled} onChange={(event) => void updateSource(source, event.target.checked)} aria-label={`تفعيل ${source.name}`} /></td></tr>)}</tbody></table></div>}
    </div>
  );
}
