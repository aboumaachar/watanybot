import { useEffect, useState } from "react";
import { authFetch } from "../lib/api";

type Health = {
  mode: string;
  opportunities: number;
  applications: number;
  sources: number;
  imports: number;
  auditEvents: number;
  warning?: string;
};

type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  note?: string;
  createdAt: string;
};

async function readAdminJson<T>(url: string): Promise<T> {
  const response = await authFetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export default function AdminOpportunitiesAuditPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      readAdminJson<Health>("/api/admin/opportunities/persistence/health"),
      readAdminJson<AuditEvent[]>("/api/admin/opportunities/audit"),
    ])
      .then(([healthPayload, auditPayload]) => {
        setHealth(healthPayload);
        setEvents(Array.isArray(auditPayload) ? auditPayload : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "تعذر تحميل سجل التدقيق"));
  }, []);

  return (
    <main dir="rtl" className="mx-auto max-w-6xl p-4 text-right">
      <h1 className="text-2xl font-bold">تدقيق فرص العمل المدنية</h1>
      <p className="mt-2 text-sm text-slate-600">هذه الصفحة مخصصة لتتبع حالة التخزين وسجل قرارات الإدارة لميزة فرص العمل المدنية والخدمات.</p>
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
      {health && (
        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">الحالة</div><div className="font-semibold">{health.mode}</div></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">الفرص</div><div className="text-xl font-bold">{health.opportunities}</div></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">المصادر</div><div className="text-xl font-bold">{health.sources}</div></div>
        </section>
      )}
      {health?.warning && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">{health.warning}</div>}
      <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">سجل التدقيق</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b text-slate-500"><th className="p-2">الوقت</th><th className="p-2">النوع</th><th className="p-2">الإجراء</th><th className="p-2">الملاحظة</th></tr></thead>
            <tbody>{events.map((event) => <tr key={event.id} className="border-b"><td className="p-2">{event.createdAt}</td><td className="p-2">{event.entityType}</td><td className="p-2">{event.action}</td><td className="p-2">{event.note || "—"}</td></tr>)}</tbody>
          </table>
          {events.length === 0 && <p className="p-4 text-slate-500">لا توجد أحداث تدقيق بعد.</p>}
        </div>
      </section>
    </main>
  );
}