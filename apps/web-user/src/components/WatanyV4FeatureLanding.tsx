import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WatanyV4Chrome } from "./WatanyV4Chrome";

const A = "/watany-assets/after-reference-icons/";

export const WATANY_V4_CLEAN_ROUTES = [
  "/for-you", "/popular", "/latest", "/important", "/salary", "/procedures", "/school-grants",
  "/jobs", "/marketplace", "/taxi", "/announcements", "/tools", "/network",
  "/vote", "/community", "/deaths", "/faq", "/laws", "/forms", "/news", "/fake",
  "/settings", "/profile", "/saved", "/downloads", "/files", "/notifications", "/sports",
  "/login", "/services"
];

const data: Record<string, { label: string; img: string; description: string }> = {
  "/for-you": { label: "يهمك", img: A + "important.png", description: "اختصارات وخدمات قد تهمك." },
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
  "/designs": { label: "التصاميم", img: A + "tools.png", description: "التصاميم غير متاحة حالياً." },
  "/settings": { label: "الإعدادات", img: A + "settings.png", description: "إعدادات الحساب والتطبيق." },
  "/profile": { label: "ملفي", img: A + "profile.png", description: "ملفك الشخصي في موطني." },
  "/saved": { label: "المحفوظات", img: A + "saved.png", description: "العناصر والخدمات المحفوظة." },
  "/downloads": { label: "التنزيلات", img: A + "procedures.png", description: "ملفات قابلة للتنزيل." },
  "/files": { label: "الملفات", img: A + "forms.png", description: "ملفاتك ومستنداتك." },
  "/notifications": { label: "الإشعارات", img: A + "latest.png", description: "إشعاراتك وتنبيهاتك." },
  "/login": { label: "تسجيل الدخول", img: A + "profile.png", description: "ادخل إلى حسابك أو ابدأ التصفح." },
  "/services": { label: "الخدمات", img: A + "all.png", description: "كل خدمات موطني في مكان واحد." },
  "/sports": { label: "الرياضة", img: "/watany-v4/icons/world-cup.png", description: "الأنشطة الرياضية والمشاركة في الفعاليات الرياضية." },
};

function cleanLegacy() {
  document.querySelectorAll(".wr-dock,.wr-safe-dock,.watany-v1-snapped-popup-overlay,.watany-v1-header-snap-closeout,.watany-v1-body-portal-snap-closeout,.watany-force-clone-host,iframe.watany-force-clone-frame,[class*='guided-help'],[data-guided-help]").forEach((node) => {
    if (node instanceof HTMLElement && !node.closest(".wv4-root") && !node.closest("[data-wv4-fixed]")) node.remove();
  });
}

export default function WatanyV4FeatureLanding() {
  const location = useLocation();
  const navigate = useNavigate();
  const item = data[location.pathname] ?? { label: "خدمة موطني", img: A + "all.png", description: "صفحة خدمة ضمن موطني." };

  useEffect(() => {
    cleanLegacy();
    const timer = window.setInterval(cleanLegacy, 1000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);

  return (
    <main className="wv4-root wv4-landing" dir="rtl" data-clean-room="watany-v4-landing">
      <WatanyV4Chrome title={item.label} navigate={navigate} />
      <section className="wv4-card">
        <img src={item.img} alt={item.label} onError={(event) => { event.currentTarget.src = A + "all.png"; }} />
        <h1>{item.label}</h1>
        <p>{item.description}</p>
        <button type="button" onClick={() => navigate("/")}>العودة للرئيسية</button>
      </section>
    </main>
  );
}
