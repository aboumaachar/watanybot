import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

type Entry = Readonly<{ title: string; detail: string; tag?: string }>;

function PageHeading({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <header className="watany-page-heading">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function EntryList({ entries }: Readonly<{ entries: readonly Entry[] }>) {
  return (
    <div className="watany-entry-list">
      {entries.map((entry) => (
        <article className="watany-entry-card" key={entry.title}>
          <div>
            <h2>{entry.title}</h2>
            <p>{entry.detail}</p>
          </div>
          {entry.tag ? <span>{entry.tag}</span> : null}
        </article>
      ))}
    </div>
  );
}

const homeServices = [
  { to: "/salary", title: "المعاش", detail: "الوصول إلى خدمات المعاش والحقوق المالية", icon: "ل.ل" },
  { to: "/procedures", title: "المعاملات", detail: "خطوات واضحة للمستندات والإجراءات", icon: "✓" },
  { to: "/school-grants", title: "المنح المدرسية", detail: "متابعة المسار والمستندات المطلوبة", icon: "▤" },
  { to: "/jobs", title: "الوظائف", detail: "فرص مدنية مستقلة عن إعلانات التطويع", icon: "⌕" },
  { to: "/marketplace", title: "السوق", detail: "مسار السوق محفوظ بوضع آمن أثناء التطوير", icon: "◈" },
];

export function HomeRecoveryPage() {
  return (
    <section className="watany-page" data-watany-page="home" data-watany-feature="home">
      <div className="watany-home-intro">
        <img src="/logo.png" alt="موطني مساعدك الذكي" />
        <div>
          <p className="watany-eyebrow">نسخة الاستعادة النظيفة</p>
          <h1>موطني مساعدك الذكي</h1>
          <p>الخدمات الأساسية متاحة ضمن واجهة واحدة مستقرة، بينما تبقى الميزات غير المكتملة خارج مسار التشغيل.</p>
        </div>
      </div>
      <div className="watany-guided-card" data-watany-guided-card="true">
        <strong>كيف تبدأ؟</strong>
        <p>اختر الخدمة المطلوبة. ستجد المسارات الأساسية مباشرة من دون قوائم متكررة أو طبقات تعيق الاستخدام.</p>
      </div>
      <div className="watany-service-grid">
        {homeServices.map((service) => (
          <Link key={service.to} to={service.to} className="watany-service-card">
            <span aria-hidden="true">{service.icon}</span>
            <strong>{service.title}</strong>
            <small>{service.detail}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SalaryRecoveryPage() {
  const entries: readonly Entry[] = [
    { title: "بيانات المعاش", detail: "المسار الأساسي محفوظ. ربط البيانات الحية مؤجل إلى ما بعد تثبيت التشغيل.", tag: "متاح" },
    { title: "الحقوق المالية", detail: "الوصول إلى المعلومات والنماذج الأساسية من واجهة واحدة.", tag: "أساسي" },
    { title: "المساعدة في الطلب", detail: "استخدم المساعد أو صفحة المعاملات لمعرفة الخطوات المطلوبة.", tag: "إرشاد" },
  ];
  return <section className="watany-page" data-watany-feature="salary"><PageHeading title="المعاش" description="الخدمات الأساسية للمعاش والحقوق المالية." /><EntryList entries={entries} /></section>;
}

export function ProceduresRecoveryPage() {
  const entries: readonly Entry[] = [
    { title: "اختيار المعاملة", detail: "ابدأ بتحديد نوع المعاملة قبل جمع المستندات.", tag: "1" },
    { title: "مراجعة المستندات", detail: "تحقق من المستندات المطلوبة ومن صلاحيتها.", tag: "2" },
    { title: "تقديم الطلب", detail: "اتبع الجهة المختصة واحتفظ بإثبات التقديم.", tag: "3" },
  ];
  return <section className="watany-page" data-watany-feature="procedures"><PageHeading title="المعاملات" description="مسار مبسط وواضح من اختيار المعاملة حتى تقديمها." /><EntryList entries={entries} /></section>;
}

export function SchoolGrantsRecoveryPage() {
  const entries: readonly Entry[] = [
    { title: "طلب منحة مدرسية", detail: "راجع الأهلية والمستندات قبل بدء الطلب.", tag: "منحة" },
    { title: "المستندات", detail: "إفادة مدرسية، إثباتات عائلية، والمستندات المالية المطلوبة.", tag: "تدقيق" },
    { title: "متابعة الطلب", detail: "احتفظ برقم الطلب وتاريخ التقديم للمراجعة.", tag: "متابعة" },
  ];
  return <section className="watany-page" data-watany-feature="school-grants"><PageHeading title="المنح المدرسية" description="المعلومات الأساسية مرتبة بحسب مسار الطلب." /><EntryList entries={entries} /></section>;
}

export function JobsRecoveryPage() {
  const entries: readonly Entry[] = [
    { title: "فرص عمل مدنية", detail: "وظائف مدفوعة للمحاربين القدامى وأفراد العائلة.", tag: "وظائف" },
    { title: "عمل حر", detail: "فرص مستقلة ومشاريع قصيرة المدة.", tag: "مستقل" },
    { title: "فرص تطوعية", detail: "مساهمات مجتمعية اختيارية وواضحة الشروط.", tag: "تطوع" },
  ];
  return <section className="watany-page" data-watany-listing-page="true"><PageHeading title="الوظائف والفرص المدنية" description="هذا القسم مستقل بالكامل عن إعلانات التطويع العسكري." /><EntryList entries={entries} /></section>;
}

export function MarketplaceRecoveryPage() {
  const entries: readonly Entry[] = [
    { title: "إعلانات السوق", detail: "تم تعليق الاتصال الحي مؤقتاً لمنع أخطاء الخادم أثناء تثبيت النسخة النظيفة.", tag: "وضع آمن" },
    { title: "إضافة إعلان", detail: "ستعود بعد إثبات مصدر البيانات وصلاحيات النشر بصورة مستقلة.", tag: "مؤجل" },
    { title: "التصنيفات", detail: "لن يتم استخدام بيانات بديلة أو غير موثقة في مرحلة الاستعادة.", tag: "محمي" },
  ];
  return <section className="watany-page" data-watany-listing-page="true" data-marketplace-mode="quarantined"><PageHeading title="السوق" description="المسار متاح، والاتصال غير المثبت معزول عن تشغيل التطبيق." /><EntryList entries={entries} /></section>;
}

export function LoginRecoveryPage() {
  const [continued, setContinued] = useState(false);
  return (
    <main className="watany-auth-page" data-watany-auth-page="login" data-watany-feature="login">
      <section className="watany-auth-card">
        <img src="/logo.png" alt="موطني" />
        <p className="watany-eyebrow">وصول آمن وبسيط</p>
        <h1>تسجيل الدخول</h1>
        <p>ابدأ بالطريقة المناسبة لك. خدمات المصادقة الخارجية غير المثبتة لن تعيق فتح الصفحة.</p>
        {!continued ? (
          <div className="watany-auth-actions">
            <button type="button" data-watany-login-continue="true" onClick={() => setContinued(true)}>المتابعة بالبريد أو الهاتف</button>
            <button type="button" className="secondary" onClick={() => setContinued(true)}>المتابعة مع Google</button>
          </div>
        ) : (
          <form className="watany-auth-form" onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}>
            <label>البريد الإلكتروني أو رقم الهاتف<input name="identity" autoComplete="username" required /></label>
            <label>كلمة المرور<input name="password" type="password" autoComplete="current-password" required /></label>
            <button type="submit">دخول</button>
          </form>
        )}
        <p className="watany-auth-switch">ليس لديك حساب؟ <Link to="/register">إنشاء حساب</Link></p>
        <Link className="watany-auth-home" to="/">العودة إلى الرئيسية</Link>
      </section>
    </main>
  );
}

export function RegisterRecoveryPage() {
  return (
    <main className="watany-auth-page" data-watany-auth-page="register" data-watany-feature="register">
      <section className="watany-auth-card">
        <img src="/logo.png" alt="موطني" />
        <p className="watany-eyebrow">حساب واحد لخدمات موطني</p>
        <h1>إنشاء حساب</h1>
        <form className="watany-auth-form" onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}>
          <label>الاسم الكامل<input name="fullName" autoComplete="name" required /></label>
          <label>البريد الإلكتروني<input name="email" type="email" autoComplete="email" required /></label>
          <label>رقم الهاتف<input name="phone" inputMode="tel" autoComplete="tel" /></label>
          <button type="submit">إنشاء الحساب</button>
        </form>
        <p className="watany-auth-switch">لديك حساب؟ <Link to="/login">تسجيل الدخول</Link></p>
        <Link className="watany-auth-home" to="/">العودة إلى الرئيسية</Link>
      </section>
    </main>
  );
}

export function UnavailableRecoveryPage() {
  return (
    <section className="watany-page watany-unavailable" data-watany-page="unavailable" data-watany-feature="placeholder">
      <PageHeading title="هذه الميزة خارج النسخة النظيفة" description="تم عزل الميزات غير الأساسية التي لم يثبت استقرارها بعد." />
      <Link to="/">العودة إلى الخدمات الأساسية</Link>
    </section>
  );
}
