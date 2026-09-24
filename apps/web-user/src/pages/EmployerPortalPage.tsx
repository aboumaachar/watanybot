import { WatanyFeatureTemplate } from "../components/template";
import { useApp } from "../store/app";

function EmployerPortalPageContent() {
  const { profile } = useApp();
  const isAdmin = profile.role === "admin" || profile.role === "superadmin";
  return (
    <main dir="rtl" className="mx-auto max-w-5xl p-4 space-y-4">
      <h1 className="text-2xl font-bold">بوابة أصحاب العمل</h1>
      <p className="text-sm text-gray-600">سجّل جهة العمل، اطلب اعتماد الحساب، ثم أنشئ الوظائف وتابع المتقدمين أو ابحث في قاعدة المرشحين.</p>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border p-4 shadow-sm space-y-2"><h2 className="font-semibold">اعتماد جهة العمل</h2><p className="text-sm">يجب اعتماد حساب الشركة قبل الوصول إلى أدوات التوظيف.</p><a className="btn btn-primary" href="/jobs/candidates">طلب الاعتماد / عرض الحالة</a></article>
        <article className="rounded-2xl border p-4 shadow-sm space-y-2"><h2 className="font-semibold">البحث عن مرشحين</h2><p className="text-sm">ابحث حسب المهارات والمنطقة ونوع العمل بعد اعتماد الحساب.</p><a className="btn btn-primary" href="/jobs/candidates">فتح قاعدة المرشحين</a></article>
        <article className="rounded-2xl border p-4 shadow-sm space-y-2"><h2 className="font-semibold">إنشاء وظيفة ونموذج تقديم</h2><p className="text-sm">أنشئ وظيفة، أضف أسئلة النموذج، وانشرها مباشرة.</p><a className="btn btn-primary" href="/jobs/employer/builder/new">إنشاء وظيفة</a></article>
        <article className="rounded-2xl border p-4 shadow-sm space-y-2"><h2 className="font-semibold">إدارة الوظائف والطلبات</h2><p className="text-sm">تابع الوظائف المنشورة والمسودات وطلبات المتقدمين.</p><a className="btn btn-primary" href="/jobs/employer/dashboard">فتح لوحة الوظائف</a></article>
      </section>
      {isAdmin ? <section className="rounded-2xl border p-4 shadow-sm space-y-2"><h2 className="font-semibold">إدارة التوظيف</h2><p className="text-sm">مراجعة اعتماد أصحاب العمل وقاعدة المرشحين ومتابعة طلبات الوظائف.</p><a className="btn btn-primary" href="/superadmin/jobs">فتح Jobs CMS</a></section> : null}
      <section className="rounded-2xl border p-4 shadow-sm"><h2 className="font-semibold">كيف تعمل الخدمة؟</h2><p className="text-sm">ينشر صاحب العمل وظيفة مع نموذج مخصص، ويتقدم المستخدم من ملفه أو طلب سابق أو قالب محفوظ، ثم تُتابع الحالة من لوحة الوظيفة.</p></section>
    </main>
  );
}

export default function EmployerPortalPage() {
  return <WatanyFeatureTemplate category="jobs" eyebrow="خدمات أصحاب العمل" title="بوابة أصحاب العمل" description="إنشاء الوظائف والنماذج والوصول المنظم إلى المرشحين."><div data-watany-template-batch="jobs-builder-v1" data-watany-template-manual-page="employer-portal"><EmployerPortalPageContent /></div></WatanyFeatureTemplate>;
}