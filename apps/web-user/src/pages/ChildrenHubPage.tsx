import { Link } from "react-router-dom";
import { WatanyFeatureTemplate } from "../components/template";
import "../theme/watany-v4/childrenHub.css";

const childrenActions = [
  {
    title: "أطلب مساعدة",
    description: "اطرح حاجتك أو سؤالك ليصل إلى مجتمع موطني.",
    href: "/chat",
    tone: "primary",
  },
  {
    title: "أعرض مساعدة",
    description: "شارك خبرتك أو وقتك لمساندة أبناء العسكريين.",
    href: "/groups",
    tone: "secondary",
  },
  {
    title: "الفرص المؤقتة",
    description: "استعرض فرص العمل الجزئي والتدريب والعمل الموسمي.",
    href: "/jobs",
    tone: "secondary",
  },
  {
    title: "الفرص التطوعية",
    description: "اعثر على نشاط تطوعي أو سجّل اهتمامك بالمشاركة.",
    href: "/groups",
    tone: "secondary",
  },
  {
    title: "انشر سيرتي الذاتية",
    description: "انتقل إلى مساحة السيرة الذاتية لعرض مهاراتك وخبرتك.",
    href: "/jobs?section=cv",
    tone: "secondary",
  },
  {
    title: "أبحث عن فرصة",
    description: "ابحث في الفرص المنشورة بحسب المجال والمكان ونوع العمل.",
    href: "/jobs",
    tone: "secondary",
  },
] as const;

export default function ChildrenHubPage() {
  return (
    <WatanyFeatureTemplate category="community" title="الأبناء">
      <div className="children-hub" data-watany-feature-route="children">
        <header className="children-hub__header">
          <p className="children-hub__eyebrow">مساحة أبناء العسكريين</p>
          <h1>الأبناء</h1>
          <p>
            مساحة للتعاون بين أبناء العسكريين: اطلب أو قدّم مساعدة، تابع الفرص المؤقتة، شارك في التطوع، أو اعرض سيرتك الذاتية.
          </p>
        </header>

        <section className="children-hub__actions" aria-label="خدمات الأبناء">
          {childrenActions.map((action) => (
            <Link key={action.title} className={`children-hub__action children-hub__action--${action.tone}`} to={action.href}>
              <span className="children-hub__action-title">{action.title}</span>
              <span className="children-hub__action-description">{action.description}</span>
              <span className="children-hub__action-arrow" aria-hidden="true">←</span>
            </Link>
          ))}
        </section>

        <p className="children-hub__note">
          تبقى الإعلانات والفرص المنشورة خاضعة للمراجعة، ولا تشارك بيانات حساسة قبل التحقق من الجهة المعنية.
        </p>
      </div>
    </WatanyFeatureTemplate>
  );
}
