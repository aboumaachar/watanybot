import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../lib/api";

type ImportStatus =
  | "DISCOVERED"
  | "NORMALIZED"
  | "NEEDS_ADMIN_REVIEW"
  | "DUPLICATE_SKIPPED"
  | "APPROVED_FOR_PUBLICATION"
  | "REJECTED"
  | "EXPIRED"
  | "SOURCE_BLOCKED"
  | "CRAWL_FAILED";

type ImportedOpportunity = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  normalizedTitle: string;
  normalizedOrganization: string;
  normalizedLocation: string;
  normalizedCategory: string;
  normalizedSummary: string;
  normalizedType: string;
  importStatus: ImportStatus;
  adminReviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  publishedOpportunityId?: string;
  importedAt: string;
};

type Source = {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  crawlPolicy: string;
  enabled: boolean;
  complianceApproved: boolean;
  complianceNotes: string;
  lastCheckedAt?: string;
};

type CrawlRun = {
  id: string;
  sourceId: string;
  sourceName: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  itemsDiscovered: number;
  itemsNormalized: number;
  itemsDuplicate: number;
  itemsQueued: number;
  errorMessage?: string;
};

type Tab = "queue" | "sources" | "runs";

const STATUS_COLOR: Record<string, string> = {
  NEEDS_ADMIN_REVIEW: "bg-yellow-50 text-yellow-800",
  APPROVED_FOR_PUBLICATION: "bg-emerald-50 text-emerald-800",
  REJECTED: "bg-red-50 text-red-700",
  DUPLICATE_SKIPPED: "bg-slate-100 text-slate-500",
  NORMALIZED: "bg-blue-50 text-blue-700",
  DISCOVERED: "bg-slate-50 text-slate-500",
};

const STATUS_AR: Record<string, string> = {
  NEEDS_ADMIN_REVIEW: "قيد المراجعة",
  APPROVED_FOR_PUBLICATION: "تمت الموافقة",
  REJECTED: "مرفوض",
  DUPLICATE_SKIPPED: "مكرر — تم التخطي",
  NORMALIZED: "تم التطبيع",
  DISCOVERED: "مكتشف",
};

async function readAdminJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function getRunStatusClassName(status: string): string {
  if (status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "FAILED") {
    return "bg-red-50 text-red-700";
  }

  return "bg-yellow-50 text-yellow-700";
}

export default function AdminImportReviewPage() {
  const [tab, setTab] = useState<Tab>("queue");
  const [queue, setQueue] = useState<ImportedOpportunity[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<CrawlRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  function flash(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3500);
  }

  useEffect(() => {
    if (tab !== "queue") return;
    setLoading(true);
    readAdminJson<{ items?: ImportedOpportunity[] }>("/api/admin/opportunities/imports")
      .then((d) => setQueue(Array.isArray(d.items) ? d.items : []))
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "sources") return;
    setLoading(true);
    readAdminJson<{ items?: Source[] }>("/api/admin/opportunities/sources/registry")
      .then((d) => setSources(Array.isArray(d.items) ? d.items : []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "runs") return;
    setLoading(true);
    readAdminJson<{ items?: CrawlRun[] }>("/api/admin/opportunities/crawl-runs")
      .then((d) => setRuns(Array.isArray(d.items) ? d.items : []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [tab]);

  async function review(id: string, decision: "APPROVE" | "REJECT") {
    const res = await authFetch(`/api/admin/opportunities/imports/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, adminNote: reviewNote[id] || "" }),
    });
    if (res.ok) {
      flash(decision === "APPROVE" ? "تمت الموافقة ونُشرت الفرصة" : "تم رفض الإدراج");
      setQueue((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, importStatus: decision === "APPROVE" ? "APPROVED_FOR_PUBLICATION" : "REJECTED" }
            : i,
        ),
      );
    } else {
      flash("فشلت العملية — راجع الصلاحيات أو الحالة الحالية.");
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "queue", label: "طابور المراجعة" },
    { key: "sources", label: "مصادر الاستيراد" },
    { key: "runs", label: "سجل عمليات الجلب" },
  ];

  let queueContent: React.ReactNode;
  if (loading) {
    queueContent = <div className="rounded-3xl bg-white p-5 shadow-sm">جارٍ التحميل...</div>;
  } else if (queue.length === 0) {
    queueContent = (
      <div className="rounded-3xl bg-white p-5 shadow-sm text-slate-500">
        لا توجد وظائف في طابور المراجعة حالياً.
      </div>
    );
  } else {
    queueContent = (
      <div className="grid gap-3">
        {queue.map((item) => (
          <div key={item.id} className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-3 py-1 font-semibold ${STATUS_COLOR[item.importStatus] || "bg-slate-100 text-slate-600"}`}>
                    {STATUS_AR[item.importStatus] || item.importStatus}
                  </span>
                  <span className="text-slate-400">{item.sourceName}</span>
                  <span className="text-slate-400">{item.normalizedType}</span>
                  <span className="text-slate-400">{item.normalizedLocation}</span>
                </div>
                <p className="mt-2 font-bold">{item.normalizedTitle}</p>
                <p className="text-sm text-slate-500">{item.normalizedOrganization}</p>
                <p className="mt-1 text-sm leading-7 text-slate-600">{item.normalizedSummary}</p>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-xs text-emerald-600 underline"
                >
                  {item.sourceUrl}
                </a>
                {item.importStatus === "NEEDS_ADMIN_REVIEW" && (
                  <input
                    className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="ملاحظة اختيارية قبل الموافقة أو الرفض"
                    value={reviewNote[item.id] || ""}
                    onChange={(e) => setReviewNote((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                )}
              </div>
              {item.importStatus === "NEEDS_ADMIN_REVIEW" && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => review(item.id, "APPROVE")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    موافقة ونشر
                  </button>
                  <button
                    onClick={() => review(item.id, "REJECT")}
                    className="rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-700"
                  >
                    رفض
                  </button>
                </div>
              )}
              {item.importStatus === "APPROVED_FOR_PUBLICATION" && item.publishedOpportunityId && (
                <Link
                  to={`/opportunities/${item.publishedOpportunityId}`}
                  className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                >
                  عرض الفرصة المنشورة
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  let runsContent: React.ReactNode;
  if (loading) {
    runsContent = <div className="rounded-3xl bg-white p-5 shadow-sm">جارٍ التحميل...</div>;
  } else if (runs.length === 0) {
    runsContent = <div className="rounded-3xl bg-white p-5 shadow-sm text-slate-500">لا توجد عمليات جلب مسجلة بعد.</div>;
  } else {
    runsContent = runs.map((run) => (
      <div key={run.id} className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">{run.sourceName}</p>
            <p className="text-xs text-slate-400">
              {run.startedAt} {run.endedAt ? `→ ${run.endedAt}` : "(جارٍ)"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span className={`rounded-full px-3 py-1 font-semibold ${getRunStatusClassName(run.status)}`}>
              {run.status}
            </span>
            <span>مكتشف: {run.itemsDiscovered}</span>
            <span>طُبِّع: {run.itemsNormalized}</span>
            <span>مكرر: {run.itemsDuplicate}</span>
            <span>في الطابور: {run.itemsQueued}</span>
          </div>
        </div>
        {run.errorMessage ? (
          <p className="mt-2 text-xs text-red-600">{run.errorMessage}</p>
        ) : null}
      </div>
    ));
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-400">Wave 03 — مراجعة الاستيراد</p>
            <h1 className="mt-1 text-2xl font-bold">قائمة الانتظار ومصادر الاستيراد اللبنانية</h1>
            <p className="mt-1 text-xs text-emerald-700">لا يُنشر أي إدراج تلقائياً — الموافقة الإدارية شرط</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/opportunities"
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            >
              لوحة الفرص
            </Link>
            <Link
              to="/opportunities"
              className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700"
            >
              العرض العام
            </Link>
          </div>
        </div>

        {actionMsg ? (
          <div className="mx-auto mt-3 rounded-2xl bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800">
            {actionMsg}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              data-feature-key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-2xl px-5 py-2 text-sm font-semibold transition-colors ${
                tab === t.key ? "bg-emerald-600 text-white" : "bg-white text-slate-600 shadow-sm hover:bg-emerald-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Import review queue ── */}
        {tab === "queue" && (
          <div className="mt-4">
            {queueContent}
          </div>
        )}

        {/* ── Source registry ── */}
        {tab === "sources" && (
          <div className="mt-4 grid gap-3">
            {loading ? (
              <div className="rounded-3xl bg-white p-5 shadow-sm">جارٍ التحميل...</div>
            ) : (
              sources.map((src) => (
                <div key={src.id} className="rounded-3xl bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-3 py-1 font-semibold ${src.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {src.enabled ? "مفعّل" : "معطّل"}
                        </span>
                        <span className={`rounded-full px-3 py-1 ${src.complianceApproved ? "bg-blue-50 text-blue-700" : "bg-yellow-50 text-yellow-700"}`}>
                          {src.complianceApproved ? "اجتاز الامتثال" : "يحتاج مراجعة امتثال"}
                        </span>
                        <span className="text-slate-400">{src.sourceType}</span>
                        <span className="text-slate-400">{src.crawlPolicy}</span>
                      </div>
                      <p className="mt-2 font-bold">{src.name}</p>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 underline"
                      >
                        {src.url}
                      </a>
                      {src.complianceNotes ? (
                        <p className="mt-1 text-xs text-slate-400">{src.complianceNotes}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Crawl runs ── */}
        {tab === "runs" && (
          <div className="mt-4 grid gap-3">
            {runsContent}
          </div>
        )}
      </section>
    </main>
  );
}
