import React from "react";
import { WatanyFeatureTemplate } from "../components/template";
function EmployerPortalPageContent() {
  return (
    <main dir="rtl" className="mx-auto max-w-5xl p-4 space-y-4">
      <h1 className="text-2xl font-bold">بوابة أصحاب العمل</h1>
      <p className="text-sm text-gray-600">إدارة طلبات أصحاب العمل ضمن فرص العمل المدنية والخدمات، بشكل مستقل كلياً عن إعلانات التطويع.</p>
      <section className="rounded-2xl border p-4 shadow-sm">
        <h2 className="font-semibold">تسجيل جهة عمل</h2>
        <p className="text-sm">يمكن للجهات تسجيل بياناتها ليتم مراجعتها قبل نشر أي فرص أو طلبات.</p>
      </section>
      <section className="rounded-2xl border p-4 shadow-sm">
        <h2 className="font-semibold">طلب مرشحين أو مستقلين</h2>
        <p className="text-sm">يدعم الاختيار حسب المهارات، المنطقة، نوع العمل، والشهادات.</p>
      </section>
    </main>
  );
}

export default function EmployerPortalPage() {
  return (
    <WatanyFeatureTemplate
      category="jobs"
      eyebrow="Recruitment services"
      title="Employer portal"
      description="Dedicated employer surface for recruitment and opportunity management."
    >
      <div data-watany-template-batch="v1.7.4.1" data-watany-template-manual-page="employer-portal">
        <EmployerPortalPageContent />
      </div>
    </WatanyFeatureTemplate>
  );
}
