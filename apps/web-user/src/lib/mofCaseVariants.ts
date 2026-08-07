/**
 * MOF Procedure Data Mapper
 * Converts the flat proc_mof_realloc procedure into case variants
 * Each variant includes case-specific requirements, forms, and steps
 */

export interface MofCaseVariant {
  id: string;
  category: string; // Arabic category
  categoryEn: string; // English category
  description: string; // Arabic description
  descriptionEn: string; // English description
  requirements: string[]; // Arabic requirements
  requirementsEn: string[]; // English requirements
  forms: Array<{
    code: string; // ت7, ت8, ت9
    name_ar: string;
    name_en: string;
    description: string;
    required: boolean;
  }>;
  steps: string[]; // Arabic steps
  stepsEn: string[]; // English steps
  conditions?: string[];
  conditionsEn?: string[];
  notes?: string[];
  notesEn?: string[];
}

export interface MofProcedureData {
  procedure_id: string;
  title_ar: string;
  title_en: string;
  summary_ar: string;
  summary_en: string;
  authority_ar: string;
  authority_en: string;
  timeline: string;
  fees: string;
  cases: MofCaseVariant[];
}

/**
 * MOF Case Variants Mapper
 * Maps eligibility categories to specific case variants with detailed information
 */
export const MOF_CASE_VARIANTS: Record<string, MofCaseVariant> = {
  spouse: {
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

  "single-daughter": {
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

  "widow-daughter": {
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

  "minor-son": {
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

  "student-son": {
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

  "disabled-son": {
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

  parent: {
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
};

/**
 * Gets all MOF case variants
 * @returns Array of MOF case variants
 */
export function getAllMofCases(): MofCaseVariant[] {
  return Object.values(MOF_CASE_VARIANTS);
}

/**
 * Gets a specific MOF case by ID
 * @param caseId - The case ID
 * @returns The case variant or undefined
 */
export function getMofCaseById(caseId: string): MofCaseVariant | undefined {
  return MOF_CASE_VARIANTS[caseId];
}

/**
 * Gets all required forms for a case
 * @param caseId - The case ID
 * @returns Array of required forms
 */
export function getRequiredFormsForCase(
  caseId: string
): Array<{ code: string; name_ar: string; name_en: string }> {
  const caseVariant = getMofCaseById(caseId);
  if (!caseVariant) return [];
  return caseVariant.forms.filter((f) => f.required).map((f) => ({
    code: f.code,
    name_ar: f.name_ar,
    name_en: f.name_en,
  }));
}

/**
 * Gets all forms for a case (both required and optional)
 * @param caseId - The case ID
 * @returns Array of all forms
 */
export function getAllFormsForCase(
  caseId: string
): Array<{ code: string; name_ar: string; name_en: string; required: boolean }> {
  const caseVariant = getMofCaseById(caseId);
  if (!caseVariant) return [];
  return caseVariant.forms.map((f) => ({
    code: f.code,
    name_ar: f.name_ar,
    name_en: f.name_en,
    required: f.required,
  }));
}

/**
 * Gets step-by-step instructions for a case
 * @param caseId - The case ID
 * @param lang - Language (ar or en)
 * @returns Array of steps
 */
export function getStepsForCase(caseId: string, lang: "ar" | "en"): string[] {
  const caseVariant = getMofCaseById(caseId);
  if (!caseVariant) return [];
  return lang === "ar" ? caseVariant.steps : caseVariant.stepsEn;
}
