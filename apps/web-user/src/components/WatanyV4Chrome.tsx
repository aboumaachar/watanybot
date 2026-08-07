import { createPortal } from "react-dom";
import type { NavigateFunction } from "react-router-dom";

const A = "/watany-assets/after-reference-icons/";

type Tile = { id: string; label: string; href: string; img: string };

export const WATANY_V4_TILES: Tile[] = [
  { id: "popular", label: "الأكثر طلباً", href: "/popular", img: A + "popular.png" },
  { id: "latest", label: "الأحدث", href: "/latest", img: A + "latest.png" },
  { id: "important", label: "ممكن يهمك", href: "/important", img: A + "important.png" },
  { id: "salary", label: "المعاش", href: "/salary", img: A + "salary.png" },
  { id: "procedures", label: "معاملات", href: "/procedures", img: A + "procedures.png" },
  { id: "schools", label: "مدارس", href: "/school-grants", img: A + "schools.png" },
  { id: "jobs", label: "وظائف", href: "/jobs", img: A + "jobs.png" },
  { id: "market", label: "السوق", href: "/marketplace", img: A + "market.png" },
  { id: "taxi", label: "تاكسي", href: "/taxi", img: A + "taxi.png" },
  { id: "announcements", label: "التعاميم", href: "/announcements", img: A + "announcements.png" },
  { id: "tools", label: "أدوات", href: "/tools", img: A + "tools.png" },
  { id: "network", label: "الشبكة", href: "/network", img: A + "network.png" },
  { id: "vote", label: "صوّت", href: "/vote", img: A + "vote.png" },
  { id: "community", label: "مجتمعي", href: "/community", img: A + "community.png" },
  { id: "deaths", label: "وفيات", href: "/deaths", img: A + "deaths.png" },
  { id: "faq", label: "أسئلة", href: "/faq", img: A + "faq.png" },
  { id: "laws", label: "قوانين", href: "/laws", img: A + "laws.png" },
  { id: "forms", label: "نماذج", href: "/forms", img: A + "forms.png" },
  { id: "news", label: "أخبار", href: "/news", img: A + "news.png" },
  { id: "fake", label: "زائف", href: "/fake", img: A + "fake.png" },
  { id: "settings", label: "الإعدادات", href: "/settings", img: A + "settings.png" },
  { id: "profile", label: "ملفي", href: "/profile", img: A + "profile.png" },
  { id: "saved", label: "المحفوظات", href: "/saved", img: A + "saved.png" }
];

export const WATANY_V4_BOTTOM = [
  { label: "الرئيسية", href: "/" },
  { label: "التنزيلات", href: "/downloads" },
  { label: "الملفات", href: "/files" },
  { label: "الإشعارات", href: "/notifications" },
  { label: "الدخول", href: "/login" }
];

type ChromeProps = { title: string; navigate: NavigateFunction; onMenu?: () => void };

export function WatanyV4Chrome({ title, navigate, onMenu }: ChromeProps) {
  return createPortal(
    <>
      <div
        id="watany-v4-topbar"
        className="wv4-fixed-topbar"
        data-wv4-fixed="topbar"
        role="banner"
        dir="rtl"
      >
        <button type="button" className="wv4-burger" onClick={onMenu ?? (() => navigate("/"))} aria-label="القائمة">
          <span /><span /><span />
        </button>
        <div className="wv4-ticker">{title}</div>
        <img className="wv4-logo" src="/logo.png" alt="موطني" />
      </div>

      <form className="wv4-fixed-chat" data-wv4-fixed="chat" dir="rtl" onSubmit={(event) => event.preventDefault()}>
        <button type="button">صوت</button>
        <input className="wt-guided-input" placeholder="اسأل موطني..." aria-label="اسأل موطني" />
        <button type="submit">إرسال</button>
      </form>

      <nav className="wv4-fixed-bottom" data-wv4-fixed="bottom" dir="rtl" aria-label="الوصول السريع">
        {WATANY_V4_BOTTOM.map((item) => (
          <button key={item.href} type="button" onClick={() => navigate(item.href)}>
            {item.label}
          </button>
        ))}
      </nav>
    </>,
    document.body
  );
}
