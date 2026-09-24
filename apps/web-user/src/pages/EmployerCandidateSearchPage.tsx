import { type FormEvent, useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import { useApp } from "../store/app";

export default function EmployerCandidateSearchPage() {
  const { apiBaseUrl, profile } = useApp();
  const [access, setAccess] = useState<any>(undefined);
  const [organizationName, setOrganizationName] = useState("");
  const [filters, setFilters] = useState({ q: "", jobType: "", governorate: "", workMode: "" });
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const isAdmin = profile.role === "admin" || profile.role === "superadmin";
  const canSearch = isAdmin || access?.status === "APPROVED";

  async function loadAccess() {
    const response = await authFetch(`${apiBaseUrl}/api/jobs/employer-access/me`);
    if (!response.ok) return setAccess(null);
    const data = await response.json();
    setAccess(data.item ?? null);
  }

  useEffect(() => { void loadAccess(); }, [apiBaseUrl]);

  async function requestAccess() {
    const response = await authFetch(`${apiBaseUrl}/api/jobs/employer-access/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName }),
    });
    setMessage(response.ok ? "تم إرسال طلب اعتماد صاحب العمل." : "تعذّر إرسال طلب الاعتماد.");
    if (response.ok) await loadAccess();
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
    const response = await authFetch(`${apiBaseUrl}/api/jobs/candidates/search?${params.toString()}`);
    if (response.status === 403) {
      setMessage("البحث متاح فقط لأصحاب العمل المعتمدين.");
      setItems([]);
      return;
    }
    if (!response.ok) {
      setMessage("تعذّر تنفيذ البحث.");
      return;
    }
    const data = await response.json();
    setItems(data.items ?? []);
    setMessage("");
  }

  if (access === undefined && !isAdmin) {
    return <main className="page-shell" dir="rtl"><p>جارٍ تحميل صلاحية صاحب العمل…</p></main>;
  }

  if (!canSearch) {
    return (
      <main className="page-shell" dir="rtl">
        <section className="profile-section-card">
          <h1>البحث عن مرشحين</h1>
          <p>يحتاج حساب الشركة إلى اعتماد قبل الوصول إلى بيانات المرشحين.</p>
          {access ? <p>حالة الطلب: {access.status}</p> : null}
          <label className="profile-field">
            <span>اسم الشركة أو المؤسسة</span>
            <input className="input" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => void requestAccess()} disabled={!organizationName.trim()}>
            طلب اعتماد صاحب عمل
          </button>
          {message ? <p aria-live="polite">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell" dir="rtl">
      <section className="profile-section-card">
        <h1>البحث عن مرشحين</h1>
        <form onSubmit={search} className="profile-fields-stack">
          <label className="profile-field"><span>بحث</span><input className="input" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
          <label className="profile-field"><span>نوع العمل</span><input className="input" value={filters.jobType} onChange={(e) => setFilters({ ...filters, jobType: e.target.value })} /></label>
          <label className="profile-field"><span>المحافظة</span><input className="input" value={filters.governorate} onChange={(e) => setFilters({ ...filters, governorate: e.target.value })} /></label>
          <label className="profile-field"><span>نمط العمل</span><input className="input" value={filters.workMode} onChange={(e) => setFilters({ ...filters, workMode: e.target.value })} /></label>
          <button type="submit" className="btn btn-primary">بحث</button>
        </form>
        {message ? <p aria-live="polite">{message}</p> : null}
      </section>
      <section className="profile-section-card">
        <h2>المرشحون</h2>
        {items.length === 0 ? <p>لا توجد نتائج بعد.</p> : null}
        {items.map((item) => (
          <article key={item.id} className="utility-action-card utility-action-card--static">
            <strong>{item.candidate_name}</strong>
            <span>{item.title} · {item.job_type}</span>
            {item.summary ? <p>{item.summary}</p> : null}
            {item.phone ? <p dir="ltr">{item.phone}</p> : null}
            {item.email ? <p dir="ltr">{item.email}</p> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
