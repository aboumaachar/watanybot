const superAdminMetrics = [
  { label: "طلبات بانتظار المراجعة", value: "مباشر", detail: "Taxi، المستخدمون، الفرص، والنماذج في سطح واحد" },
  { label: "التحقق الأمني", value: "مفعل", detail: "نقاط الإدارة تعود 401/403 بدون جلسة" },
  { label: "تجربة الإدارة", value: "موحدة", detail: "RTL، بطاقات، حالات فارغة، وإجراءات واضحة" },
  { label: "مصدر Taxi", value: "مرتبط", detail: "لوحة المراجعة تعتمد ملف المعاينة كمرجع بصري" },
];

const superAdminSections = [
  {
    eyebrow: "Taxi trusted mobility",
    title: "مراجعة السائقين والمركبات ومناطق التغطية",
    description: "يعرض للـ SuperAdmin كل ما يحتاجه لاعتماد السائق، مراجعة السيارة، مراقبة التوفر، وتثبيت نطاق الخدمة ضمن لبنان.",
    href: "/taxi/driver",
    action: "فتح لوحة السائق",
  },
  {
    eyebrow: "Users & roles",
    title: "إدارة المستخدمين والصلاحيات",
    description: "مساحة واضحة للمستخدمين، الأدوار، آخر SuperAdmin، وحالات القفل أو التعطيل بدون جداول مكدسة.",
    href: "/superadmin/users",
    action: "إدارة المستخدمين",
  },
  {
    eyebrow: "Opportunities",
    title: "الفرص والاستيراد والتدقيق",
    description: "تجميع الاستيراد، المصادر، التشغيلات، التدقيق، والصحة التشغيلية في تدفق واحد بدل شاشات منفصلة ومكررة.",
    href: "/admin/opportunities",
    action: "فتح الفرص",
  },
  {
    eyebrow: "Official services",
    title: "المعاملات والنماذج ومصادر LAF/MOF",
    description: "يثبت أن الإدارة ترى مسار المعاملات، النماذج، المستندات، وحالات العرض/التحميل كأدوات تحكم لا كروابط مبعثرة.",
    href: "/procedures",
    action: "مراجعة المعاملات",
  },
];

const adminChecklist = [
  "بطاقات ملخص مختصرة بدل حقول صفرية ممددة",
  "تقسيم واضح بين Taxi، المستخدمين، الفرص، والنماذج",
  "حالات فارغة مفيدة مع إجراء تال واضح",
  "تصميم RTL متجاوب للموبايل والسطح العريض",
  "إبقاء مسارات الإدارة محمية ومرتبطة بالجلسة",
];

export function SuperAdminCriticalDashboardShell() {
  return (
    <section className="superadmin-critical-shell" dir="rtl" data-superadmin-critical-dashboard>
      <div className="superadmin-critical-shell__hero">
        <div>
          <p className="superadmin-critical-shell__eyebrow">SuperAdmin control center</p>
          <h1>لوحة تحكم الإدارة العليا</h1>
          <p>
            إعادة تنظيم كاملة لسطح الإدارة: Taxi، المستخدمون، الفرص، النماذج، ومؤشرات الأمان ضمن واجهة موحدة وواضحة.
          </p>
        </div>
        <div className="superadmin-critical-shell__status" aria-label="حالة جاهزية الإدارة">
          <span>جاهزية التدقيق</span>
          <strong>تحتاج تحسين بصري مستمر</strong>
          <small>يتم التحقق عبر PMA + smoke + typecheck</small>
        </div>
      </div>

      <div className="superadmin-critical-shell__metrics" aria-label="ملخص الإدارة العليا">
        {superAdminMetrics.map((item) => (
          <article className="superadmin-critical-shell__metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="watany-approved-home-icons superadmin-critical-shell__grid">
        {superAdminSections.map((item) => (
          <article className="superadmin-critical-shell__card" key={item.title}>
            <span className="superadmin-critical-shell__card-eyebrow">{item.eyebrow}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <a href={item.href} className="superadmin-critical-shell__action">
              {item.action}
            </a>
          </article>
        ))}
      </div>

      <div className="superadmin-critical-shell__checklist" aria-label="معايير التصميم المطلوبة">
        <h2>معايير إغلاق فجوة SuperAdmin</h2>
        <ul>
          {adminChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}