import "../styles/watanyRasterCloneHome.css";
import "../styles/watany-homepage-icons-authority.css";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

type Tile = {
  id: string;
  label: string;
  href: string;
  img: string;
};

const tiles: Tile[] = [
  { id: "important", label: "ممكن يهمك", href: "/important", img: "/watany-assets/after-reference-icons/important.png" },
  { id: "latest", label: "الحدث", href: "/latest", img: "/watany-assets/after-reference-icons/latest.png" },
  { id: "popular", label: "الأكثر طلباً", href: "/popular", img: "/watany-assets/after-reference-icons/popular.png" },
  { id: "schools", label: "مدارس", href: "/school-grants", img: "/watany-assets/after-reference-icons/schools.png" },
  { id: "procedures", label: "معاملات", href: "/procedures", img: "/watany-assets/after-reference-icons/procedures.png" },
  { id: "salary", label: "المعاش", href: "/salary", img: "/watany-assets/after-reference-icons/salary.png" },
  { id: "taxi", label: "تاكسي", href: "/taxi", img: "/watany-assets/after-reference-icons/taxi.png" },
  { id: "market", label: "السوق", href: "/marketplace", img: "/watany-assets/after-reference-icons/market.png" },
  { id: "jobs", label: "وظائف", href: "/jobs", img: "/watany-assets/after-reference-icons/jobs.png" },
  { id: "health", label: "الصحة والرعاية", href: "/health", img: "/watany-assets/after-reference-icons/health.png" },
  { id: "laws", label: "القوانين والأنظمة", href: "/laws", img: "/watany-assets/after-reference-icons/laws.png" },
  { id: "community", label: "مجتمعي", href: "/community", img: "/watany-assets/after-reference-icons/community.png" },
  { id: "all", label: "كل الخدمات", href: "/services", img: "/watany-assets/after-reference-icons/all.png" },
];

export default function WatanyRasterCloneHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const goTo = useCallback((path: string) => navigate(path), [navigate]);

  useEffect(() => {
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }, []);

  return (
    <main className="wr-shell" dir="rtl" data-testid="wr-home" data-apex-authority="wr-shell-rebuilt-safe-v1">
      <header className="wr-topbar" data-testid="wr-topbar">
        <button className="wr-logo" type="button" onClick={() => goTo("/")} aria-label="Watany home">
          <img src="/logo.png" alt="Watany" />
        </button>

        <div className="wr-ticker" data-testid="wr-ticker" dir="rtl">
          <strong>تحديثات</strong>
          <span>خدمات المحاربين القدامى والوصول السريع</span>
        </div>

        <button
          className="wr-menu"
          type="button"
          aria-label="Menu"
          data-testid="wr-menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="wr-drawer"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMenuOpen(false);
            }
          }}
          aria-label="إغلاق القائمة"
        >
          <div className="wr-drawer-panel">
            <button className="wr-drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
            <div className="wr-drawer-list">
              {tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className="wr-drawer-item"
                  onClick={() => { setMenuOpen(false); goTo(tile.href); }}
                >
                  {tile.label}
                </button>
              ))}
            </div>
          </div>
        </button>
      )}

      <section className="wr-grid after-reference-icons" data-testid="wr-grid" aria-label="خدمات موطني">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="wr-tile after-reference-icons"
            onClick={() => goTo(tile.href)}
            aria-label={tile.label}
            data-route={tile.href}
          >
            <img
              className="wr-icon-unit after-reference-icons"
              src={tile.img}
              alt={tile.label}
              draggable={false}
            />
            <span className="sr-only">{tile.label}</span>
          </button>
        ))}
      </section>

      <div className="wr-safe-chat" data-testid="wr-safe-chat">
        <button type="button" className="wr-chat-send" aria-label="إرسال">إرسال</button>
        <input aria-label="اسأل موطني" placeholder="اسأل موطني..." />
        <button type="button" className="wr-chat-mic" aria-label="صوت">صوت</button>
      </div>

      <nav className="wr-safe-bottom" data-testid="wr-safe-bottom" aria-label="Bottom navigation">
        <button type="button" onClick={() => goTo("/")}>
          <img src="/watany-assets/raster-bottom/home.png" alt="Home" />
        </button>
        <button type="button" onClick={() => goTo("/downloads")}>
          <img src="/watany-assets/raster-bottom/downloads.png" alt="Downloads" />
        </button>
        <button type="button" onClick={() => goTo("/files")}>
          <img src="/watany-assets/raster-bottom/files.png" alt="Files" />
        </button>
        <button type="button" onClick={() => goTo("/notifications")}>
          <img src="/watany-assets/raster-bottom/bell.png" alt="Notifications" />
        </button>
        <button type="button" onClick={() => goTo("/login")}>
          <img src="/watany-assets/raster-bottom/login.png" alt="Login" />
        </button>
      </nav>
    </main>
  );
}
