import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const A = "/watany-assets/after-reference-icons/";

export const WATANY_V3_CLEAN_ROUTES = [
  "/popular", "/latest", "/important", "/salary", "/procedures", "/school-grants",
  "/jobs", "/marketplace", "/taxi", "/announcements", "/tools", "/network",
  "/vote", "/community", "/deaths", "/faq", "/laws", "/forms", "/news", "/fake",
  "/settings", "/profile", "/saved", "/downloads", "/files", "/notifications",
  "/login", "/services"
];

const data: Record<string, { label: string; img: string; description: string }> = {
  "/popular": { label: "الأكثر طلباً", img: A + "popular.png", description: "الخدمات الأكثر استخداماً في موطني." },
  "/latest": { label: "الأحدث", img: A + "latest.png", description: "آخر التحديثات والخدمات الجديدة." },
  "/important": { label: "ممكن يهمك", img: A + "important.png", description: "اختصارات وخدمات قد تهمك." },
  "/salary": { label: "المعاش", img: A + "salary.png", description: "حاسبة ومعلومات المعاشات." },
  "/procedures": { label: "معاملات", img: A + "procedures.png", description: "إجراءات ومعاملات وخطوات واضحة." },
  "/school-grants": { label: "مدارس", img: A + "schools.png", description: "المساعدات المدرسية والمستندات المطلوبة." },
  "/jobs": { label: "وظائف", img: A + "jobs.png", description: "فرص العمل والخدمات المهنية." },
  "/marketplace": { label: "السوق", img: A + "market.png", description: "إعلانات وخدمات السوق المحلي." },
  "/taxi": { label: "تاكسي", img: A + "taxi.png", description: "خدمات النقل والتاكسي." },
  "/announcements": { label: "التعاميم", img: A + "announcements.png", description: "تعاميم وإشعارات رسمية." },
  "/tools": { label: "أدوات", img: A + "tools.png", description: "أدوات مساعدة وخدمات سريعة." },
  "/network": { label: "الشبكة", img: A + "network.png", description: "شبكة موطني للخدمات والفرص." },
  "/vote": { label: "صوّت", img: A + "vote.png", description: "التصويت والمشاركة." },
  "/community": { label: "مجتمعي", img: A + "community.png", description: "المجتمع والمجموعات." },
  "/deaths": { label: "وفيات", img: A + "deaths.png", description: "إعلانات الوفيات والتعازي." },
  "/faq": { label: "أسئلة", img: A + "faq.png", description: "الأسئلة الشائعة." },
  "/laws": { label: "قوانين", img: A + "laws.png", description: "القوانين والأنظمة." },
  "/forms": { label: "نماذج", img: A + "forms.png", description: "النماذج والملفات." },
  "/news": { label: "أخبار", img: A + "news.png", description: "الأخبار والتحديثات." },
  "/fake": { label: "زائف", img: A + "fake.png", description: "التحقق من الأخبار والمعلومات." },
  "/settings": { label: "الإعدادات", img: A + "settings.png", description: "إعدادات الحساب والتطبيق." },
  "/profile": { label: "ملفي", img: A + "profile.png", description: "ملفك الشخصي في موطني." },
  "/saved": { label: "المحفوظات", img: A + "saved.png", description: "العناصر والخدمات المحفوظة." },
  "/downloads": { label: "التنزيلات", img: A + "procedures.png", description: "ملفات قابلة للتنزيل." },
  "/files": { label: "الملفات", img: A + "forms.png", description: "ملفاتك ومستنداتك." },
  "/notifications": { label: "الإشعارات", img: A + "latest.png", description: "إشعاراتك وتنبيهاتك." },
  "/login": { label: "تسجيل الدخول", img: A + "profile.png", description: "ادخل إلى حسابك أو ابدأ التصفح." },
  "/services": { label: "الخدمات", img: A + "all.png", description: "كل خدمات موطني في مكان واحد." },
};

function cleanGlobalShell() {
  document.querySelectorAll(".wr-dock,.wr-safe-dock,.watany-v1-snapped-popup-overlay,.watany-v1-header-snap-closeout,.watany-v1-body-portal-snap-closeout,.watany-force-clone-host,iframe.watany-force-clone-frame,[class*='guided-help'],[data-guided-help]").forEach((node) => {
    if (node instanceof HTMLElement && !node.closest(".wv3-root")) {
      node.remove();
    }
  });
}

export default function WatanyV3FeatureLanding() {
  const location = useLocation();
  const navigate = useNavigate();
  const item = data[location.pathname] ?? { label: "خدمة موطني", img: A + "all.png", description: "صفحة خدمة ضمن موطني." };

  useEffect(() => {
    cleanGlobalShell();
    const timer = window.setInterval(cleanGlobalShell, 1000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);

  const s = useMemo(() => {
    const shellWidth = "min(100vw, 430px)";
    return {
      root: { width: shellWidth, minHeight: "100dvh", margin: "0 auto", padding: "92px 8px 170px", background: "linear-gradient(180deg,#fffdf7 0%,#f8f0df 100%)", color: "#073f2a", fontFamily: "Segoe UI, Tahoma, Arial, sans-serif", boxSizing: "border-box" } as const,
      topbar: { position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: shellWidth, height: "82px", zIndex: 10000, display: "grid", gridTemplateColumns: "70px 1fr 70px", alignItems: "center", gap: "8px", padding: "8px 10px", boxSizing: "border-box", background: "rgba(255,253,246,.98)", borderBottom: "1px solid rgba(214,167,42,.32)" } as const,
      logo: { width: "58px", height: "58px", objectFit: "contain" } as const,
      ticker: { height: "44px", display: "grid", placeItems: "center", border: "1px solid rgba(214,167,42,.5)", borderRadius: "14px", background: "#f6edcf", fontWeight: 950, fontSize: "18px" } as const,
      card: { minHeight: "calc(100dvh - 260px)", display: "grid", justifyItems: "center", alignContent: "start", gap: "14px", padding: "28px 14px", borderRadius: "22px", border: "1px solid rgba(214,167,42,.22)", background: "rgba(255,255,255,.72)", boxShadow: "0 18px 36px rgba(22,59,44,.06)", textAlign: "center" } as const,
      icon: { width: "138px", maxWidth: "40vw", height: "auto" } as const,
      chat: { position: "fixed", left: "50%", bottom: "64px", transform: "translateX(-50%)", width: shellWidth, zIndex: 10000, display: "grid", gridTemplateColumns: "74px 1fr 74px", gap: "8px", padding: "8px", boxSizing: "border-box", background: "rgba(255,255,255,.94)" } as const,
      bottomBar: { position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)", width: shellWidth, height: "64px", zIndex: 10000, display: "grid", gridTemplateColumns: "repeat(5,1fr)", background: "rgba(255,253,247,.97)" } as const,
    };
  }, []);

  return (
    <main className="wv3-root" dir="rtl" style={s.root} data-clean-room="watany-v3-landing">
      <header className="wv3-topbar" style={s.topbar}>
        <img src="/logo.png" alt="موطني" style={s.logo} />
        <div style={s.ticker}>{item.label}</div>
        <button type="button" onClick={() => navigate("/")}>الرئيسية</button>
      </header>

      <section className="wv3-card" style={s.card}>
        <img src={item.img} alt={item.label} style={s.icon} onError={(event) => { event.currentTarget.src = A + "all.png"; }} />
        <h1>{item.label}</h1>
        <p>{item.description}</p>
        <button type="button" onClick={() => navigate("/")}>العودة للرئيسية</button>
      </section>

      <form className="wv3-chat" style={s.chat} onSubmit={(event) => event.preventDefault()}>
        <button type="button">صوت</button>
        <input placeholder="اسأل موطني..." />
        <button type="submit">إرسال</button>
      </form>

      <nav className="wv3-bottom" style={s.bottomBar}>
        {[
          { label: "الرئيسية", href: "/" },
          { label: "التنزيلات", href: "/downloads" },
          { label: "الملفات", href: "/files" },
          { label: "الإشعارات", href: "/notifications" },
          { label: "الدخول", href: "/login" },
        ].map((link) => <button key={link.href} type="button" onClick={() => navigate(link.href)}>{link.label}</button>)}
      </nav>
    </main>
  );
}
