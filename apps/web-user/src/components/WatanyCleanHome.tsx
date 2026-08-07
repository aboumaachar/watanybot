import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/watanyCleanHome.css";

const P = "/watany-assets/after-reference-icons/";

const tiles = [
  { id: "important",     label: "ممكن يهمك",         href: "/for-you",        img: P + "important.png" },
  { id: "latest",        label: "الحدث",             href: "/latest",         img: P + "latest.png" },
  { id: "popular",       label: "الأكثر طلباً",      href: "/most-requested", img: P + "popular.png" },
  { id: "schools",       label: "مدارس",             href: "/school-grants",  img: P + "schools.png" },
  { id: "procedures",    label: "معاملات",            href: "/procedures",     img: P + "procedures.png" },
  { id: "salary",        label: "المعاش",             href: "/salary",         img: P + "salary.png" },
  { id: "taxi",          label: "تاكسي",             href: "/taxi",           img: P + "taxi.png" },
  { id: "market",        label: "السوق",             href: "/marketplace",    img: P + "market.png" },
  { id: "jobs",          label: "وظائف",             href: "/jobs",           img: P + "jobs.png" },
  { id: "health",        label: "الصحة",             href: "/health",         img: P + "health.png" },
  { id: "laws",          label: "القوانين",           href: "/legal",          img: P + "laws.png" },
  { id: "community",     label: "مجتمعي",            href: "/community",      img: P + "community.png" },
  { id: "all",           label: "كل الخدمات",        href: "/services",       img: P + "all.png" },
  { id: "network",       label: "الشبكة",            href: "/network",        img: P + "network.png" },
  { id: "forms",         label: "النماذج",            href: "/forms",          img: P + "forms.png" },
  { id: "faq",           label: "الأسئلة",            href: "/faq",            img: P + "faq.png" },
  { id: "announcements", label: "التعاميم",           href: "/updates",        img: P + "announcements.png" },
  { id: "news",          label: "الأخبار",            href: "/news",           img: P + "news.png" },
  { id: "deaths",        label: "الوفيات",            href: "/deaths",         img: P + "deaths.png" },
  { id: "vote",          label: "التصويت",            href: "/voting",         img: P + "vote.png" },
  { id: "profile",       label: "ملفي",              href: "/profile",        img: P + "profile.png" },
  { id: "settings",      label: "الإعدادات",          href: "/settings",       img: P + "settings.png" },
  { id: "saved",         label: "المحفوظات",          href: "/saved",          img: P + "saved.png" },
] as const;

export default function WatanyCleanHome() {
  const navigate = useNavigate();
  const [welcome, setWelcome] = useState(() => !sessionStorage.getItem("wch-seen"));

  function go(path: string) { navigate(path); }
  function dismiss() { sessionStorage.setItem("wch-seen", "1"); setWelcome(false); }

  return (
    <div className="wch-root" dir="rtl">
      <header className="wch-topbar">
        <img className="wch-logo" src="/logo.png" alt="موطني" />
        <div className="wch-ticker">خدمات المحاربين القدامى</div>
        <button className="wch-burger" type="button" aria-label="القائمة">
          <span /><span /><span />
        </button>
      </header>

      {welcome && (
        <button type="button" className="wch-overlay" onClick={dismiss} aria-label="إغلاق شاشة الترحيب">
          <section className="wch-welcome" role="dialog" aria-label="مرحبا" onClick={e => e.stopPropagation()}>
            <button className="wch-modal-close" type="button" onClick={dismiss}>×</button>
            <img className="wch-welcome-logo" src="/logo.png" alt="موطني" />
            <h1>أهلاً وسهلاً في موطني</h1>
            <p>مساعدك الذكي للمحاربين القدامى</p>
            <div className="wch-welcome-btns">
              <button type="button" onClick={() => { dismiss(); go("/login"); }}>تسجيل الدخول</button>
              <button type="button" onClick={dismiss}>ابدأ التصفح</button>
            </div>
          </section>
        </button>
      )}

      <section className="wch-grid" aria-label="خدمات موطني">
        {tiles.map(t => (
          <button key={t.id} type="button" className="wch-tile" onClick={() => go(t.href)} aria-label={t.label} data-route={t.href}>
            <img src={t.img} alt={t.label} draggable={false} />
          </button>
        ))}
      </section>

      <form className="wch-chat" onSubmit={e => e.preventDefault()} aria-label="اسأل موطني">
        <button type="button" className="wch-chat-btn">🎙</button>
        <input className="wch-chat-input" placeholder="اسأل موطني..." />
        <button type="submit" className="wch-chat-btn">➤</button>
      </form>

      <nav className="wch-bottom" aria-label="التنقل السريع">
        <button type="button" className="wch-nav-active" onClick={() => go("/")}>الرئيسية</button>
        <button type="button" onClick={() => go("/chat")}>المساعد</button>
        <button type="button" onClick={() => go("/services")}>الخدمات</button>
        <button type="button" onClick={() => go("/notifications")}>الإشعارات</button>
        <button type="button" onClick={() => go("/profile")}>حسابي</button>
      </nav>
    </div>
  );
}
