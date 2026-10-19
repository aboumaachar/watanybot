import { WatanyFeatureTemplate } from "../components/template";
import { useApp } from "../store/app";

function EmployerPortalPageContent() {
  const { profile } = useApp();
  const isAdmin = profile.role === "admin" || profile.role === "superadmin";
  return (
    <main dir="rtl" className="mx-auto max-w-5xl p-4 space-y-4">
      <h1 className="text-2xl font-bold">بوابة أصحاب العمل</h1>
      <p className="text-sm text-gray-600">سجّل جهة العمل، اطلب اعتماد الحساب، ثم ابحث في قاعدة المرشحين الجاهزين للعمل.</p>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border p-4 shadow-sm space-y-2">
          <h2 className="font-semibold">اعتماد جهة العمل</h2>
          <p className="text-sm">يجب اعتماد حساب الشركة قبل إظهار بيانات التواصل الخاصة بالمرشحين.</p>
          <a className="btn btn-primary" href="/jobs/candidates">طلب الاعتماد / عرض الحالة</a>
        </article>
        <article className="rounded-2xl border p-4 shadow-sm space-y-2">
          <h2 className="font-semibold">البحث عن مرشحين</h2>
          <p className="text-sm">ابحث حسب نوع العمل، المهارات، المنطقة، ونمط العمل بعد اعتماد الحساب.</p>
          <a className="btn btn-primary" href="/jobs/candidates">فتح قاعدة المرشحين</a>
        </article>
      </section>

      {isAdmin ? (
        <section className="rounded-2xl border p-4 shadow-sm space-y-2">
          <h2 className="font-semibold">إدارة التوظيف</h2>
          <p className="text-sm">مراجعة اعتماد أصحاب العمل وقاعدة المرشحين ومتابعة طلبات الوظائف.</p>
          <a className="btn btn-primary" href="/superadmin/jobs">فتح Jobs CMS</a>
        </section>
      ) : null}

      <section className="rounded-2xl border p-4 shadow-sm">
        <h2 className="font-semibold">كيف تعمل الخدمة؟</h2>
        <p className="text-sm">المرشح ينشر جاهزيته للعمل من حسابه، وتظهر بيانات التواصل فقط لأصحاب العمل المعتمدين. يمكن للإدارة تعليق أو سحب اعتماد أي جهة عند الحاجة.</p>
      </section>
    </main>
  );
}

export default function EmployerPortalPage() {
  return (
    <WatanyFeatureTemplate category="jobs" eyebrow="خدمات أصحاب العمل" title="بوابة أصحاب العمل" description="اعتماد الشركات والوصول المنظم إلى المرشحين الجاهزين للعمل.">
      <div data-watany-template-batch="jobs-cms-v1" data-watany-template-manual-page="employer-portal">
        <EmployerPortalPageContent />
      </div>
    </WatanyFeatureTemplate>
  );
}
