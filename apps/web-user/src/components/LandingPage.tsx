import { useState, type ComponentType, type SVGProps } from "react";
import {
  BookOpen24Regular,
  Calculator24Regular,
  Flash24Regular,
  Mic24Regular,
  Phone24Regular,
  Search24Regular,
  ShieldCheckmark24Regular,
  ShoppingBag24Regular,
  Target24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { IconShell } from "./IconShell";
import { useApp } from "../store/app";

const LOGO_SRC = "/logo.png";

const LANDING_FEATURES: Array<{ icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; desc: string; color: string }> = [
  { icon: Mic24Regular, title: "المحادثة الصوتية", desc: "تواصل صوتيا مع موطني للحصول على ردود فورية واضحة.", color: "#0ea5e9" },
  { icon: Calculator24Regular, title: "حاسبة الراتب والمعاشات", desc: "احتسب الراتب والمعاشات استنادا إلى البيانات الرسمية المتاحة.", color: "#22c55e" },
  { icon: BookOpen24Regular, title: "قاعدة المعرفة", desc: "وصول سريع إلى المواد القانونية والإدارية المعتمدة.", color: "#a855f7" },
  { icon: Search24Regular, title: "البحث الذكي", desc: "استكشف المعاملات والوثائق القانونية بدقة وسرعة.", color: "#38bdf8" },
  { icon: ShoppingBag24Regular, title: "السوق", desc: "ادخل إلى السوق المجتمعي لعرض الخدمات والمنتجات والفرص المتاحة.", color: "#10b981" },
  { icon: Target24Regular, title: "إجابات مخصصة", desc: "مخرجات أوضح وفق الرتبة والوضع العسكري أو التقاعدي.", color: "#f97316" },
  { icon: Flash24Regular, title: "استجابة سريعة", desc: "نتائج فورية لتقليل وقت البحث والتنقل بين الخدمات.", color: "#facc15" },
  { icon: Phone24Regular, title: "جاهز لكل جهاز", desc: "تجربة متسقة على الهاتف والجهاز اللوحي والحاسوب.", color: "#14b8a6" },
  { icon: ShieldCheckmark24Regular, title: "حماية الخصوصية", desc: "معالجة آمنة للمعلومات وفق ضوابط الاستخدام المعتمدة.", color: "#ef4444" },
] as const;

type LandingPageProps = Readonly<{
  onEnter: () => void;
}>;

export function LandingPage({ onEnter }: LandingPageProps) {
  const { setChannel } = useApp();
  const [showFeatures, setShowFeatures] = useState(false);

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-logo-xl">
            <img src={LOGO_SRC} alt="موطني" className="landing-hero-img" />
            <h1 className="landing-title">موطني</h1>
            <div className="landing-subtitle">Watany AI Assistant</div>
          </div>

          <p className="landing-tagline">المساعد الذكي للمحاربين القدامى</p>
          <p className="landing-description">
            يوفر موطني وصولا منظما إلى معلومات الراتب والمعاشات والمعاملات الإدارية
            والأحكام العسكرية في واجهة واحدة مدعومة بتقنيات الذكاء الاصطناعي.
          </p>

          <div className="landing-cta-group">
            <button
              className="landing-cta-primary"
              onClick={() => {
                setChannel("web");
                onEnter();
              }}
            >
              ابدأ الاستخدام الآن
            </button>
            <button className="landing-cta-secondary" onClick={() => setShowFeatures(!showFeatures)}>
              استعرض المزايا
            </button>
          </div>
        </div>
      </section>

      {showFeatures && (
        <section className="watany-approved-home-icons landing-features">
          <div className="landing-container">
            <h2 className="landing-section-title">المزايا الرئيسية للخدمة</h2>

            <div className="watany-approved-home-icons landing-features-grid">
              {LANDING_FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="landing-feature-card"
                  style={{ "--landing-feature-color": feature.color } as unknown as React.CSSProperties}
                >
                  <IconShell className="landing-feature-icon koudama-icon-shell" aria-hidden="true">
                    {(() => { const FeatIcon = feature.icon; return <FeatIcon aria-hidden />; })()}
                  </IconShell>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                </div>
              ))}
            </div>

            <div className="landing-cta-bottom">
              <button
                className="landing-cta-primary"
                onClick={() => {
                  setChannel("web");
                  onEnter();
                }}
              >
                جرب موطني الآن مجانا
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="landing-footer">
        <div className="landing-container">
          <div className="landing-tech-badge">
            <span>Powered by </span>
            <strong>Watany AI</strong>
            <span> • </span>
            <strong>Adaptive Voice</strong>
            <span> • </span>
            <strong>React</strong>
            <span> • Developed in Lebanon</span>
          </div>
          <div className="landing-copyright">© 2026 Watany AI Assistant • Veterans Platform</div>
        </div>
      </section>
    </div>
  );
}



