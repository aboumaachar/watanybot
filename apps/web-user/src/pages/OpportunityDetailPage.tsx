import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { WatanyFeatureTemplate } from "../components/template";
import { useApp } from "../store/app";
type Opportunity = {
  id: string;
  type: string;
  title: string;
  organization: string;
  location: string;
  category: string;
  description: string;
  requirements: string[];
  applicationMethod: string;
  adminVerified: boolean;
};

function OpportunityDetailPageLegacy() {
  const { id = "" } = useParams<{ id: string }>();
  const { profile } = useApp();
  const navigate = useNavigate();
  const [item, setItem] = useState<Opportunity | null>(null);

  useEffect(() => {
    fetch(`/api/opportunities/${id}`)
      .then((res) => res.json())
      .then((data) => setItem(data.item || null))
      .catch(() => setItem(null));
  }, [id]);

  if (!item) {
    return <main dir="rtl" className="min-h-screen bg-slate-50 p-5">لم يتم العثور على الفرصة.</main>;
  }

  if (!profile.isAuthed) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
        <section className="mx-auto max-w-4xl rounded-3xl bg-white p-5 shadow-sm">
          <Link to="/opportunities" className="text-sm text-emerald-700">العودة إلى فرص العمل المدنية والخدمات</Link>
          <h1 className="mt-3 text-2xl font-bold">{item.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{item.organization} - {item.location}</p>
          <p className="mt-4 leading-8 text-slate-700">{item.description}</p>
          <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{item.applicationMethod}</p>
          <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="text-lg font-bold text-emerald-900">أنشئ حساباً أولاً</h2>
            <p className="mt-2 text-sm leading-7 text-emerald-900/80">نموذج التقديم يظهر داخل حسابك بعد التسجيل. أنشئ حساباً ثم افتح الملف الشخصي للوصول إلى الطلب المحفوظ.</p>
            <button type="button" className="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white" onClick={() => navigate("/register")}>
              فتح نموذج التسجيل
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-5 shadow-sm">
        <Link to="/opportunities" className="text-sm text-emerald-700">العودة إلى فرص العمل المدنية والخدمات</Link>
        <h1 className="mt-3 text-2xl font-bold">{item.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{item.organization} - {item.location}</p>
        <p className="mt-4 leading-8 text-slate-700">{item.description}</p>
        <h2 className="mt-5 font-bold">الشروط المطلوبة</h2>
        <ul className="mt-2 list-inside list-disc text-sm leading-7 text-slate-700">
          {item.requirements.map((req) => <li key={req}>{req}</li>)}
        </ul>
        <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">{item.applicationMethod}</p>
      </section>

      <section className="mx-auto mt-5 grid max-w-4xl gap-3 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">نموذج التقديم من الحساب</h2>
        <p className="text-sm leading-7 text-slate-600">
          هذا النموذج لم يعد يظهر للعامة. افتح <Link className="text-emerald-700" to="/profile#freelance-application">الملف الشخصي</Link> لإرسال طلب العمل الحر من بياناتك المحفوظة.
        </p>
        <button type="button" className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white" onClick={() => navigate("/profile#freelance-application")}>
          فتح طلب العمل الحر من الحساب
        </button>
      </section>
    </main>
  );
}
export default function OpportunityDetailPage() {
  return (
    <WatanyFeatureTemplate
      category="market"
      eyebrow="WatanyBot unified surface"
      title="Opportunity Detail"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.2."
      meta={[{ label: "Route", value: "/opportunities/freelance" }]}
      className="watany-template-batch-v142"
    >
      <div data-watany-template-batch="v1.4.2" data-watany-template-route="/opportunities/freelance">
        <OpportunityDetailPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}