import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../lib/api";

type OpportunityStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";

type Opportunity = {
  id: string;
  title: string;
  organization: string;
  location: string;
  type: string;
  status: OpportunityStatus;
  adminVerified: boolean;
  createdAt: string;
};

type Application = {
  id: string;
  opportunityId: string;
  applicantName: string;
  applicantPhone: string;
  applicantType: string;
  status: string;
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

type Tab = "opportunities" | "applications" | "sources";

const STATUS_LABEL: Record<OpportunityStatus, string> = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "قيد المراجعة",
  PUBLISHED: "منشورة",
  ARCHIVED: "مؤرشفة",
};

const STATUS_COLOR: Record<OpportunityStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_REVIEW: "bg-yellow-50 text-yellow-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-red-50 text-red-700",
};

async function apiPatch(url: string, body: unknown) {
  const res = await authFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(url: string) {
  const res = await authFetch(url, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function readAdminJson<T>(url: string): Promise<T> {
  const response = await authFetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export default function AdminOpportunitiesPage() {
  const [tab, setTab] = useState<Tab>("opportunities");

  // Opportunities
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [oppsLoading, setOppsLoading] = useState(true);

  // Applications
  const [apps, setApps] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  // Sources
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const [actionMsg, setActionMsg] = useState("");

  function flash(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3000);
  }

  // Load opportunities
  useEffect(() => {
    if (tab !== "opportunities") return;
    setOppsLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const query = params.toString();
    const url = query ? `/api/admin/opportunities?${query}` : "/api/admin/opportunities";
    readAdminJson<{ items?: Opportunity[] }>(url)
      .then((d) => setOpps(Array.isArray(d.items) ? d.items : []))
      .catch(() => setOpps([]))
      .finally(() => setOppsLoading(false));
  }, [tab, statusFilter]);

  // Load applications
  useEffect(() => {
    if (tab !== "applications") return;
    setAppsLoading(true);
    readAdminJson<{ items?: Application[] }>("/api/admin/opportunities/applications")
      .then((d) => setApps(Array.isArray(d.items) ? d.items : []))
      .catch(() => setApps([]))
      .finally(() => setAppsLoading(false));
  }, [tab]);

  // Load sources
  useEffect(() => {
    if (tab !== "sources") return;
    setSourcesLoading(true);
    readAdminJson<{ items?: Source[] }>("/api/admin/opportunities/sources")
      .then((d) => setSources(Array.isArray(d.items) ? d.items : []))
      .catch(() => setSources([]))
      .finally(() => setSourcesLoading(false));
  }, [tab]);

  async function handleTransition(id: string, action: "publish" | "archive" | "reject") {
    try {
      await apiPost(`/api/admin/opportunities/${id}/${action}`);
      let actionLabel = "الرفض";
      if (action === "publish") {
        actionLabel = "النشر";
      } else if (action === "archive") {
        actionLabel = "الأرشفة";
      }

      flash(`تم ${actionLabel} بنجاح`);
      setOpps((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status: action === "publish" ? "PUBLISHED" : "ARCHIVED",
                adminVerified: action === "publish",
              }
            : o,
        ),
      );
    } catch {
      flash("فشلت العملية. راجع الصلاحيات أو حاول مجدداً.");
    }
  }

  async function handleAppStatus(id: string, status: string) {
    try {
      await apiPatch(`/api/admin/opportunities/applications/${id}/status`, { status });
      flash("تم تحديث حالة الطلب");
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    } catch {
      flash("فشل تحديث حالة الطلب.");
    }
  }

  async function handleSourceToggle(id: string, enabled: boolean) {
    try {
      await apiPatch(`/api/admin/opportunities/sources/${id}`, { enabled });
      flash(enabled ? "تم تفعيل المصدر" : "تم تعطيل المصدر");
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    } catch {
      flash("فشل تحديث المصدر.");
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "opportunities", label: "الفرص" },
    { key: "applications", label: "الطلبات" },
    { key: "sources", label: "المصادر" },
  ];

  let opportunitiesContent: React.ReactNode;
  if (oppsLoading) {
    opportunitiesContent = <div className="rounded-3xl bg-white p-5 shadow-sm">جارٍ التحميل...</div>;
  } else if (opps.length === 0) {
    opportunitiesContent = <div className="rounded-3xl bg-white p-5 shadow-sm">لا توجد فرص.</div>;
  } else {
    opportunitiesContent = (
      <div className="grid gap-3">
        {opps.map((opp) => (
          <div key={opp.id} className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className={`rounded-full px-3 py-1 ${STATUS_COLOR[opp.status]}`}>
                    {STATUS_LABEL[opp.status]}
                  </span>
                  {opp.adminVerified ? (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                      تم التحقق
                    </span>
                  ) : null}
                  <span>{opp.type}</span>
                  <span>{opp.location}</span>
                </div>
                <p className="mt-2 font-bold">{opp.title}</p>
                <p className="text-sm text-slate-500">{opp.organization}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {opp.status !== "PUBLISHED" && (
                  <button
                    onClick={() => handleTransition(opp.id, "publish")}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    نشر
                  </button>
                )}
                {opp.status === "PUBLISHED" && (
                  <button
                    onClick={() => handleTransition(opp.id, "archive")}
                    className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    أرشفة
                  </button>
                )}
                {opp.status !== "ARCHIVED" && opp.status !== "PUBLISHED" && (
                  <button
                    onClick={() => handleTransition(opp.id, "reject")}
                    className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                  >
                    رفض
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  let applicationsContent: React.ReactNode;
  if (appsLoading) {
    applicationsContent = <div className="rounded-3xl bg-white p-5 shadow-sm">جارٍ التحميل...</div>;
  } else if (apps.length === 0) {
    applicationsContent = <div className="rounded-3xl bg-white p-5 shadow-sm">لا توجد طلبات بعد.</div>;
  } else {
    applicationsContent = apps.map((app) => (
      <div key={app.id} className="rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold">{app.applicantName}</p>
            <p className="text-sm text-slate-500">
              {app.applicantPhone} · {app.applicantType}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              الفرصة: {app.opportunityId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {app.status}
            </span>
            <select
              className="rounded-xl border border-slate-200 px-2 py-1 text-xs"
              value={app.status}
              onChange={(e) => handleAppStatus(app.id, e.target.value)}
            >
              {[
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
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    ));
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-slate-400">لوحة التحكم الإدارية</p>
            <h1 className="mt-1 text-2xl font-bold">فرص العمل المدنية والخدمات</h1>
            <p className="mt-1 text-xs text-emerald-700">مستقلة بالكامل عن إعلانات التطويع</p>
          </div>
          <Link
            to="/opportunities"
            className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700"
          >
            العرض العام
          </Link>
        </div>

        {actionMsg ? (
          <div className="mx-auto mt-3 rounded-2xl bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800">
            {actionMsg}
          </div>
        ) : null}

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              data-feature-key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-2xl px-5 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 shadow-sm hover:bg-emerald-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Opportunities tab ── */}
        {tab === "opportunities" && (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {(["", "DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                    statusFilter === s
                      ? "bg-slate-800 text-white"
                      : "bg-white text-slate-600 shadow-sm"
                  }`}
                >
                  {s === "" ? "الكل" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            {opportunitiesContent}
          </div>
        )}

        {/* ── Applications tab ── */}
        {tab === "applications" && (
          <div className="mt-4 grid gap-3">
            {applicationsContent}
          </div>
        )}

        {/* ── Sources tab ── */}
        {tab === "sources" && (
          <div className="mt-4 grid gap-3">
            {sourcesLoading ? (
              <div className="rounded-3xl bg-white p-5 shadow-sm">جارٍ التحميل...</div>
            ) : (
              sources.map((src) => (
                <div key={src.id} className="rounded-3xl bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{src.name}</p>
                      <p className="text-xs text-slate-400">{src.url}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {src.sourceType} · {src.crawlPolicy}
                      </p>
                      {src.notes ? (
                        <p className="mt-1 text-xs text-slate-400">{src.notes}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => handleSourceToggle(src.id, !src.enabled)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                        src.enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {src.enabled ? "مفعّل" : "معطّل"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </main>
  );
}
