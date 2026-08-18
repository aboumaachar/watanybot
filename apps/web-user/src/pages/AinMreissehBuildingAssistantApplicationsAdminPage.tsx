import { FormEvent, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import "../styles/jobs-ainmreisseh.css";

type ApplicationRow = {
  id: string;
  name: string;
  phone: string;
  age: string;
  governorateAr: string;
  cazaAr: string;
  villageAr: string;
  canWorkFullTime: boolean;
  acceptsSalary600: boolean;
  wantsHousing: boolean;
  availableStartDate: string;
  status: string;
  followUpStatus: string;
  adminNotes: string;
  createdAt: string;
};

type ListResponse = { items: ApplicationRow[]; total: number };
const STATUS_OPTIONS = ["pending", "approved", "rejected"];
const FOLLOW_UP_OPTIONS = ["not_contacted", "to_contact", "contacted", "confirmed", "no_response", "withdrawn"];
const answerLabel = (value: boolean) => value ? "نعم" : "لا";
const dateLabel = (value: string) => value ? new Date(value).toLocaleDateString("ar-LB") : "";

export default function AinMreissehBuildingAssistantApplicationsAdminPage() {
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ApplicationRow | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (followUpStatus) params.set("follow_up_status", followUpStatus);
      const response = await authFetch(`/api/superadmin/ain-mreisseh-building-assistant/applications?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as ListResponse;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const pending = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);
  const approved = useMemo(() => items.filter((item) => item.status === "approved").length, [items]);
  const rejected = useMemo(() => items.filter((item) => item.status === "rejected").length, [items]);

  async function updateApplication(id: string, patch: Record<string, unknown>) {
    const response = await authFetch(`/api/superadmin/ain-mreisseh-building-assistant/applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { item: ApplicationRow };
    setItems((current) => current.map((item) => item.id === id ? data.item : item));
    setSelected(data.item);
  }

  async function submitFilters(event: FormEvent) {
    event.preventDefault();
    await load();
  }

  return (
    <main className="ainmreisseh-page" dir="rtl">
      <section className="ainmreisseh-admin">
        <header className="ainmreisseh-admin__header">
          <div><p className="ainmreisseh-kicker">مركز الإدارة</p><h1>طلبات مساعد مدير مبنى – عين المريسة</h1></div>
          <a href="/jobs/ain-mreisseh-building-assistant">فتح صفحة الفرصة</a>
        </header>
        <section className="ainmreisseh-admin__stats" aria-label="إحصاءات الطلبات">
          <div className="ainmreisseh-admin__stat"><strong>{total}</strong><span>كل الطلبات</span></div>
          <div className="ainmreisseh-admin__stat"><strong>{pending}</strong><span>قيد المراجعة</span></div>
          <div className="ainmreisseh-admin__stat"><strong>{approved}</strong><span>مقبول</span></div>
          <div className="ainmreisseh-admin__stat"><strong>{rejected}</strong><span>مرفوض</span></div>
        </section>
        <form className="ainmreisseh-admin__filters" onSubmit={submitFilters}>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="بحث بالاسم أو الهاتف أو البلدة" />
          <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">كل الحالات</option>{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <select value={followUpStatus} onChange={(event) => setFollowUpStatus(event.target.value)}><option value="">كل المتابعة</option>{FOLLOW_UP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <button type="submit">تطبيق</button>
        </form>
        {loading ? <p>جارٍ تحميل الطلبات…</p> : null}
        {error ? <p className="ainmreisseh-message ainmreisseh-message--error" role="alert">{error}</p> : null}
        <div className="ainmreisseh-admin__table-wrap">
          <table>
            <thead><tr><th>الاسم</th><th>الهاتف</th><th>العمر</th><th>الموقع</th><th>دوام كامل</th><th>الراتب</th><th>السكن</th><th>البدء</th><th>الحالة</th><th>المتابعة</th><th>التقديم</th><th>إجراء</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}>
              <td>{item.name}</td><td>{item.phone}</td><td>{item.age}</td>
              <td>{[item.governorateAr, item.cazaAr, item.villageAr].filter(Boolean).join(" / ")}</td>
              <td>{answerLabel(item.canWorkFullTime)}</td><td>{answerLabel(item.acceptsSalary600)}</td><td>{answerLabel(item.wantsHousing)}</td>
              <td>{dateLabel(item.availableStartDate)}</td><td>{item.status}</td><td>{item.followUpStatus}</td><td>{dateLabel(item.createdAt)}</td>
              <td><button type="button" onClick={() => setSelected(item)}>عرض</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {selected ? <section className="ainmreisseh-admin__detail" aria-label="تفاصيل الطلب">
          <h2>{selected.name}</h2>
          <div>الهاتف: {selected.phone} | الموقع: {[selected.governorateAr, selected.cazaAr, selected.villageAr].filter(Boolean).join(" / ")}</div>
          <div className="ainmreisseh-admin__detail-controls">
            <label>الحالة <select value={selected.status} onChange={(event) => { void updateApplication(selected.id, { status: event.target.value }); }}><option value="pending">pending</option><option value="approved">approved</option><option value="rejected">rejected</option></select></label>
            <label>المتابعة <select value={selected.followUpStatus} onChange={(event) => { void updateApplication(selected.id, { followUpStatus: event.target.value }); }}>{FOLLOW_UP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          </div>
          <label>ملاحظات الإدارة<textarea value={selected.adminNotes} onChange={(event) => setSelected({ ...selected, adminNotes: event.target.value })} /></label>
          <button type="button" onClick={() => { void updateApplication(selected.id, { adminNotes: selected.adminNotes }); }}>حفظ الملاحظات</button>
        </section> : null}
      </section>
    </main>
  );
}
