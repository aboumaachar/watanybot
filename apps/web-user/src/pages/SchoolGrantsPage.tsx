import { WatanyFeatureTemplate } from "../components/template";
import { MfeSchoolGrantsCalculator } from "../components/MfeSchoolGrantsCalculator";
import { SchoolAidsRequiredFormsPanel } from "../features/school-aids/SchoolAidsRequiredFormsPanel";
import { getSchoolAidRequiredItem } from "../features/school-aids/schoolAidsRequiredItems";
import { openSchoolAidViewer } from "../features/school-aids/openSchoolAidViewer";
import { WatanyAppIcon } from "../components/watanybot/WatanyAppIcon";
import { PopupModal } from "../components/PopupModal";
import type { SchoolFormIconName } from "../theme/watany-v4/schoolFormIconRegistry";
import { useEffect, useMemo, useState } from "react";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../components/watanybot/watany-drawer.css";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../components/watanybot/watany-drawer-overrides.css";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/SchoolGrantsPage.css";

const SCHOOL_ICON_ITEMS = [
  { id: "sg-calculator",   label: "Calculator",    labelAr: "الحاسبة",        route: "/school-grants#school-grants-calculator",                icon: "calculator", color: "green" as const },
  { id: "sg-ministerial",  label: "Ministerial",   labelAr: "القرار الوزاري", route: "/school-grants#school-grants-ministerial",               icon: "shield",     color: "navy"  as const, schoolFormIcon: "ministerial-decision" as const },
  { id: "sg-tariff",       label: "Tariff",        labelAr: "التعرفة",         route: "/school-grants#school-grants-tariff",                    icon: "document",   color: "slate" as const },
  { id: "sg-forms",        label: "Forms",         labelAr: "النماذج",         route: "/school-grants#school-grants-forms",                     icon: "list",       color: "navy"  as const },
  { id: "sg-apply",        label: "Apply",         labelAr: "طلب مساعدة",      route: "/school-aids/forms/school-aid-application.html",        icon: "edit",       color: "green" as const, schoolFormIcon: "generic-application-form" as const },
  { id: "sg-annex-z",      label: "End Cert",      labelAr: "افادة انهاء",     route: "/school-aids/forms/annex-z.pdf",                         icon: "download",   color: "slate" as const },
  { id: "sg-annex-j",      label: "School Form",   labelAr: "مدرسة",           route: "/school-aids/forms/annex-j.pdf",                         icon: "education",  color: "navy"  as const, schoolFormIcon: "school-form" as const },
  { id: "sg-uni",          label: "University",    labelAr: "جامعة",           route: "/school-aids/forms/school-year-completion-certificate.pdf", icon: "education",  color: "green" as const, schoolFormIcon: "university-form" as const },
  { id: "sg-terms",        label: "Terms",         labelAr: "الشروط",          route: "/school-grants#school-grants-terms",                     icon: "law",        color: "slate" as const },
];

type SchoolChildPopupView =
  | "none"
  | "calculator"
  | "ministerial"
  | "tariff"
  | "forms"
  | "terms"
  | "apply"
  | "annex-z"
  | "annex-j"
  | "uni";

const SCHOOL_CHILD_POPUP_BY_ID: Record<string, SchoolChildPopupView> = {
  "sg-calculator": "calculator",
  "sg-ministerial": "ministerial",
  "sg-tariff": "tariff",
  "sg-forms": "forms",
  "sg-terms": "terms",
  "sg-apply": "apply",
  "sg-annex-z": "annex-z",
  "sg-annex-j": "annex-j",
  "sg-uni": "uni",
};

const SCHOOL_CHILD_POPUP_TITLE: Record<SchoolChildPopupView, string> = {
  none: "",
  calculator: "الحاسبة",
  ministerial: "القرار الوزاري",
  tariff: "التعرفة",
  forms: "النماذج",
  terms: "الشروط",
  apply: "طلب مساعدة",
  "annex-z": "افادة انهاء",
  "annex-j": "مدرسة",
  uni: "جامعة",
};

const SCHOOL_DIRECT_PREVIEW_BY_POPUP: Partial<Record<SchoolChildPopupView, string>> = {
  apply: "school-aid-application",
  "annex-z": "annex-z",
  "annex-j": "annex-j",
  uni: "school-year-completion-certificate",
};

function resolveSchoolGrantRoute(route: string) {
  if (!("location" in globalThis)) return route;
  const { protocol, hostname, port } = globalThis.location;
  if (port === "5175") {
    return `${protocol}//${hostname}:5174${route}`;
  }
  return route;
}

function SchoolGrantsPageTemplateContent() {
  const [childPopup, setChildPopup] = useState<SchoolChildPopupView>("none");
  const [calculatorMountKey, setCalculatorMountKey] = useState(0);

  useEffect(() => {
    document.body.classList.add("school-grants-feature-active");
    return () => document.body.classList.remove("school-grants-feature-active");
  }, []);

  const popupTitle = useMemo(() => SCHOOL_CHILD_POPUP_TITLE[childPopup], [childPopup]);

  const iconItems = useMemo(
    () => SCHOOL_ICON_ITEMS.map((item) => ({ ...item, route: resolveSchoolGrantRoute(item.route) })),
    [],
  );

  const openChildPopup = (id: string) => {
    const popup = SCHOOL_CHILD_POPUP_BY_ID[id] ?? "none";
    if (popup === "none") return;
    if (popup === "calculator") {
      setCalculatorMountKey((current) => current + 1);
    }
    setChildPopup(popup);
  };

  const closeChildPopup = () => setChildPopup("none");

  const openDocument = async (popup: SchoolChildPopupView) => {
    const itemId = SCHOOL_DIRECT_PREVIEW_BY_POPUP[popup];
    const item = itemId ? getSchoolAidRequiredItem(itemId) : undefined;
    if (!item) return;

    closeChildPopup();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 60));
    await openSchoolAidViewer({
      titleAr: item.titleAr,
      previewUrl: resolveSchoolGrantRoute(item.previewUrl),
      downloadUrl: resolveSchoolGrantRoute(item.downloadUrl),
      preferUniversal: item.preferUniversal,
    });
  };

  return (
    <section dir="rtl" className="school-grants-page" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Tahoma, sans-serif", color: "#0f172a", display: "grid", gap: 16 }}>
      <section className="watany-approved-home-icons watany-icon-grid" aria-label="اختصارات المنح المدرسية">
        {iconItems.map((item) => (
          <WatanyAppIcon
            key={item.id}
            item={item}
            asButton
            automationId={`school-grants-shortcut-${item.id}`}
            schoolFormIcon={item.schoolFormIcon as SchoolFormIconName | undefined}
            onClick={() => openChildPopup(item.id)}
          />
        ))}
      </section>

      {childPopup === "calculator" ? (
        <MfeSchoolGrantsCalculator key={calculatorMountKey} initialView="calculator" />
      ) : null}

      <PopupModal
        open={childPopup !== "none" && childPopup !== "calculator"}
        title={popupTitle}
        onClose={closeChildPopup}
        variant="premium"
        compactMobile
      >
        <section data-school-grants-popup={childPopup === "none" ? undefined : childPopup}>
          {childPopup === "ministerial" ? <section id="school-grants-ministerial" className="school-grants-page__calculator"><MfeSchoolGrantsCalculator initialView="alshoon" /></section> : null}
          {childPopup === "tariff" ? <section id="school-grants-tariff" className="school-grants-page__calculator"><MfeSchoolGrantsCalculator initialView="mfe" /></section> : null}
          {childPopup === "forms" ? <SchoolAidsRequiredFormsPanel mode="forms" showHeader={false} onBeforeOpenViewer={closeChildPopup} /> : null}
          {childPopup === "terms" ? <SchoolAidsRequiredFormsPanel mode="terms" showHeader={false} onBeforeOpenViewer={closeChildPopup} /> : null}
          {SCHOOL_DIRECT_PREVIEW_BY_POPUP[childPopup] ? (
            <SchoolGrantDocumentCard popup={childPopup} onOpen={() => void openDocument(childPopup)} />
          ) : null}
        </section>
      </PopupModal>
    </section>
  );
}

function SchoolGrantDocumentCard({ popup, onOpen }: { popup: SchoolChildPopupView; onOpen: () => void }) {
  const itemId = SCHOOL_DIRECT_PREVIEW_BY_POPUP[popup];
  const item = itemId ? getSchoolAidRequiredItem(itemId) : undefined;
  if (!item) return null;

  return (
    <section className="school-grants-document-card">
      <p>{item.descriptionAr}</p>
      <button
        className="wt-cta-glow"
        type="button"
        onClick={onOpen}
      >
        فتح المستند
      </button>
    </section>
  );
}

function SchoolGrantsPageUnifiedTemplatePage() {
  return (
    <WatanyFeatureTemplate
      title="المنح المدرسية"
      description="متابعة شروط المنح المدرسية والتصاريح والطلبات ضمن صفحة موحدة مع الحفاظ على كل أدوات الصفحة الأصلية."
      category="benefits"
    >
      <div data-watany-template-batch="v1.7.1" data-watany-template-manual-page="school-grants">
        <SchoolGrantsPageTemplateContent />
      </div>
    </WatanyFeatureTemplate>
  );
}

export default SchoolGrantsPageUnifiedTemplatePage;
