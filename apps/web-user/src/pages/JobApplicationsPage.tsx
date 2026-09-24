import { useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import { useApp } from "../store/app";

type ApplicationItem = {
  applicationId: string;
  campaignId: string;
  label: string;
  name: string;
  status: string;
  followUpStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  location?: string;
  applicationHref?: string;
};

const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  pending_review: "قيد المراجعة",
  approved: "مقبول",
  accepted: "مقبول",
  waitlist: "لائحة انتظار",
  rejected: "مرفوض",
  withdrawn: "مسحوب",
};

const followUpLabels: Record<string, string> = {
  not_contacted: "لم يتم التواصل بعد",
  contacted: "تم التواصل",
  scheduled: "تم تحديد متابعة",
  completed: "اكتملت المتابعة",
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("ar-LB");
}

export default function JobApplicationsPage() {
  const { apiBaseUrl } = useApp();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await authFetch(`${apiBaseUrl}/api/jobs/applications/mine`);
        if (!response.ok) throw new Error("LOAD_FAILED");
        const data = await response.json();
        if (active) setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (active) setError("تعذّر تحميل طلباتك حالياً.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [apiBaseUrl]);

  return (
    <main dir="rtl" className="mx-auto max-w-5xl p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">طلباتي الوظيفية</h1>
        <p className="text-sm text-gray-600">تابع جميع طلبات الوظائف المرتبطة بحسابك من مكان واحد.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href="/jobs">العودة إلى الوظائف</a>
        <a className="btn" href="/jobs/readiness">جاهز للعمل</a>
      </div>

      {loading ? <p>جارٍ تحميل الطلبات…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <section className="rounded-2xl border p-4 shadow-sm">
          <h2 className="font-semibold">لا توجد طلبات مرتبطة بحسابك بعد</h2>
          <p className="text-sm">عند التقديم على فرصة مرتبطة بحسابك ستظهر حالتها هنا تلقائياً.</p>
        </section>
      ) : null}

      <section className="grid gap-3">
        {items.map((item) => (
          <article key={`${item.campaignId}:${item.applicationId}`} className="rounded-2xl border p-4 shadow-sm space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">{item.label}</h2>
                <p className="text-xs text-gray-500" dir="ltr">{item.applicationId}</p>
              </div>
              <span className="rounded-full border px-3 py-1 text-sm">{statusLabels[item.status] || item.status || "—"}</span>
            </div>
            <p className="text-sm">المتابعة: {followUpLabels[item.followUpStatus || ""] || item.followUpStatus || "—"}</p>
            {item.location ? <p className="text-sm">الموقع: {item.location}</p> : null}
            <p className="text-sm">تاريخ التقديم: {formatDate(item.createdAt)}</p>
            {item.applicationHref ? <a className="btn" href={item.applicationHref}>عرض الفرصة</a> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
