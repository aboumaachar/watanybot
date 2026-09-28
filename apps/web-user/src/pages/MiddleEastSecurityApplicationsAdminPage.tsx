import { FormEvent, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import "../styles/jobs-ainmreisseh.css";

type Status = "pending" | "approved" | "rejected";
type FollowUpStatus = "not_contacted" | "to_contact" | "contacted" | "confirmed" | "no_response" | "withdrawn";
type ApplicationRow = {
  id: string;
  full_name: string;
  birth_date: string;
  age_years?: number;
  birth_place: string;
  address: string;
  mohafaza?: string;
  mohafaza_id?: string;
  caza?: string;
  caza_id?: string;
  village?: string;
  village_id?: string;
  village_pcode?: string;
  location_dataset_version?: string;
  location_approval_status?: string;
  phone: string;
  preferred_location: string;
  arabic_read: string;
  arabic_write: string;
  english_read: string;
  english_write: string;
  security_training: boolean;
  security_training_details?: string;
  ngo_experience: boolean;
  ngo_details?: string;
  notes?: string;
  status: Status;
  followUpStatus: FollowUpStatus;
  adminNotes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};
type HistoryEntry = {
  version: number;
  eventType: "SUBMITTED" | "MANAGEMENT_UPDATED";
  snapshot: Pick<ApplicationRow, "status" | "followUpStatus" | "adminNotes" | "version" | "updatedAt">;
  actorId: string;
  createdAt: string;
};
type ListResponse = {
  items: ApplicationRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: { total: number; pending: number; approved: number; rejected: number };
};

const STATUS_OPTIONS: Status[] = ["pending", "approved", "rejected"];
const FOLLOW_UP_OPTIONS: FollowUpStatus[] = ["not_contacted", "to_contact", "contacted", "confirmed", "no_response", "withdrawn"];
const answerLabel = (value: boolean) => value ? "نعم" : "لا";
const dateLabel = (value: string) => value ? new Date(value).toLocaleString("ar-LB") : "—";
const addressLabel = (item: Pick<ApplicationRow, "address" | "mohafaza" | "caza" | "village">) =>
  [item.village, item.caza, item.mohafaza].filter(Boolean).join("، ") || item.address || "—";
const ageLabel = (value?: number) => value == null ? "غير مسجل" : String(value);

export default function MiddleEastSecurityApplicationsAdminPage() {
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [summary, setSummary] = useState<ListResponse["summary"]>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), page_size: "25" });
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (followUpStatus) params.set("follow_up_status", followUpStatus);
      const response = await authFetch(`/api/superadmin/middle-east-security/applications?${params.toString()}`);
      if (!response.ok) throw new Error(response.status === 403 ? "لا تملك صلاحية إدارة الطلبات" : "تعذر تحميل الطلبات");
      const data = await response.json() as ListResponse;
      setItems(data.items ?? []);
      setSummary(data.summary ?? { total: data.total ?? 0, pending: 0, approved: 0, rejected: 0 });
      setTotal(data.total ?? 0);
      setPage(data.page ?? nextPage);
      setTotalPages(data.totalPages ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }

  async function selectApplication(item: ApplicationRow) {
    setSelected(item);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const response = await authFetch(`/api/superadmin/middle-east-security/applications/${encodeURIComponent(item.id)}/history`);
      if (response.ok) {
        const data = await response.json() as { items?: HistoryEntry[] };
        setHistory(data.items ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { void load(1); }, []);

  const displayedSummary = useMemo(() => ({
    total: summary.total || total,
    pending: summary.pending,
    approved: summary.approved,
    rejected: summary.rejected,
  }), [summary, total]);

  async function updateApplication(patch: Partial<Pick<ApplicationRow, "status" | "followUpStatus" | "adminNotes">>) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await authFetch(`/api/superadmin/middle-east-security/applications/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...patch, expectedVersion: selected.version }),
      });
      if (response.status === 409) {
        throw new Error("تغيّر الطلب منذ فتحه. أعد تحميله قبل الحفظ.");
      }
      if (!response.ok) throw new Error("تعذر حفظ التعديل");
      const data = await response.json() as { item: ApplicationRow };
      setSelected(data.item);
      setItems((current) => current.map((item) => item.id === data.item.id ? data.item : item));
      await selectApplication(data.item);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر حفظ التعديل");
    } finally {
      setSaving(false);
    }
  }

  async function submitFilters(event: FormEvent) {
    event.preventDefault();
    await load(1);
  }

  return (
    <main className="ainmreisseh-page" dir="rtl">
      <section className="ainmreisseh-admin">
        <header className="ainmreisseh-admin__header">
          <div>
            <p className="ainmreisseh-kicker">مركز الإدارة</p>
            <h1>طلبات ميدل إيست سيكوريتي لبنان</h1>
          </div>
          <a href="/jobs/middle-east-security">فتح صفحة الفرصة</a>
        </header>

        <section className="ainmreisseh-admin__stats" aria-label="إحصاءات الطلبات">
          <div className="ainmreisseh-admin__stat"><strong>{displayedSummary.total}</strong><span>الإجمالي</span></div>
          <div className="ainmreisseh-admin__stat"><strong>{displayedSummary.pending}</strong><span>قيد المراجعة</span></div>
          <div className="ainmreisseh-admin__stat"><strong>{displayedSummary.approved}</strong><span>مقبول</span></div>
          <div className="ainmreisseh-admin__stat"><strong>{displayedSummary.rejected}</strong><span>مرفوض</span></div>
        </section>

        <form className="ainmreisseh-admin__filters" onSubmit={submitFilters}>
          <label>
            <span>بحث</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="الاسم أو الهاتف أو المرجع" />
          </label>
          <label>
            <span>الحالة</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">كل الحالات</option>
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>المتابعة</span>
            <select value={followUpStatus} onChange={(event) => setFollowUpStatus(event.target.value)}>
              <option value="">كل المتابعة</option>
              {FOLLOW_UP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="submit" disabled={loading}>تطبيق</button>
        </form>
        {error ? <p className="ainmreisseh-message ainmreisseh-message--error" role="alert">{error}</p> : null}
        {loading ? <p aria-live="polite">جارٍ تحميل الطلبات…</p> : null}

        <div className="ainmreisseh-admin__table-wrap">
          <table>
            <thead>
              <tr><th>المرجع</th><th>الاسم</th><th>الهاتف</th><th>العنوان الإداري</th><th>الموقع المفضل</th><th>الحالة</th><th>المتابعة</th><th>التقديم</th><th>إجراء</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td><td>{item.full_name}</td><td>{item.phone}</td><td>{addressLabel(item)}</td><td>{item.preferred_location}</td>
                  <td>{item.status}</td><td>{item.followUpStatus}</td><td>{dateLabel(item.createdAt)}</td>
                  <td><button type="button" onClick={() => { void selectApplication(item); }}>عرض التفاصيل</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav aria-label="صفحات الطلبات" className="ainmreisseh-admin__detail-controls">
          <button type="button" disabled={page <= 1 || loading} onClick={() => { void load(page - 1); }}>السابق</button>
          <span>صفحة {page} من {Math.max(totalPages, 1)} · {total} طلب</span>
          <button type="button" disabled={!totalPages || page >= totalPages || loading} onClick={() => { void load(page + 1); }}>التالي</button>
        </nav>

        {selected ? (
          <section className="ainmreisseh-admin__detail" aria-label="تفاصيل الطلب">
            <h2>{selected.full_name} <small>{selected.id}</small></h2>
            <div className="ainmreisseh-admin__detail-grid">
              <div>تاريخ الميلاد: {selected.birth_date}</div><div>العمر بالسنوات: {ageLabel(selected.age_years)}</div><div>مكان الميلاد: {selected.birth_place}</div>
              <div>العنوان: {addressLabel(selected)}</div><div>الهاتف: {selected.phone}</div>
              <div>الموقع المفضل: {selected.preferred_location}</div>
              <div>العربية: قراءة {selected.arabic_read} · كتابة {selected.arabic_write}</div>
              <div>الإنكليزية: قراءة {selected.english_read} · كتابة {selected.english_write}</div>
              <div>التدريب الأمني: {answerLabel(selected.security_training)}{selected.security_training_details ? ` — ${selected.security_training_details}` : ""}</div>
              <div>الخبرة مع NGOs: {answerLabel(selected.ngo_experience)}{selected.ngo_details ? ` — ${selected.ngo_details}` : ""}</div>
              <div>ملاحظات المتقدم: {selected.notes || "—"}</div>
              <div>التقديم: {dateLabel(selected.createdAt)} · آخر تحديث: {dateLabel(selected.updatedAt)}</div>
              <div>نسخة التعديل الحالية: {selected.version}</div>
            </div>
            <div className="ainmreisseh-admin__detail-controls">
              <label>الحالة
                <select value={selected.status} disabled={saving} onChange={(event) => { void updateApplication({ status: event.target.value as Status }); }}>
                  {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>المتابعة
                <select value={selected.followUpStatus} disabled={saving} onChange={(event) => { void updateApplication({ followUpStatus: event.target.value as FollowUpStatus }); }}>
                  {FOLLOW_UP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label>ملاحظات الإدارة
              <textarea value={selected.adminNotes} disabled={saving} onChange={(event) => setSelected({ ...selected, adminNotes: event.target.value })} />
            </label>
            <button type="button" disabled={saving} onClick={() => { void updateApplication({ adminNotes: selected.adminNotes }); }}>حفظ الملاحظات</button>
            <div>
              <h3>السجل</h3>
              {historyLoading ? <p>جارٍ تحميل السجل…</p> : null}
              {!historyLoading && !history.length ? <p>لا يوجد سجل بعد.</p> : null}
              <ol>{history.map((entry) => <li key={`${entry.version}-${entry.createdAt}`}>الإصدار {entry.version} · {entry.eventType} · {entry.actorId} · {dateLabel(entry.createdAt)} · {entry.snapshot.status} · {entry.snapshot.followUpStatus}</li>)}</ol>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
