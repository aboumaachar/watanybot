import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WatanyV4Chrome, WATANY_V4_TILES } from "./WatanyV4Chrome";

const A = "/watany-assets/after-reference-icons/";

function cleanLegacy() {
  document.querySelectorAll(".wr-dock,.wr-safe-dock,.watany-v1-snapped-popup-overlay,.watany-v1-header-snap-closeout,.watany-v1-body-portal-snap-closeout,.watany-force-clone-host,iframe.watany-force-clone-frame,[class*='guided-help'],[data-guided-help]").forEach((node) => {
    if (node instanceof HTMLElement && !node.closest(".wv4-root") && !node.closest("[data-wv4-fixed]")) node.remove();
  });
}

export default function WatanyV4Home() {
  const navigate = useNavigate();
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    cleanLegacy();
    const timer = window.setInterval(cleanLegacy, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="wv4-root" dir="rtl" data-clean-room="watany-v4-home">
      <WatanyV4Chrome title="تحديثات خدمات المحاربين القدامى والوصول السريع" navigate={navigate} onMenu={() => setMenuOpen(true)} />
      {welcomeOpen && (
        <section className="wv4-modal" role="dialog" aria-label="أهلاً وسهلاً في موطني">
          <button type="button" className="wv4-close" onClick={() => setWelcomeOpen(false)}>×</button>
          <h1>أهلاً وسهلاً في موطني 👋</h1>
          <p>مساعدك الذكي. من أين تحب أن تبدأ؟</p>
          <div className="wv4-modal-actions">
            <button type="button" onClick={() => navigate("/login")}>تسجيل الدخول</button>
            <button type="button" onClick={() => setWelcomeOpen(false)}>ابدأ التصفح</button>
          </div>
        </section>
      )}
      {menuOpen && (
        <section className="wv4-modal" role="dialog" aria-label="القائمة">
          <button type="button" className="wv4-close" onClick={() => setMenuOpen(false)}>×</button>
          <h2>القائمة</h2>
          <div className="wv4-menu-list">
            {WATANY_V4_TILES.map((tile) => <button key={tile.id} type="button" onClick={() => { setMenuOpen(false); navigate(tile.href); }}>{tile.label}</button>)}
          </div>
        </section>
      )}
      <section className="wv4-grid" aria-label="خدمات موطني">
        {WATANY_V4_TILES.map((tile) => (
          <button key={tile.id} className="wv4-tile" type="button" onClick={() => navigate(tile.href)} data-route={tile.href} aria-label={tile.label}>
            <img src={tile.img} alt={tile.label} onError={(event) => { event.currentTarget.src = A + "all.png"; }} />
          </button>
        ))}
      </section>
    </main>
  );
}
