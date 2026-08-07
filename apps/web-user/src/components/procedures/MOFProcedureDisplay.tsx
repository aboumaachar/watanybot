/* eslint-disable jsx-a11y/no-static-element-interactions -- APEX scoped legacy lint closeout: pre-existing MOF display accessibility lint debt; outside compact procedures viewer patch */
import { useState } from "react";
import { useOptionalConfig } from "../../store/app";
import { getFormByCode } from "../../lib/mofForms";
import { buildProcedureApiUrl } from "../../lib/procedures-api";
import { downloadFileFromUrl } from "../../lib/procedures-presenter";
import { ProcedurePreviewViewer, type ProcedurePreviewViewerItem } from "./ProcedurePreviewViewer";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../../styles/mof-procedure.css";

function getFallbackLang(): "ar" | "en" {
  if (typeof document !== "undefined") {
    const documentLang = document.documentElement.lang.trim().toLowerCase();
    if (documentLang.startsWith("en")) return "en";
    if (documentLang.startsWith("ar")) return "ar";
  }

  return "ar";
}

/**
 * Case variant for MOF Pension Reallocation
 * Each case represents a specific beneficiary category with its own requirements and forms
 */
interface MofCaseVariant {
  id: string;
  category: string; // زوجة، ابنة عزباء، etc.
  categoryEn: string;
  description: string;
  descriptionEn: string;
  
  // Case-specific requirements
  requirements: string[];
  requirementsEn: string[];
  
  // Forms assigned to this case
  forms: Array<{
    code: string; // ت7, ت8, ت9
    name_ar: string;
    name_en: string;
    description: string;
    required: boolean;
  }>;
  
  // Case-specific steps
  steps: string[];
  stepsEn: string[];
  
  // Eligibility conditions
  conditions?: string[];
  conditionsEn?: string[];
  
  // Exceptions or special notes
  notes?: string[];
  notesEn?: string[];
}

/**
 * MOF Procedure Display Component
 * Shows pension reallocation process with all case variants, required steps, and forms
 */
export default function MOFProcedureDisplay() {
  const [expandedCase, setExpandedCase] = useState<string | null>("spouse");
  const [shareStatus, setShareStatus] = useState("");
  const [viewerState, setViewerState] = useState<{ caseId: string; formCode: string } | null>(null);
  const lang = useOptionalConfig()?.lang ?? getFallbackLang();
  const isArabic = lang === "ar";

  async function shareForm(formCode: string) {
    const form = getFormByCode(formCode);
    const target = form?.preview_url || form?.download_link || form?.url;
    if (!target) return;

    const absoluteUrl = buildProcedureApiUrl(target);
    const clipboard = globalThis.navigator?.clipboard;

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          title: form?.name_ar || formCode,
          text: form?.description_ar || form?.name_en || formCode,
          url: absoluteUrl,
        });
        setShareStatus(isArabic ? `تمت مشاركة النموذج ${formCode}.` : `Shared form ${formCode}.`);
        return;
      }

      if (clipboard?.writeText) {
        await clipboard.writeText(absoluteUrl);
        setShareStatus(isArabic ? `تم نسخ رابط النموذج ${formCode}.` : `Copied link for ${formCode}.`);
      }
    } catch {
      setShareStatus(isArabic ? "تعذرت مشاركة النموذج حالياً." : "Unable to share this form right now.");
    }
  }

  async function downloadForm(formCode: string) {
    const form = getFormByCode(formCode);
    const target = form?.download_link || form?.preview_url || form?.url;
    if (!target) {
      setShareStatus(isArabic ? "تعذر تنزيل النموذج حالياً." : "Unable to download this form right now.");
      return;
    }

    const succeeded = await downloadFileFromUrl(
      buildProcedureApiUrl(target),
      form?.name_ar || form?.name_en || formCode,
    );

    if (!succeeded) {
      setShareStatus(isArabic ? "تعذر تنزيل النموذج حالياً." : "Unable to download this form right now.");
    }
  }

  // MOF Cases Data
  const mofCases: MofCaseVariant[] = [
    {
      id: "spouse",
      category: "زوجة المتقاعد المتوفي",
      categoryEn: "Spouse of Deceased Retiree",
      description: "الزوجة الشرعية للعسكري المتقاعد الذي توفي",
      descriptionEn: "Legal wife of deceased military retiree",
      requirements: [
        "شهادة وفاة زوج (نسخة من تقرير الوفيات)",
        "عقد زواج أصلي أو موثق",
        "بطاقة هوية الزوجة",
        "إثبات عنوان السكن الحالي",
        "شهادة الحالة الاجتماعية",
      ],
      requirementsEn: [
        "Death certificate of spouse",
        "Original or certified marriage contract",
        "Wife's ID card",
        "Current residence proof",
        "Marital status certificate",
      ],
      forms: [
        {
          code: "ت7",
          name_ar: "طلب إعادة تخصيص معاش تقاعدي",
          name_en: "Pension Reallocation Request",
          description: "النموذج الأساسي لطلب إعادة التخصيص",
          required: true,
        },
        {
          code: "ت8",
          name_ar: "إقرار من مستفيد",
          name_en: "Beneficiary Declaration",
          description: "إقرار وتعهد من الزوجة بعدم الزواج من جديد أثناء صرف المعاش",
          required: true,
        },
        {
          code: "ت9",
          name_ar: "شهادة أيتام وأرامل",
          name_en: "Widow and Orphans Certificate",
          description: "شهادة تثبت صفة الأرملة",
          required: false,
        },
      ],
      steps: [
        "الحصول على شهادة الوفاة من دائرة الصحة العامة",
        "تجميع كل المستندات المطلوبة",
        "تعبئة نمودج ت7 و ت8",
        "التوجه إلى وزارة المالية — دائرة التقاعد مع المستندات كاملة",
        "تسليم الملف للموظف المختص",
        "انتظار المراجعة والتحقق من البيانات",
        "استلام قرار الموافقة أو الرفض",
        "بدء صرف المعاش الجديد",
      ],
      stepsEn: [
        "Obtain death certificate from health authority",
        "Gather all required documents",
        "Complete forms T7 and T8",
        "Visit Ministry of Finance - Pension Department",
        "Submit file to competent official",
        "Wait for review and verification",
        "Receive approval or rejection decision",
        "Begin receiving new pension amount",
      ],
      conditions: [
        "يجب أن تكون الزوجة قد كانت زوجة شرعية وقت وفاة الزوج",
        "لا يمكن الحصول على المعاش إذا تزوجت من جديد",
      ],
      conditionsEn: [
        "Wife must have been legally married at time of spouse's death",
        "Pension will be discontinued if remarried",
      ],
    },
    {
      id: "single-daughter",
      category: "الابنة العزباء",
      categoryEn: "Unmarried Daughter",
      description: "الابنة العزباء للعسكري المتقاعد المتوفي",
      descriptionEn: "Unmarried daughter of deceased military retiree",
      requirements: [
        "شهادة وفاة الوالد",
        "شهادة ميلاد الابنة",
        "بطاقة هوية الابنة (أو جواز سفر)",
        "شهادة حالة اجتماعية (عزباء)",
        "دفتر العائلة أو قيد النفوس",
      ],
      requirementsEn: [
        "Father's death certificate",
        "Daughter's birth certificate",
        "Daughter's ID card",
        "Marital status certificate (single)",
        "Family record or civil registry",
      ],
      forms: [
        {
          code: "ت7",
          name_ar: "طلب إعادة تخصيص معاش تقاعدي",
          name_en: "Pension Reallocation Request",
          description: "النموذج الأساسي للطلب",
          required: true,
        },
        {
          code: "ت8",
          name_ar: "إقرار من مستفيد",
          name_en: "Beneficiary Declaration",
          description: "إقرار بعدم الزواج",
          required: true,
        },
        {
          code: "ت9",
          name_ar: "شهادة أيتام وأرامل",
          name_en: "Widow and Orphans Certificate",
          description: "شهادة يتم",
          required: true,
        },
      ],
      steps: [
        "التأكد من أن الابنة لم تتزوج",
        "جمع المستندات المطلوبة",
        "تعبئة الاستمارات ت7 و ت8 و ت9",
        "التوجه إلى دائرة التقاعد — قسم المستفيدين الإضافيين",
        "تقديم الملف الكامل",
        "انتظار المراجعة",
        "استلام القرار والموافقة",
        "بدء استقطاع المعاش بين الورثة",
      ],
      stepsEn: [
        "Verify daughter has not married",
        "Gather required documents",
        "Complete forms T7, T8, and T9",
        "Visit pension department - additional beneficiaries section",
        "Submit complete file",
        "Wait for review",
        "Receive decision and approval",
        "Begin pension distribution",
      ],
      conditions: [
        "يجب أن تكون عزباء عند تقديم الطلب",
        "إذا تزوجت لاحقاً، توقف المعاش تلقائياً",
        "يجب أن تكون عمرها أقل من 21 سنة (أو حتى نهاية الدراسة)",
      ],
      conditionsEn: [
        "Must be unmarried when submitting request",
        "Pension stops automatically if married later",
        "Must be under 21 years old (until completion of studies)",
      ],
    },
    {
      id: "widow-daughter",
      category: "الابنة الأرملة أو المطلقة",
      categoryEn: "Widow or Divorced Daughter",
      description: "الابنة التي أصبحت أرملة أو مطلقة بعد وفاة والدها",
      descriptionEn: "Daughter who became widow or divorced after father's death",
      requirements: [
        "شهادة وفاة الوالد",
        "شهادة ميلاد الابنة",
        "عقد زواج الابنة",
        "شهادة الطلاق أو وفاة الزوج",
        "بطاقة هوية الابنة",
        "شهادة الحالة الاجتماعية الحالية",
      ],
      requirementsEn: [
        "Father's death certificate",
        "Daughter's birth certificate",
        "Daughter's marriage contract",
        "Divorce or spouse death certificate",
        "Daughter's ID card",
        "Current marital status certificate",
      ],
      forms: [
        {
          code: "ت7",
          name_ar: "طلب إعادة تخصيص معاش تقاعدي",
          name_en: "Pension Reallocation Request",
          description: "طلب إعادة التخصيص",
          required: true,
        },
        {
          code: "ت8",
          name_ar: "إقرار من مستفيد",
          name_en: "Beneficiary Declaration",
          description: "إقرار من الأرملة أو المطلقة",
          required: true,
        },
        {
          code: "ت9",
          name_ar: "شهادة أيتام وأرامل",
          name_en: "Widow and Orphans Certificate",
          description: "شهادة تثبت الوضع الاجتماعي",
          required: true,
        },
      ],
      steps: [
        "الحصول على شهادة الطلاق أو وفاة الزوج",
        "تجميع كافة الوثائق المطلوبة",
        "تعبئة النماذج ت7 و ت8 و ت9",
        "التوجه إلى وزارة المالية بالملف",
        "عرض المستندات على الموظفين",
        "انتظار التحقق من الأهلية",
        "استلام قرار الموافقة",
        "بدء صرف معاش الأرملة/المطلقة",
      ],
      stepsEn: [
        "Obtain divorce or spouse death certificate",
        "Gather all required documents",
        "Complete forms T7, T8, and T9",
        "Go to Ministry of Finance with file",
        "Present documents to officials",
        "Wait for eligibility verification",
        "Receive approval decision",
        "Begin receiving widow/divorcee pension",
      ],
      conditions: [
        "يجب أن تكون قد أصبحت أرملة أو مطلقة بعد وفاة والدها أو قبلها",
        "لا يمكن الزواج من جديد للحفاظ على المعاش",
      ],
      conditionsEn: [
        "Must have become widow or divorced after or before father's death",
        "Cannot remarry to maintain pension",
      ],
    },
    {
      id: "minor-son",
      category: "الابن القاصر",
      categoryEn: "Minor Son",
      description: "الابن الذي لم يبلغ سن الرشد",
      descriptionEn: "Son under age of majority",
      requirements: [
        "شهادة وفاة الوالد",
        "شهادة ميلاد الابن",
        "بطاقة هوية الابن أو شهادة ميلاد",
        "دفتر العائلة",
        "شهادة ولاية للولي القانوني",
      ],
      requirementsEn: [
        "Father's death certificate",
        "Son's birth certificate",
        "Son's ID or birth certificate",
        "Family record",
        "Guardianship certificate for legal guardian",
      ],
      forms: [
        {
          code: "ت7",
          name_ar: "طلب إعادة تخصيص معاش تقاعدي",
          name_en: "Pension Reallocation Request",
          description: "الطلب باسم الولي القانوني",
          required: true,
        },
        {
          code: "ت8",
          name_ar: "إقرار من مستفيد",
          name_en: "Beneficiary Declaration",
          description: "إقرار من الولي القانوني",
          required: true,
        },
        {
          code: "ت9",
          name_ar: "شهادة أيتام وأرامل",
          name_en: "Widow and Orphans Certificate",
          description: "شهادة يتم لإثبات صفة القاصر",
          required: true,
        },
      ],
      steps: [
        "تحديد الولي القانوني (الأم أو جد أو عم)",
        "جمع جميع المستندات",
        "تعبئة النماذج من قبل الولي",
        "التوجه إلى وزارة المالية — قسم المعاشات",
        "تقديم الملف",
        "انتظار دراسة الطلب",
        "استلام الموافقة",
        "صرف المعاش للولي القانوني لصالح الابن",
      ],
      stepsEn: [
        "Identify legal guardian (mother, grandfather, uncle)",
        "Gather all documents",
        "Complete forms by guardian",
        "Visit Ministry of Finance - Pensions Section",
        "Submit file",
        "Wait for review",
        "Receive approval",
        "Pension paid to guardian for son's benefit",
      ],
      conditions: [
        "يجب أن يكون أقل من 18 سنة",
        "يتم صرف المعاش للولي القانوني",
        "عند بلوغ الابن، يتحول الصرف باسمه مباشرة",
      ],
      conditionsEn: [
        "Must be under 18 years old",
        "Pension paid to legal guardian",
        "When son reaches majority, payment transfers to his name",
      ],
    },
    {
      id: "student-son",
      category: "الابن الذي يتابع الدراسة",
      categoryEn: "Son Pursuing Studies",
      description: "الابن الذي لم يكمل دراسته بعد",
      descriptionEn: "Son still pursuing education",
      requirements: [
        "شهادة وفاة الوالد",
        "شهادة ميلاد الابن",
        "شهادة القيد من الجامعة أو المدرسة",
        "بطاقة هوية الابن",
        "دفتر العائلة",
        "شهادة الحالة الاجتماعية",
      ],
      requirementsEn: [
        "Father's death certificate",
        "Son's birth certificate",
        "Enrollment certificate from university or school",
        "Son's ID card",
        "Family record",
        "Marital status certificate",
      ],
      forms: [
        {
          code: "ت7",
          name_ar: "طلب إعادة تخصيص معاش تقاعدي",
          name_en: "Pension Reallocation Request",
          description: "طلب تخصيص معاش الابن الطالب",
          required: true,
        },
        {
          code: "ت8",
          name_ar: "إقرار من مستفيد",
          name_en: "Beneficiary Declaration",
          description: "إقرار من الابن الطالب",
          required: true,
        },
        {
          code: "ت9",
          name_ar: "شهادة أيتام وأرامل",
          name_en: "Widow and Orphans Certificate",
          description: "شهادة يتم",
          required: true,
        },
      ],
      steps: [
        "الحصول على شهادة القيد الجامعي الحالية",
        "إعداد كافة الوثائق المطلوبة",
        "تعبئة النماذج ت7 و ت8 و ت9",
        "التوجه إلى دائرة التقاعد",
        "تقديم الملف مع شهادة القيد",
        "انتظار الموافقة",
        "استلام قرار الموافقة",
        "بدء صرف المعاش",
      ],
      stepsEn: [
        "Obtain current university enrollment certificate",
        "Prepare all required documents",
        "Complete forms T7, T8, and T9",
        "Go to pension department",
        "Submit file with enrollment certificate",
        "Wait for approval",
        "Receive approval decision",
        "Begin receiving pension",
      ],
      conditions: [
        "يجب أن يكون قيده فعال في الجامعة أو المدرسة",
        "عند التخرج، يتطلب إعادة تقييم للأهلية",
        "المعاش يستمر حتى نهاية الدراسة",
      ],
      conditionsEn: [
        "Must have active enrollment in university or school",
        "Eligibility reassessed upon graduation",
        "Pension continues until end of studies",
      ],
    },
    {
      id: "disabled-son",
      category: "الابن المعوق جسدياً أو عقلياً",
      categoryEn: "Disabled Son (Physical or Mental)",
      description: "الابن الذي يعاني من إعاقة جسدية أو عقلية",
      descriptionEn: "Son with physical or mental disability",
      requirements: [
        "شهادة وفاة الوالد",
        "شهادة ميلاد الابن",
        "تقرير طبي يثبت الإعاقة",
        "شهادة إعاقة من وزارة الشؤون الاجتماعية",
        "بطاقة هوية الابن",
        "دفتر العائلة",
      ],
      requirementsEn: [
        "Father's death certificate",
        "Son's birth certificate",
        "Medical report confirming disability",
        "Disability certificate from social affairs ministry",
        "Son's ID card",
        "Family record",
      ],
      forms: [
        {
          code: "ت7",
          name_ar: "طلب إعادة تخصيص معاش تقاعدي",
          name_en: "Pension Reallocation Request",
          description: "طلب تخصيص معاش الابن المعوق",
          required: true,
        },
        {
          code: "ت8",
          name_ar: "إقرار من مستفيد",
          name_en: "Beneficiary Declaration",
          description: "إقرار من الولي القانوني للابن المعوق",
          required: true,
        },
        {
          code: "ت9",
          name_ar: "شهادة أيتام وأرامل",
          name_en: "Widow and Orphans Certificate",
          description: "شهادة يتم",
          required: true,
        },
      ],
      steps: [
        "الحصول على تقرير طبي شامل يثبت الإعاقة",
        "الحصول على شهادة إعاقة من وزارة الشؤون الاجتماعية",
        "جمع كل المستندات المطلوبة",
        "تعبئة النماذج ت7 و ت8 و ت9",
        "التوجه إلى وزارة المالية — قسم الحالات الخاصة",
        "تقديم الملف الكامل",
        "انتظار المراجعة الطبية والإدارية",
        "استلام الموافقة وبدء الصرف",
      ],
      stepsEn: [
        "Obtain comprehensive medical report confirming disability",
        "Get disability certificate from social affairs ministry",
        "Gather all required documents",
        "Complete forms T7, T8, and T9",
        "Visit Ministry of Finance - Special Cases Section",
        "Submit complete file",
        "Wait for medical and administrative review",
        "Receive approval and begin payments",
      ],
      conditions: [
        "يجب أن تتم الموافقة على الإعاقة من قبل اللجان الطبية المختصة",
        "المعاش يستمر طالما الإعاقة موجودة",
        "قد تكون هناك مراجعات دورية للحالة",
      ],
      conditionsEn: [
        "Disability must be approved by medical committees",
        "Pension continues while disability persists",
        "Subject to periodic reviews",
      ],
    },
    {
      id: "parent",
      category: "الوالد أو الوالدة",
      categoryEn: "Parent (Mother or Father)",
      description: "والد أو والدة العسكري المتقاعد المتوفي",
      descriptionEn: "Mother or father of deceased retiree",
      requirements: [
        "شهادة وفاة الابن",
        "شهادة ميلاد الوالد/الوالدة",
        "بطاقة هوية الوالد/الوالدة",
        "شهادة الحالة الاجتماعية",
        "شهادة تثبت خلو الذمة",
        "إثبات أن الوالد/الوالدة لم يكن موظفاً حكومياً",
      ],
      requirementsEn: [
        "Son's death certificate",
        "Parent's birth certificate",
        "Parent's ID card",
        "Marital status certificate",
        "Good conduct certificate",
        "Proof that parent was not government employee",
      ],
      forms: [
        {
          code: "ت7",
          name_ar: "طلب إعادة تخصيص معاش تقاعدي",
          name_en: "Pension Reallocation Request",
          description: "طلب تخصيص معاش الوالد/الوالدة",
          required: true,
        },
        {
          code: "ت8",
          name_ar: "إقرار من مستفيد",
          name_en: "Beneficiary Declaration",
          description: "إقرار من الوالد/الوالدة",
          required: true,
        },
        {
          code: "ت9",
          name_ar: "شهادة أيتام وأرامل",
          name_en: "Widow and Orphans Certificate",
          description: "شهادة تثبت العلاقة الأسرية",
          required: false,
        },
      ],
      steps: [
        "التأكد من عدم كون الوالد/الوالدة موظفاً حكومياً",
        "جمع كل المستندات المطلوبة",
        "تعبئة النماذج ت7 و ت8",
        "التوجه إلى وزارة المالية — قسم المعاشات",
        "تقديم الطلب بشكل رسمي",
        "انتظار دراسة الطلب",
        "استلام الموافقة",
        "بدء صرف المعاش",
      ],
      stepsEn: [
        "Verify parent is not government employee",
        "Gather all required documents",
        "Complete forms T7 and T8",
        "Go to Ministry of Finance - Pensions Section",
        "Submit formal request",
        "Wait for review",
        "Receive approval",
        "Begin receiving pension",
      ],
      conditions: [
        "الوالد/الوالدة يجب أن يكون معالاً من قبل المتقاعد",
        "لا يجوز الحصول على معاش حكومي آخر",
        "يجب أن يكون بلا دخل",
      ],
      conditionsEn: [
        "Parent must have been dependent on retiree",
        "Cannot receive another government pension",
        "Must be without income",
      ],
    },
  ];

  const activePreviewCase = viewerState ? mofCases.find((item) => item.id === viewerState.caseId) || null : null;
  const previewableForms = activePreviewCase
    ? activePreviewCase.forms.filter((item) => Boolean(getFormByCode(item.code)?.preview_url || getFormByCode(item.code)?.url))
    : [];
  const previewItems: ProcedurePreviewViewerItem[] = previewableForms.map((form) => {
    const formMeta = getFormByCode(form.code);
    const previewUrl = formMeta?.preview_url
      ? buildProcedureApiUrl(formMeta.preview_url)
      : formMeta?.url
        ? buildProcedureApiUrl(formMeta.url)
        : undefined;
    const downloadUrl = formMeta?.download_link
      ? buildProcedureApiUrl(formMeta.download_link)
      : previewUrl;

    return {
      id: form.code,
      title: isArabic ? (formMeta?.name_ar || form.name_ar) : (formMeta?.name_en || form.name_en),
      summary: isArabic ? (formMeta?.description_ar || form.description) : (formMeta?.description_en || form.description),
      ...(previewUrl ? { previewUrl } : {}),
      ...(downloadUrl ? { downloadUrl } : {}),
    };
  });

  function openViewer(caseId: string, formCode: string) {
    setViewerState({ caseId, formCode });
    setShareStatus("");
  }

  const toggleCase = (caseId: string) => {
    setExpandedCase(expandedCase === caseId ? null : caseId);
  };

  return (
    <div className="mof-procedure-container">
      <div className="mof-header">
        <h1 className={isArabic ? "title-ar" : "title-en"}>
          {isArabic ? "طلب إعادة تخصيص معاش تقاعدي" : "Pension Reallocation Request"}
        </h1>
        <p className="procedure-code">proc_mof_realloc</p>
        <p className="summary">
          {isArabic
            ? "بعد وفاة المتقاعد، فيه حق لأفراد عيلته يطلبوا إعادة تخصيص المعاش. المستندات بتختلف حسب صفة المستفيد"
            : "After death of retiree, family members can request pension reallocation. Documents vary based on beneficiary status"}
        </p>
      </div>

      <div className="mof-overview">
        <div className="overview-card">
          <h3>{isArabic ? "🏢 جهة الاختصاص" : "🏢 Authority"}</h3>
          <p>{isArabic ? "وزارة المالية — دائرة التقاعد" : "Ministry of Finance - Pension Department"}</p>
        </div>
        <div className="overview-card">
          <h3>{isArabic ? "💰 الرسوم" : "💰 Fees"}</h3>
          <p>{isArabic ? "مجانية" : "Free"}</p>
        </div>
        <div className="overview-card">
          <h3>{isArabic ? "⏱️ المدة" : "⏱️ Timeline"}</h3>
          <p>{isArabic ? "1-3 أشهر" : "1-3 months"}</p>
        </div>
      </div>

      <div className="mof-cases">
        <div className="cases-header">
          <h2>{isArabic ? "حالات المستفيدين" : "Beneficiary Cases"}</h2>
          <p className="cases-subtitle">
            {isArabic
              ? `${mofCases.length} حالات مختلفة — اختر حالتك لرؤية الخطوات والنماذج المطلوبة`
              : `${mofCases.length} different cases - Select your case to see required steps and forms`}
          </p>
        </div>

        <div className="cases-list">
          {mofCases.map((caseItem) => (
            <div key={caseItem.id} className="case-item">
              <div
                className={`case-header ${expandedCase === caseItem.id ? "expanded" : ""}`}
                onClick={() => toggleCase(caseItem.id)}
              >
                <div className="case-title-section">
                  <span className="case-toggle-icon" aria-hidden="true">
                    {expandedCase === caseItem.id ? "−" : "+"}
                  </span>
                  <div className="case-title">
                    <h3 className={isArabic ? "arabic" : "english"}>{isArabic ? caseItem.category : caseItem.categoryEn}</h3>
                    <p className="case-description">{isArabic ? caseItem.description : caseItem.descriptionEn}</p>
                  </div>
                </div>
                <div className="case-meta">
                  <span className="forms-count">{caseItem.forms.length} نماذج</span>
                  <span className="steps-count">{caseItem.steps.length} خطوات</span>
                </div>
              </div>

              {expandedCase === caseItem.id && (
                <div className="case-content">
                  {/* Requirements Section */}
                  <div className="case-section">
                    <h4 className="section-title">
                      ✓ {isArabic ? "المستندات المطلوبة" : "Required Documents"}
                    </h4>
                    <ul className="requirements-list">
                      {(isArabic ? caseItem.requirements : caseItem.requirementsEn).map((req, idx) => (
                        <li key={idx} className="requirement-item">
                          <span className="requirement-number">{idx + 1}</span>
                          <span className="requirement-text">{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Conditions Section */}
                  {caseItem.conditions && caseItem.conditions.length > 0 && (
                    <div className="case-section conditions-section">
                      <h4 className="section-title">⚠️ {isArabic ? " والتنبيهات" : "Conditions & Notes"}</h4>
                      <ul className="conditions-list">
                        {(isArabic ? caseItem.conditions : caseItem.conditionsEn || []).map((cond, idx) => (
                          <li key={idx} className="condition-item">
                            {cond}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Forms Section */}
                  <div className="case-section forms-section">
                    <h4 className="section-title">
                      📄 {isArabic ? "النماذج المطلوبة" : "Required Forms"}
                    </h4>
                    <div className="forms-grid">
                      {caseItem.forms.map((form) => {
                        const formMeta = getFormByCode(form.code);
                        const previewUrl = formMeta?.preview_url ? buildProcedureApiUrl(formMeta.preview_url) : null;
                        const downloadUrl = formMeta?.download_link ? buildProcedureApiUrl(formMeta.download_link) : previewUrl;
                        const canShare = Boolean(formMeta?.preview_url || formMeta?.download_link || formMeta?.url);

                        return (
                          <div key={form.code} className={`form-card ${form.required ? "required" : "optional"}`}>
                            <div className="form-badge">{form.code}</div>
                            <h5>{isArabic ? form.name_ar : form.name_en}</h5>
                            <p className="form-description">{form.description}</p>
                            <span className={`form-status ${form.required ? "required-badge" : "optional-badge"}`}>
                              {form.required ? (isArabic ? "إلزامي" : "Required") : isArabic ? "اختياري" : "Optional"}
                            </span>

                            <div className="form-actions">
                              {previewUrl ? (
                                <button
                                  className="form-action-btn form-action-btn--primary"
                                  type="button"
                                  onClick={() => openViewer(caseItem.id, form.code)}
                                >
                                  {isArabic ? "معاينة" : "Preview"}
                                </button>
                              ) : (
                                <span className="form-action-btn form-action-btn--disabled">{isArabic ? "لا توجد معاينة" : "No preview"}</span>
                              )}

                              {downloadUrl ? (
                                <button className="form-action-btn" type="button" onClick={() => void downloadForm(form.code)}>
                                  {isArabic ? "تحميل" : "Download"}
                                </button>
                              ) : (
                                <span className="form-action-btn form-action-btn--disabled">{isArabic ? "لا يوجد تنزيل" : "No download"}</span>
                              )}

                              {canShare ? (
                                <button className="form-action-btn" type="button" onClick={() => void shareForm(form.code)}>
                                  {isArabic ? "مشاركة" : "Share"}
                                </button>
                              ) : (
                                <span className="form-action-btn form-action-btn--disabled">{isArabic ? "لا توجد مشاركة" : "No share"}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {shareStatus && <div className="form-share-status">{shareStatus}</div>}
                  </div>

                  {/* Steps Section */}
                  <div className="case-section steps-section">
                    <h4 className="section-title">📋 {isArabic ? "خطوات الإجراء" : "Procedure Steps"}</h4>
                    <ol className="steps-list">
                      {(isArabic ? caseItem.steps : caseItem.stepsEn).map((step, idx) => (
                        <li key={idx} className="step-item">
                          <span className="step-number">{idx + 1}</span>
                          <span className="step-text">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Notes Section */}
                  {caseItem.notes && caseItem.notes.length > 0 && (
                    <div className="case-section notes-section">
                      <h4 className="section-title">📌 {isArabic ? "ملاحظات مهمة" : "Important Notes"}</h4>
                      <ul className="notes-list">
                        {(isArabic ? caseItem.notes : caseItem.notesEn || []).map((note, idx) => (
                          <li key={idx}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* General Information */}
      <div className="mof-footer">
        <div className="footer-section">
          <h3>{isArabic ? "ملاحظات عامة" : "General Notes"}</h3>
          <ul>
            <li>{isArabic ? "لا يجوز الجمع بين معاشين من الخزينة" : "Cannot combine two pensions from the treasury"}</li>
            <li>
              {isArabic
                ? "المستندات يجب أن تكون صادرة من جهات رسمية موثوقة"
                : "Documents must be issued by authorized official sources"}
            </li>
            <li>
              {isArabic
                ? "قد تكون هناك مستندات إضافية حسب كل حالة"
                : "Additional documents may be required per case"}
            </li>
          </ul>
        </div>
        <div className="footer-section">
          <h3>{isArabic ? "التواصل" : "Contact Information"}</h3>
          <ul>
            <li>☎️ {isArabic ? "وزارة المالية — دائرة التقاعد" : "Ministry of Finance - Pension Department"}</li>
            <li>📍 {isArabic ? "المحافظات — مكاتب التقاعد" : "Provincial Pension Offices"}</li>
          </ul>
        </div>
      </div>

      {viewerState && activePreviewCase && previewItems.length > 0 && (
        <ProcedurePreviewViewer
          items={previewItems}
          activeId={viewerState.formCode}
          onSelect={(id) => {
            setViewerState({ caseId: activePreviewCase.id, formCode: id });
            setShareStatus("");
          }}
          onClose={() => setViewerState(null)}
          onDownload={(id) => {
            void downloadForm(id);
          }}
          onShare={(id) => {
            void shareForm(id);
          }}
          shareMessage={shareStatus}
        />
      )}
    </div>
  );
}

// useApp hook is imported from store/app

