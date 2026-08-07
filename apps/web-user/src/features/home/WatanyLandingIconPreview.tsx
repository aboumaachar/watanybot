import React from 'react';

const LOGO_SRC = '/logo.png';

const features = [
  { label: 'ممكن يهمك', icon: '✓', tone: 'green' },
  { label: 'الحدث', icon: 'جديد', tone: 'red' },
  { label: 'الأكثر طلباً', icon: '★', tone: 'blue' },
  { label: 'مدارس', icon: '🎓', tone: 'wine' },
  { label: 'معاملات', icon: '▤', tone: 'gold' },
  { label: 'المعاش', icon: '▰', tone: 'green' },
  { label: 'تاكسي', icon: '🚕', tone: 'wine' },
  { label: 'السوق', icon: '🛒', tone: 'gold' },
  { label: 'وظائف', icon: '💼', tone: 'green' },
  { label: 'الصحة والرعاية', icon: '♥', tone: 'green' },
  { label: 'القوانين والأنظمة', icon: '⚖', tone: 'green' },
  { label: 'مجتمعي', icon: '👥', tone: 'green' },
  { label: 'كل الخدمات', icon: '▦', tone: 'green' },
];

function TopBar() {
  return (
    <header className="wlp-topbar" aria-label="الشريط العلوي">
      <div className="wlp-logo" aria-label="شعار موطني">
        <img src={LOGO_SRC} alt="موطني" className="watany-landing-logo" />
      </div>

      <div className="wlp-ticker" aria-label="شريط الأخبار">
        <div className="wlp-ticker-track">
          <span>خدمة جديدة</span>
          <span>•</span>
          <span>استعلام عن المعاملات</span>
          <span>•</span>
          <span>تحديث: دليل المعاشات العسكرية 2024</span>
        </div>
      </div>

      <button className="wlp-burger" type="button" aria-label="القائمة">
        <span />
        <span />
        <span />
      </button>
    </header>
  );
}

function MainIcons() {
  return (
    <section className="wlp-section" aria-label="أيقونات القائمة الرئيسية">
      <h1 className="wlp-title">أيقونات القائمة الرئيسية (تصميم جديد)</h1>

      <div className="wlp-grid">
        {features.map((item) => (
          <button type="button" className={`wlp-card wlp-card--${item.tone}`} key={item.label} aria-label={item.label}>
            <div className="wlp-icon-shell">
              <span className="wlp-icon">{item.icon}</span>
            </div>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function BottomBar() {
  return (
    <nav className="wlp-bottom" aria-label="الشريط السفلي">
      <button type="button">الرئيسية</button>
      <button type="button">الخدمات</button>
      <button type="button">السوق</button>
      <button type="button">الإشعارات</button>
      <button type="button">المزيد</button>
    </nav>
  );
}

export function WatanyLandingIconPreview() {
  return (
    <main className="wlp" dir="rtl" aria-label="معاينة أيقونات الصفحة الرئيسية">
      <div style={{ height: 8 }} />
      <TopBar />
      <MainIcons />
      <BottomBar />
    </main>
  );
}

export default WatanyLandingIconPreview;
