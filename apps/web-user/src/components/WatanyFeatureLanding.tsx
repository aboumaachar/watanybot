import { useNavigate, useLocation } from "react-router-dom";
import "../styles/watanyCleanHome.css";

const featureLabels: Record<string, string> = {
  "/for-you": "ممكن يهمك",
  "/latest": "الحدث",
  "/most-requested": "الأكثر طلباً",
  "/school-grants": "مدارس",
  "/procedures": "معاملات",
  "/salary": "المعاش",
  "/taxi": "تاكسي",
  "/marketplace": "السوق",
  "/jobs": "وظائف",
  "/health": "الصحة",
  "/legal": "القوانين",
  "/community": "مجتمعي",
  "/services": "كل الخدمات",
  "/network": "الشبكة",
  "/forms": "النماذج",
  "/faq": "الأسئلة",
  "/updates": "التعاميم",
  "/news": "الأخبار",
  "/deaths": "الوفيات",
  "/voting": "التصويت",
  "/profile": "ملفي",
  "/settings": "الإعدادات",
  "/saved": "المحفوظات",
  "/chat": "المساعد",
  "/notifications": "الإشعارات",
  "/login": "تسجيل الدخول",
};

export const CLEAN_LANDING_PATHS = Object.keys(featureLabels);

export default function WatanyFeatureLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const label = featureLabels[location.pathname] || location.pathname;

  function go(path: string) { navigate(path); }

  return (
    <div className="wch-root" dir="rtl">
      <header className="wch-topbar">
        <button className="wch-back-btn" type="button" onClick={() => go("/")} aria-label="الرجوع">→</button>
        <div className="wch-topbar-title">{label}</div>
        <div />
      </header>

      <main className="wch-landing-main">
        <div className="wch-landing-card">
          <h1 className="wch-landing-title">{label}</h1>
          <p className="wch-landing-desc">هذه الصفحة قيد التطوير. سيتم إضافة المحتوى قريباً.</p>
          <button className="wch-landing-home-btn" type="button" onClick={() => go("/")}>العودة للرئيسية</button>
        </div>
      </main>

      <form className="wch-chat" onSubmit={e => e.preventDefault()} aria-label="اسأل موطني">
        <button type="button" className="wch-chat-btn">🎙</button>
        <input className="wch-chat-input" placeholder="اسأل موطني..." />
        <button type="submit" className="wch-chat-btn">➤</button>
      </form>

      <nav className="wch-bottom" aria-label="التنقل السريع">
        <button type="button" onClick={() => go("/")}>الرئيسية</button>
        <button type="button" onClick={() => go("/chat")}>المساعد</button>
        <button type="button" onClick={() => go("/services")}>الخدمات</button>
        <button type="button" onClick={() => go("/notifications")}>الإشعارات</button>
        <button type="button" onClick={() => go("/profile")}>حسابي</button>
      </nav>
    </div>
  );
}
