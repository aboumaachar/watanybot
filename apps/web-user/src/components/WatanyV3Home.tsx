import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Tile = { id: string; label: string; href: string; img: string };

const A = "/watany-assets/after-reference-icons/";

const tiles: Tile[] = [
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

const bottom = [
  { label: "الرئيسية", href: "/" },
  { label: "التنزيلات", href: "/downloads" },
  { label: "الملفات", href: "/files" },
  { label: "الإشعارات", href: "/notifications" },
  { label: "الدخول", href: "/login" }
];

function cleanGlobalShell() {
  document.querySelectorAll(".wr-dock,.wr-safe-dock,.watany-v1-snapped-popup-overlay,.watany-v1-header-snap-closeout,.watany-v1-body-portal-snap-closeout,.watany-force-clone-host,iframe.watany-force-clone-frame,[class*='guided-help'],[data-guided-help]").forEach((node) => {
    if (node instanceof HTMLElement && !node.closest(".wv3-root")) {
      node.remove();
    }
  });
}

export default function WatanyV3Home() {
  const navigate = useNavigate();
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    cleanGlobalShell();
    const timer = window.setInterval(cleanGlobalShell, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const s = useMemo(() => {
    const shellWidth = "min(100vw, 430px)";
    return {
      root: { width: shellWidth, minHeight: "100dvh", margin: "0 auto", padding: "92px 8px 170px", background: "linear-gradient(180deg,#fffdf7 0%,#f8f0df 100%)", color: "#073f2a", fontFamily: "Segoe UI, Tahoma, Arial, sans-serif", overflowX: "hidden", boxSizing: "border-box" } as const,
      topbar: { position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: shellWidth, height: "82px", zIndex: 10000, display: "grid", gridTemplateColumns: "70px 1fr 70px", alignItems: "center", gap: "8px", padding: "8px 10px", boxSizing: "border-box", background: "rgba(255,253,246,.98)", borderBottom: "1px solid rgba(214,167,42,.32)", boxShadow: "0 8px 18px rgba(22,59,44,.08)" } as const,
      logo: { width: "58px", height: "58px", objectFit: "contain", justifySelf: "start" } as const,
      ticker: { height: "44px", display: "grid", placeItems: "center", border: "1px solid rgba(214,167,42,.5)", borderRadius: "14px", background: "#f6edcf", fontWeight: 950, fontSize: "15px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const,
      burger: { width: "58px", height: "58px", borderRadius: "14px", border: "1px solid rgba(214,167,42,.42)", background: "rgba(255,255,255,.86)", display: "grid", placeItems: "center", padding: "12px" } as const,
      burgerLine: { width: "32px", height: "4px", background: "#073f2a", borderRadius: "999px", display: "block" } as const,
      grid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "10px 0", justifyItems: "center", alignItems: "start" } as const,
      tile: { border: 0, background: "transparent", padding: 0, margin: 0, width: "100%", display: "grid", placeItems: "center", cursor: "pointer" } as const,
      icon: { width: "min(29vw,116px)", maxWidth: "116px", height: "auto", display: "block", objectFit: "contain", pointerEvents: "none" } as const,
      chat: { position: "fixed", left: "50%", bottom: "64px", transform: "translateX(-50%)", width: shellWidth, zIndex: 10000, display: "grid", gridTemplateColumns: "74px 1fr 74px", gap: "8px", padding: "8px", boxSizing: "border-box", background: "rgba(255,255,255,.94)", borderTop: "1px solid rgba(214,167,42,.22)", boxShadow: "0 -8px 18px rgba(22,59,44,.07)" } as const,
      bottomBar: { position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)", width: shellWidth, height: "64px", zIndex: 10000, display: "grid", gridTemplateColumns: "repeat(5,1fr)", background: "rgba(255,253,247,.97)", borderTop: "1px solid rgba(214,167,42,.22)", boxShadow: "0 -8px 18px rgba(22,59,44,.06)" } as const,
      modal: { position: "fixed", inset: "12px", zIndex: 20000, width: "min(92vw,390px)", maxHeight: "calc(100dvh - 24px)", margin: "0 auto", overflow: "auto", borderRadius: "26px", border: "1px solid rgba(214,167,42,.34)", background: "rgba(255,253,247,.97)", boxShadow: "0 22px 60px rgba(22,59,44,.18)", padding: "28px 18px", textAlign: "center", boxSizing: "border-box" } as const,
    };
  }, []);

  function go(path: string) { navigate(path); }

  return (
    <main className="wv3-root" dir="rtl" style={s.root} data-clean-room="watany-v3-home">
      <header className="wv3-topbar" style={s.topbar}>
        <img src="/logo.png" alt="موطني" style={s.logo} />
        <div style={s.ticker}>تحديثات خدمات المحاربين القدامى والوصول السريع</div>
        <button type="button" style={s.burger} onClick={() => setMenuOpen(true)} aria-label="القائمة">
          <span style={s.burgerLine} /><span style={s.burgerLine} /><span style={s.burgerLine} />
        </button>
      </header>

      {welcomeOpen && (
        <section className="wv3-welcome" style={s.modal} role="dialog" aria-label="أهلاً وسهلاً في موطني">
          <button type="button" onClick={() => setWelcomeOpen(false)}>×</button>
          <h1>أهلاً وسهلاً في موطني 👋</h1>
          <p>مساعدك الذكي. من أين تحب أن تبدأ؟</p>
          <button type="button" onClick={() => go("/login")}>تسجيل الدخول</button>
          <button type="button" onClick={() => setWelcomeOpen(false)}>ابدأ التصفح</button>
        </section>
      )}

      {menuOpen && (
        <section className="wv3-menu" style={s.modal} role="dialog" aria-label="القائمة">
          <button type="button" onClick={() => setMenuOpen(false)}>×</button>
          <h2>القائمة</h2>
          {tiles.map((tile) => <button key={tile.id} type="button" onClick={() => { setMenuOpen(false); go(tile.href); }}>{tile.label}</button>)}
        </section>
      )}

      <section className="wv3-grid" style={s.grid} aria-label="خدمات موطني">
        {tiles.map((tile) => (
          <button key={tile.id} type="button" style={s.tile} onClick={() => go(tile.href)} data-route={tile.href} aria-label={tile.label}>
            <img src={tile.img} alt={tile.label} style={s.icon} onError={(event) => { event.currentTarget.src = A + "all.png"; }} />
          </button>
        ))}
      </section>

      <form className="wv3-chat" style={s.chat} onSubmit={(event) => event.preventDefault()}>
        <button type="button">صوت</button>
        <input placeholder="اسأل موطني..." />
        <button type="submit">إرسال</button>
      </form>

      <nav className="wv3-bottom" style={s.bottomBar}>
        {bottom.map((item) => <button key={item.href} type="button" onClick={() => go(item.href)}>{item.label}</button>)}
      </nav>
    </main>
  );
}
