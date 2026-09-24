import { type FormEvent, useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import { useApp } from "../store/app";

type ApplicationItem = {
  userId: string;
  applicationId: string;
  campaignId: string;
  label: string;
  name: string;
  phone?: string;
  email?: string;
  age?: string;
  status: string;
  followUpStatus?: string;
  createdAt?: string;
  location?: string;
  adminHref: string;
};

const campaigns = [
  ["", "كل الحملات"],
  ["seasonal-apple-job-2026-tannourine", "قطاف التفاح في تنورين"],
  ["ain-mreisseh-building-assistant", "مساعد مبنى - عين المريسة"],
] as const;

const statuses = ["", "pending_review", "pending", "accepted", "approved", "waitlist", "rejected", "withdrawn"];

export default function AdminJobApplicationsPage() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [filters, setFilters] = useState({ q: "", campaign: "", status: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
    try {
      const response = await authFetch(`${apiBaseUrl}/api/jobs/admin/applications?${params.toString()}`);
      if (!response.ok) throw new Error("LOAD_FAILED");
      const data = await response.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setMessage("تعذّر تحميل الطلبات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [apiBaseUrl]);

  return (
    <main dir="rtl" className="mx-auto max-w-6xl p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">متابعة طلبات الوظائف</h1>
        <p className="text-sm text-gray-600">عرض موحّد لطلبات الحملات المرتبطة بحسابات المستخدمين. التعديل التفصيلي يبقى داخل لوحة كل حملة.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href="/superadmin/jobs">Jobs CMS</a>
        <a className="btn" href="/superadmin/jobs/employers">أصحاب العمل</a>
      </div>

      <form onSubmit={load} className="grid gap-2 rounded-2xl border p-4 md:grid-cols-4">
        <input className="input" placeholder="الاسم، الهاتف، البريد أو رقم الطلب" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select className="input" value={filters.campaign} onChange={(e) => setFilters({ ...filters, campaign: e.target.value })}>
          {campaigns.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          {statuses.map((value) => <option key={value} value={value}>{value || "كل الحالات"}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">بحث</button>
      </form>

      {message ? <p role="alert">{message}</p> : null}
      {loading ? <p>جارٍ التحميل…</p> : <p className="text-sm text-gray-600">النتائج: {items.length}</p>}

      <section className="grid gap-3">
        {items.map((item) => (
          <article key={`${item.campaignId}:${item.applicationId}`} className="rounded-2xl border p-4 shadow-sm space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{item.name}</h2>
                <p className="text-sm">{item.label} · {item.location || "—"}</p>
                <p className="text-xs text-gray-500" dir="ltr">{item.applicationId}</p>
              </div>
              <div className="text-sm">
                <p>الحالة: <strong>{item.status || "—"}</strong></p>
                <p>المتابعة: <strong>{item.followUpStatus || "—"}</strong></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {item.phone ? <span dir="ltr">{item.phone}</span> : null}
              {item.email ? <span dir="ltr">{item.email}</span> : null}
              {item.age ? <span>العمر: {item.age}</span> : null}
            </div>
            <a className="btn btn-primary" href={item.adminHref}>فتح إدارة الطلب</a>
          </article>
        ))}
      </section>
    </main>
  );
}
