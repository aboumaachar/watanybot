import UnifiedPillarPage from "../features/unified-pillars/UnifiedPillarPage";
import { Link } from "react-router-dom";
import { useApp } from "../store/app";

import { WatanyFeatureTemplate } from "../components/template";
function UnifiedGeneratedPillarPageLegacy() {
  return <UnifiedPillarPage pillarId="services" />;
}
export default function UnifiedGeneratedPillarPage() {
  const { profile } = useApp();
  const accountHref = profile.isAuthed ? "/profile#freelance-application" : "/register";

  return (
    <WatanyFeatureTemplate
      category="market"
      eyebrow="WatanyBot unified surface"
      title="Freelance Services"
      description="Standardized WatanyBot page shell migrated in controlled batch v1.4.1."
      meta={[{ label: "Route", value: "/freelance-services" }]}
      className="watany-template-batch-v141"
    >
      <div className="mx-auto mb-4 max-w-5xl rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="leading-7">نموذج طلب العمل الحر مفتوح داخل الملف الشخصي للحساب المسجّل فقط.</p>
          <Link to={accountHref} className="inline-flex rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white">فتح نموذج العمل الحر</Link>
        </div>
      </div>
      <div data-watany-template-batch="v1.4.1" data-watany-template-route="/freelance-services">
        <UnifiedGeneratedPillarPageLegacy />
      </div>
    </WatanyFeatureTemplate>
  );
}