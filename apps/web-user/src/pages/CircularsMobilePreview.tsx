// APEX_CSS_FREEZE_DISABLED_IMPORT import "./CircularsMobilePreview.css";

type Category = {
  label: string;
  count: number;
  icon: string;
  active?: boolean;
};

type Circular = {
  title: string;
  issuer: string;
  summary: string;
  date: string;
  tag: string;
  tagClass: string;
  logo: string;
};

const categories: Category[] = [
  { label: "المؤسسات الأمنية", count: 134, icon: "🛡️", active: true },
  { label: "الرابطة", count: 128, icon: "🎖️" },
  { label: "المحاربون القدامى", count: 96, icon: "⭐" },
  { label: "مصرف لبنان", count: 124, icon: "🏦" },
  { label: "المذكرات الإدارية", count: 213, icon: "📋" },
  { label: "المراسيم", count: 156, icon: "⚖️" },
  { label: "القوانين", count: 194, icon: "📜" },
];

const circulars: Circular[] = [
  {
    title: "تعميم رقم 17/2024",
    issuer: "الجيش اللبناني",
    summary: "تعديل بعض أحكام تعميم سابق يتعلق بالرواتب والتعويضات",
    date: "2024-05-20",
    tag: "تعميم",
    tagClass: "red",
    logo: "🪖",
  },
  {
    title: "تعميم أساسي رقم 158",
    issuer: "مصرف لبنان",
    summary: "تعميم أساسي يتعلق بالعمليات المالية والمصرفية",
    date: "2024-05-18",
    tag: "تعميم أساسي",
    tagClass: "blue",
    logo: "🏦",
  },
  {
    title: "مذكرة إدارية رقم 45/2024",
    issuer: "وزارة الدفاع الوطني",
    summary: "توضيح آلية تقديم معاملات المتقاعدين",
    date: "2024-05-15",
    tag: "مذكرة إدارية",
    tagClass: "purple",
    logo: "🪖",
  },
  {
    title: "مرسوم رقم 8823",
    issuer: "رئاسة مجلس الوزراء",
    summary: "مرسوم يتعلق بزيادة بعض التقديمات الاجتماعية",
    date: "2024-05-10",
    tag: "مرسوم",
    tagClass: "red",
    logo: "🌲",
  },
  {
    title: "قانون رقم 47/2024",
    issuer: "الجمهورية اللبنانية - مجلس النواب",
    summary: "قانون تعديل بعض أحكام قانون التقاعد العسكري",
    date: "2024-05-05",
    tag: "قانون",
    tagClass: "gold",
    logo: "🇱🇧",
  },
];

export default function CircularsMobilePreview() {
  return (
    <main className="wm-page" dir="rtl">
      <section className="wm-hero">
        <div className="wm-status">
          <span>9:41</span>
          <span>▮▮▮ Wi-Fi 🔋</span>
        </div>

        <button className="wm-menu" aria-label="القائمة">☰</button>

        <div className="wm-brand">
          <div className="wm-brand-title">موطني</div>
          <div className="wm-brand-sub">WatanyBot</div>
        </div>

        <button className="wm-bell" aria-label="الإشعارات">
          🔔 <b>3</b>
        </button>
      </section>

      <section className="wm-sheet">
        <header className="wm-title">
          <div className="wm-doc-icon">▤</div>
          <h1>التعاميم</h1>
          <p>مرجع شامل لأحدث التعاميم والمذكرات والمراسيم والقوانين</p>
        </header>

        <div className="wm-categories" aria-label="تصنيفات التعاميم">
          {categories.map((cat) => (
            <button
              key={cat.label}
              className={`wm-category ${cat.active ? "is-active" : ""}`}
              type="button"
            >
              <span className="wm-category-icon">{cat.icon}</span>
              <strong>{cat.label}</strong>
              <small>{cat.count}</small>
            </button>
          ))}
        </div>

        <div className="wm-slider-dots">
          <span className="active" />
          <span />
        </div>

        <section className="wm-list-panel">
          <div className="wm-list-head">
            <div>
              <h2>أحدث التعاميم</h2>
              <p>تعرض أحدث 5 تعاميم</p>
            </div>
            <button type="button">عرض الكل ‹</button>
          </div>

          <div className="wm-circulars">
            {circulars.map((item) => (
              <article className="wm-card" key={item.title}>
                <div className="wm-card-logo">{item.logo}</div>

                <div className="wm-card-body">
                  <h3>{item.title}</h3>
                  <h4>{item.issuer}</h4>
                  <p>{item.summary}</p>

                  <div className="wm-meta">
                    <span>📅 {item.date}</span>
                    <span className={`wm-tag ${item.tagClass}`}>{item.tag}</span>
                  </div>
                </div>

                <div className="wm-card-actions">
                  <span className="wm-new">جديد</span>
                  <button type="button" className="wm-bookmark" aria-label="حفظ">♡</button>
                  <button type="button" className="wm-download" aria-label="تحميل">⌄</button>
                  <button type="button" className="wm-view">عرض 👁</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <nav className="wm-filter-bar" aria-label="فلترة التعاميم">
          <button type="button" className="active">فلترة ⚗</button>
          <button type="button">الجهة 🏢</button>
          <button type="button">النوع 📄</button>
          <button type="button">السنة 📅</button>
          <button type="button">إعادة تعيين ↻</button>
        </nav>
      </section>

      <nav className="wm-bottom-nav" aria-label="التنقل السفلي">
        <button type="button">الرئيسية<br />⌂</button>
        <button type="button">الخدمات<br />▦</button>
        <button type="button" className="assistant">المساعد<br />💬</button>
        <button type="button">المستندات<br />□</button>
        <button type="button">المزيد<br />•••</button>
      </nav>
    </main>
  );
}

