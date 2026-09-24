import { type FormEvent, useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import { useApp } from "../store/app";

type EmployerStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
type EmployerItem = {
  user_id: string;
  organization_name: string;
  status: EmployerStatus;
  requested_at?: string;
  reviewed_at?: string | null;
  account_name?: string;
  email?: string;
};
type Summary = {
  linked_applications: number;
  linked_applicants: number;
  active_candidates: number;
  pending_employers: number;
  approved_employers: number;
};

const statusLabels: Record<EmployerStatus, string> = {
  PENDING: "بانتظار الموافقة",
  APPROVED: "معتمدون",
  REJECTED: "مرفوضون",
  SUSPENDED: "موقوفون",
};

export default function AdminEmployerPortalPage() {
  const { apiBaseUrl } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<EmployerStatus>("PENDING");
  const [employers, setEmployers] = useState<EmployerItem[]>([]);  const [candidates, setCandidates] = useState<any[]>([]);
  const [filters, setFilters] = useState({ q: "", jobType: "", governorate: "" });
  const [message, setMessage] = useState("");

  async function loadSummary() {
    const response = await authFetch(`${apiBaseUrl}/api/jobs/admin/summary`);
    if (!response.ok) return;
    const data = await response.json();
    setSummary(data.summary ?? null);
  }

  async function loadEmployers(nextStatus: EmployerStatus = status) {
    const response = await authFetch(`${apiBaseUrl}/api/jobs/employer-access/admin?status=${nextStatus}`);
    if (!response.ok) return;
    const data = await response.json();
    setEmployers(data.items ?? []);
  }

  async function updateEmployer(userId: string, nextStatus: EmployerStatus) {
    setMessage("");
    const response = await authFetch(`${apiBaseUrl}/api/jobs/employer-access/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setMessage(response.ok ? "تم تحديث حالة صاحب العمل." : "تعذّر تحديث حالة صاحب العمل.");
    if (response.ok) {
      await Promise.all([loadEmployers(), loadSummary()]);
    }
  }

  async function searchCandidates(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const params = new URLSearchParams();    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
    const response = await authFetch(`${apiBaseUrl}/api/jobs/candidates/search?${params.toString()}`);
    if (!response.ok) return;
    const data = await response.json();
    setCandidates(data.items ?? []);
  }

  useEffect(() => {
    void Promise.all([loadSummary(), loadEmployers("PENDING"), searchCandidates()]);
  }, [apiBaseUrl]);

  useEffect(() => { void loadEmployers(status); }, [status]);

  return (
    <main dir="rtl" className="mx-auto max-w-6xl p-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">إدارة التوظيف وأصحاب العمل</h1>
        <p className="text-sm text-gray-600">مركز Jobs CMS لمتابعة أصحاب العمل، طلبات المتقدمين، والمرشحين الجاهزين للعمل.</p>
      </div>

      <section className="grid gap-3 md:grid-cols-5">
        <article className="rounded-2xl border p-4"><strong>{summary?.linked_applications ?? "—"}</strong><p>طلبات مرتبطة بحسابات</p></article>
        <article className="rounded-2xl border p-4"><strong>{summary?.linked_applicants ?? "—"}</strong><p>متقدمون مرتبطون</p></article>
        <article className="rounded-2xl border p-4"><strong>{summary?.active_candidates ?? "—"}</strong><p>مرشحون جاهزون</p></article>
        <article className="rounded-2xl border p-4"><strong>{summary?.pending_employers ?? "—"}</strong><p>أصحاب عمل بانتظار الاعتماد</p></article>
        <article className="rounded-2xl border p-4"><strong>{summary?.approved_employers ?? "—"}</strong><p>أصحاب عمل معتمدون</p></article>
      </section>

      <section className="rounded-2xl border p-4 shadow-sm space-y-3">
        <h2 className="font-semibold">متابعة طلبات الوظائف</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <a className="rounded-xl border p-3 font-semibold" href="/superadmin/jobs/applications">كل الطلبات · عرض موحّد</a>          <a className="rounded-xl border p-3" href="/superadmin/ainelhafeh/applications">قطاف التفاح – عين الحفة</a>
          <a className="rounded-xl border p-3" href="/superadmin/ain-mreisseh-building-assistant/applications">مساعد مدير مبنى – عين المريسة</a>
          <a className="rounded-xl border p-3" href="/superadmin/middle-east-security/applications">ميدل إيست سيكوريتي</a>
        </div>
      </section>

      <section className="rounded-2xl border p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(statusLabels) as EmployerStatus[]).map((item) => (
            <button key={item} type="button" className={status === item ? "btn btn-primary" : "btn"} onClick={() => setStatus(item)}>
              {statusLabels[item]}
            </button>
          ))}
        </div>
        <h2 className="font-semibold">أصحاب العمل · {statusLabels[status]}</h2>
        {employers.length === 0 ? <p>لا توجد حسابات ضمن هذه الحالة.</p> : null}
        <div className="space-y-2">
          {employers.map((item) => (
            <article key={item.user_id} className="rounded-xl border p-3 space-y-2">
              <strong>{item.organization_name}</strong>
              <p>{item.account_name || "—"} · {item.email || "—"}</p>
              <div className="flex flex-wrap gap-2">
                {item.status !== "APPROVED" ? <button className="btn btn-primary" onClick={() => void updateEmployer(item.user_id, "APPROVED")}>اعتماد</button> : null}
                {item.status !== "REJECTED" ? <button className="btn" onClick={() => void updateEmployer(item.user_id, "REJECTED")}>رفض</button> : null}
                {item.status !== "SUSPENDED" ? <button className="btn" onClick={() => void updateEmployer(item.user_id, "SUSPENDED")}>إيقاف</button> : null}
                {item.status !== "PENDING" ? <button className="btn" onClick={() => void updateEmployer(item.user_id, "PENDING")}>إعادة للمراجعة</button> : null}
              </div>
            </article>
          ))}
        </div>
        {message ? <p aria-live="polite">{message}</p> : null}
      </section>
      <section className="rounded-2xl border p-4 shadow-sm space-y-3">
        <h2 className="font-semibold">قاعدة المرشحين الجاهزين للعمل</h2>
        <form onSubmit={searchCandidates} className="grid gap-2 md:grid-cols-4">
          <input className="input" placeholder="بحث بالاسم أو المهارة" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <input className="input" placeholder="نوع العمل" value={filters.jobType} onChange={(e) => setFilters({ ...filters, jobType: e.target.value })} />
          <input className="input" placeholder="المحافظة" value={filters.governorate} onChange={(e) => setFilters({ ...filters, governorate: e.target.value })} />
          <button className="btn btn-primary" type="submit">بحث</button>
        </form>
        {candidates.length === 0 ? <p>لا توجد نتائج مطابقة.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {candidates.map((item) => (
            <article key={item.id} className="rounded-xl border p-3">
              <strong>{item.candidate_name}</strong>
              <p>{item.title} · {item.job_type}</p>
              <p>{[item.locality, item.caza, item.governorate].filter(Boolean).join("، ")}</p>
              {item.skills?.length ? <p>المهارات: {item.skills.join("، ")}</p> : null}
              {item.phone ? <p dir="ltr">{item.phone}</p> : null}
              {item.email ? <p dir="ltr">{item.email}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
