
// ADDRESS_NETWORK_CANONICAL_ADDRESS_WIDGET_MIGRATION_REVIEWED
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { WatanyFeatureTemplate } from "../components/template";
type Opportunity = {
  id: string;
  type: string;
  title: string;
  organization: string;
  location: string;
  category: string;
  summary: string;
  adminVerified: boolean;
};

function OpportunitiesPageLegacy() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (type) params.set("type", type);
    fetch(`/api/opportunities?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [query, type]);

  const title = useMemo(() => "فرص العمل المدنية والخدمات", []);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <section className="mx-auto max-w-5xl rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">مستقلة بالكامل عن إعلانات التطويع</p>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          وظائف مدنية، عمل حر، تطوع، تدريب، وفرص لأفراد العائلة. كل فرصة مستوردة أو منشورة تحتاج مراجعة إدارية قبل اعتمادها.
        </p>
        <div className="watany-approved-home-icons mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن وظيفة، منطقة، شركة، أو مهارة"
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
          >
            <option value="">كل أنواع الفرص</option>
            <option value="PAID_JOB">وظيفة مدفوعة</option>
            <option value="PART_TIME_JOB">دوام جزئي</option>
            <option value="FREELANCE_SERVICE">عمل حر</option>
            <option value="VOLUNTEER_WORK">تطوع</option>
            <option value="TRAINING">تدريب</option>
            <option value="FAMILY_MEMBER_OPPORTUNITY">فرص لأفراد العائلة</option>
          </select>
        </div>
      </section>

      <section className="watany-approved-home-icons mx-auto mt-5 grid max-w-5xl gap-4">
        {loading ? <div className="rounded-3xl bg-white p-5 shadow-sm">عم يتم تحميل الفرص...</div> : null}
        {!loading && items.length === 0 ? (
          <div className="rounded-3xl bg-white p-5 shadow-sm">لا توجد فرص منشورة حالياً. تواصل مع الإدارة للمساعدة.</div>
        ) : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{item.type}</span>
              <span>{item.location}</span>
              <span>{item.category}</span>
              {item.adminVerified ? <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">تم التحقق إدارياً</span> : null}
            </div>
            <h2 className="mt-3 text-xl font-bold">{item.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.organization}</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">{item.summary}</p>
            <Link className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" to={`/opportunities/${item.id}`}>
              عرض التفاصيل والتقديم
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
export default function OpportunitiesPage() {
  return (
    <WatanyFeatureTemplate
      category="market"
      eyebrow="WatanyBot unified surface"
      title="Opportunities"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.2."
      meta={[{ label: "Route", value: "/opportunities" }]}
      className="watany-template-batch-v142"
    >
      <div data-watany-template-batch="v1.4.2" data-watany-template-route="/opportunities">
        <OpportunitiesPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}