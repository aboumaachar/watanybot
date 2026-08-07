/**
 * Watany Official Forms Catalog
 *
 * Lebanese military veteran official forms (نماذج رسمية) based on
 * KB form codes ت2, ت11, ت12, ت22 used in veteran administrative
 * transactions (retirement, dependents, family status changes).
 *
 * Each form includes structured fields for print-ready rendering.
 */

export interface FormField {
  id: string;
  label: string;
  type: "text" | "date" | "number" | "select" | "checkbox" | "textarea" | "signature";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  width?: "full" | "half" | "third";
}

export type FormGovernanceState = "official_verified" | "official_reference";
export type FormReviewStatus = "approved" | "under_review" | "needs_source" | "deprecated" | "fallback_only";
export type FormGovernanceConfidence = "high" | "medium" | "low";

export interface FormSourceRegistryEntry {
  sourceId: string;
  sourceNameAr: string;
  authorityLabel: string;
  reviewOwner: string;
  officialSourceUrl?: string;
  officialReference?: string;
  governanceState: FormGovernanceState;
  reviewStatus: FormReviewStatus;
  lastReviewedAt: string;
  confidence: FormGovernanceConfidence;
  notes?: string;
}

export interface FormGovernance {
  officialSourceLabel: string;
  officialSourceUrl?: string;
  officialReference?: string;
  verifiedAt: string;
  governanceState: FormGovernanceState;
  reviewStatus: FormReviewStatus;
  lastReviewedAt: string;
  authorityLabel: string;
  reviewOwner: string;
  confidence: FormGovernanceConfidence;
  notes?: string;
}

export interface FormTemplate {
  id: string;
  code: string;
  title_ar: string;
  description_ar: string;
  category: string;
  related_tx: number[];
  authority: string;
  fields: FormField[];
  header_html?: string;
  footer_html?: string;
  instructions_ar?: string;
  version: string;
  updatedAt: string;
  sourceId?: string;
  governance?: FormGovernance;
  tags?: string[];
  previewUrl?: string;
  downloadUrl?: string;
  shareUrl?: string;
  origin?: "forms_catalog";
}

const CATALOG_GOVERNANCE_REVIEWED_AT = "2026-05-20";

const FORM_SOURCE_REGISTRY: Record<string, FormSourceRegistryEntry> = {
  retirement: {
    sourceId: "retirement",
    sourceNameAr: "مديرية التقاعد",
    authorityLabel: "دائرة التقاعد - وزارة الدفاع الوطني",
    reviewOwner: "فريق حوكمة النماذج",
    officialReference: "الملف المرجعي لمعاملات التقاعد والوضع العائلي",
    governanceState: "official_verified",
    reviewStatus: "approved",
    lastReviewedAt: CATALOG_GOVERNANCE_REVIEWED_AT,
    confidence: "high",
    notes: "المصدر الأساسي لنماذج المتقاعدين والوضع العائلي.",
  },
  grant: {
    sourceId: "grant",
    sourceNameAr: "الشؤون",
    authorityLabel: "الشؤون",
    reviewOwner: "فريق حوكمة النماذج",
    officialReference: "الملف المرجعي للمساعدات والمنح الاجتماعية والتعليمية",
    governanceState: "official_verified",
    reviewStatus: "approved",
    lastReviewedAt: CATALOG_GOVERNANCE_REVIEWED_AT,
    confidence: "high",
    notes: "تتطلب هذه النماذج متابعة دورية عند تغيّر برامج المساعدة.",
  },
  medical: {
    sourceId: "medical",
    sourceNameAr: "طبابة عسكرية",
    authorityLabel: "الطبابة العسكرية - قيادة الجيش",
    reviewOwner: "فريق حوكمة النماذج",
    officialReference: "الملف المرجعي لنماذج الاستشفاء والتعويضات الطبية",
    governanceState: "official_verified",
    reviewStatus: "approved",
    lastReviewedAt: CATALOG_GOVERNANCE_REVIEWED_AT,
    confidence: "high",
    notes: "تحتاج المراجعة عند تحديث متطلبات الطبابة أو النفقات.",
  },
  laf: {
    sourceId: "laf",
    sourceNameAr: "الجيش اللبناني",
    authorityLabel: "قيادة الجيش",
    reviewOwner: "فريق حوكمة النماذج",
    officialReference: "الملف المرجعي للنماذج الصادرة عن قيادة الجيش",
    governanceState: "official_verified",
    reviewStatus: "approved",
    lastReviewedAt: CATALOG_GOVERNANCE_REVIEWED_AT,
    confidence: "medium",
    notes: "يبقى السلاح الأميري والنماذج المماثلة خاضعة لمراجعة عند تبدل التعليمات التنفيذية.",
  },
  admin: {
    sourceId: "admin",
    sourceNameAr: "الجيش اللبناني",
    authorityLabel: "قيادة الجيش - مديرية الشؤون الإدارية",
    reviewOwner: "فريق حوكمة النماذج",
    officialReference: "الملف المرجعي للإفادات والنماذج الإدارية الرسمية",
    governanceState: "official_reference",
    reviewStatus: "under_review",
    lastReviewedAt: CATALOG_GOVERNANCE_REVIEWED_AT,
    confidence: "medium",
    notes: "المصدر الإداري معتمد، لكن توسيع الفهرس الإداري يجب أن يبقى خاضعاً للمراجعة قبل اعتماد أي سجل جديد.",
  },
};

export function getFormsSourceRegistry(): FormSourceRegistryEntry[] {
  return Object.values(FORM_SOURCE_REGISTRY);
}

/* ------------------------------------------------------------------ */
/*  Form definitions                                                   */
/* ------------------------------------------------------------------ */

const FORMS_CATALOG: FormTemplate[] = [
  {
    id: "form_t2",
    code: "ت2",
    title_ar: "طلب تعديل وضع عائلي",
    description_ar: "نموذج أساسي لطلب تعديل الوضع العائلي للعسكري المتقاعد (تسجيل زواج، ولادة، وفاة، طلاق، إلخ).",
    category: "family_status",
    related_tx: [8, 64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/طلب تعديل وضع عائلي.jpg",
    downloadUrl: "/mof/طلب تعديل وضع عائلي.jpg",
    instructions_ar: "يُعبأ النموذج بخط واضح ويُرفق مع المستندات المطلوبة. يُقدم لدى قسم الشؤون في القطعة الإدارية أو عبر ليبان بوست.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">دائرة التقاعد</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب تعديل وضع عائلي — ت2</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم وتوقيع الجهة المختصة</div></div>
    </div>`,
    fields: [
      { id: "full_name", label: "الاسم الكامل", type: "text", required: true, width: "half", placeholder: "الاسم الثلاثي" },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "half", placeholder: "مثال: 123456" },
      { id: "rank", label: "الرتبة", type: "select", required: true, width: "third", options: ["جندي", "عريف", "رقيب", "رقيب أول", "مساعد", "مساعد أول", "ملازم", "ملازم أول", "نقيب", "رائد", "مقدم", "عقيد", "عميد", "لواء"] },
      { id: "retirement_date", label: "تاريخ الإحالة على التقاعد", type: "date", required: true, width: "third" },
      { id: "unit", label: "الوحدة / القطعة", type: "text", width: "third", placeholder: "آخر وحدة خدم فيها" },
      { id: "id_number", label: "رقم السجل / الهوية", type: "text", required: true, width: "half" },
      { id: "registry_place", label: "محل التسجيل", type: "text", width: "half", placeholder: "القضاء - المحافظة" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "half", placeholder: "03/71 XXXXXX" },
      { id: "address", label: "العنوان الحالي", type: "text", width: "full", placeholder: "المنطقة - الشارع - البناية" },
      { id: "change_type", label: "نوع التعديل المطلوب", type: "select", required: true, width: "half", options: ["تسجيل زواج", "تسجيل ولادة", "تسجيل وفاة", "تسجيل طلاق", "إضافة معال", "شطب معال", "تعديل بيانات", "أخرى"] },
      { id: "change_details", label: "تفاصيل التعديل", type: "textarea", required: true, width: "full", placeholder: "اذكر تفاصيل التعديل المطلوب..." },
      { id: "beneficiary_name", label: "اسم المستفيد / المعال", type: "text", width: "half" },
      { id: "beneficiary_relation", label: "صلة القرابة", type: "select", width: "half", options: ["زوجة", "ابن", "ابنة", "والد", "والدة", "أخرى"] },
      { id: "beneficiary_dob", label: "تاريخ ولادة المستفيد", type: "date", width: "half" },
      { id: "event_date", label: "تاريخ الحدث (زواج/ولادة/إلخ)", type: "date", width: "half" },
      { id: "notes", label: "ملاحظات إضافية", type: "textarea", width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_t11",
    code: "ت11",
    title_ar: "تعهد طلاق",
    description_ar: "نموذج تعهد طلاق يوقع من الابنة المطلقة — يُنظم في دائرة التقاعد بحضور المتقاعد وابنته شخصياً أو لدى كاتب العدل.",
    category: "divorce_declaration",
    related_tx: [64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    previewUrl: "/mof/تعهد طلاق - ت11.jpg",
    downloadUrl: "/mof/تعهد طلاق - ت11.jpg",
    updatedAt: "2024-01-15",
    instructions_ar: "ينظم هذا التعهد في دائرة التقاعد بحضور المتقاعد وابنته شخصياً أو لدى كاتب العدل في حال عدم الحضور شخصياً.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">دائرة التقاعد</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">تعهد طلاق — ت11</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:180px;margin-top:60px;padding-top:4px">توقيع الابنة المطلقة</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:180px;margin-top:60px;padding-top:4px">توقيع المتقاعد</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:180px;margin-top:60px;padding-top:4px">ختم دائرة التقاعد</div></div>
    </div>`,
    fields: [
      { id: "retiree_name", label: "اسم المتقاعد الكامل", type: "text", required: true, width: "half" },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "half" },
      { id: "rank", label: "الرتبة", type: "text", required: true, width: "third" },
      { id: "retirement_number", label: "رقم المعاش", type: "text", width: "third" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "third" },
      { id: "daughter_name", label: "اسم الابنة المطلقة", type: "text", required: true, width: "half" },
      { id: "daughter_dob", label: "تاريخ ولادة الابنة", type: "date", required: true, width: "half" },
      { id: "divorce_date", label: "تاريخ الطلاق", type: "date", required: true, width: "half" },
      { id: "court_name", label: "اسم المحكمة", type: "text", required: true, width: "half", placeholder: "المحكمة التي أصدرت حكم الطلاق" },
      { id: "ex_husband_name", label: "اسم الزوج السابق", type: "text", width: "full" },
      { id: "declaration", label: "نص التعهد", type: "textarea", required: true, width: "full", placeholder: "أنا الموقع أدناه أتعهد بأن ابنتي المذكورة أعلاه مطلقة ولم تتزوج مجدداً..." },
      { id: "work_status", label: "هل تعمل الابنة بأجر؟", type: "select", required: true, width: "half", options: ["لا تعمل", "تعمل بأجر", "تركت العمل"] },
      { id: "insurance_status", label: "هل لديها ضمان؟", type: "select", required: true, width: "half", options: ["لا ضمان لديها", "مضمونة من جهة أخرى"] },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "third" },
      { id: "retiree_signature", label: "توقيع المتقاعد", type: "signature", required: true, width: "third" },
      { id: "daughter_signature", label: "توقيع الابنة", type: "signature", required: true, width: "third" },
    ],
  },
  {
    id: "form_t12",
    code: "ت12",
    title_ar: "إقرار من متقاعد",
    description_ar: "نموذج إقرار يعبأ من قبل المتقاعد الحي — يُستخدم لتأكيد البيانات الشخصية والعائلية عند تعديل الوضع أو تجديد بطاقة الخدمات.",
    category: "retiree_declaration",
    related_tx: [8, 64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    previewUrl: "/mof/اقرار من متقاعد - ت12.jpg",
    downloadUrl: "/mof/اقرار من متقاعد - ت12.jpg",
    updatedAt: "2024-01-15",
    instructions_ar: "يعبأ هذا الإقرار في حال كان المتقاعد حياً. يوقع ويصدّق من المختار ويقدم مع المعاملة.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">دائرة التقاعد</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">إقرار من متقاعد — ت12</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع وختم المختار</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع المتقاعد</div></div>
    </div>`,
    fields: [
      { id: "full_name", label: "الاسم الكامل", type: "text", required: true, width: "half" },
      { id: "father_name", label: "اسم الأب", type: "text", required: true, width: "half" },
      { id: "mother_name", label: "اسم الأم وشهرتها", type: "text", width: "half" },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "half" },
      { id: "rank", label: "الرتبة", type: "select", required: true, width: "third", options: ["جندي", "عريف", "رقيب", "رقيب أول", "مساعد", "مساعد أول", "ملازم", "ملازم أول", "نقيب", "رائد", "مقدم", "عقيد", "عميد", "لواء"] },
      { id: "retirement_date", label: "تاريخ الإحالة على التقاعد", type: "date", required: true, width: "third" },
      { id: "pension_number", label: "رقم المعاش", type: "text", width: "third" },
      { id: "dob", label: "تاريخ الولادة", type: "date", required: true, width: "half" },
      { id: "place_of_birth", label: "محل الولادة", type: "text", width: "half" },
      { id: "registry_number", label: "رقم السجل", type: "text", required: true, width: "third" },
      { id: "registry_place", label: "محل التسجيل", type: "text", required: true, width: "third" },
      { id: "id_number", label: "رقم الهوية", type: "text", width: "third" },
      { id: "marital_status", label: "الحالة الاجتماعية", type: "select", required: true, width: "half", options: ["أعزب", "متأهل", "أرمل", "مطلق"] },
      { id: "spouse_name", label: "اسم الزوج/ة", type: "text", width: "half" },
      { id: "children_count", label: "عدد الأولاد", type: "number", width: "third" },
      { id: "dependents_details", label: "تفاصيل المعالين", type: "textarea", width: "full", placeholder: "اذكر اسم كل معال وتاريخ ولادته وصلة القرابة" },
      { id: "address", label: "العنوان الحالي", type: "text", required: true, width: "full" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "half" },
      { id: "declaration_text", label: "نص الإقرار", type: "textarea", required: true, width: "full", placeholder: "أقر أنا الموقع أدناه بأن المعلومات الواردة أعلاه صحيحة..." },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_t22",
    code: "ت22",
    title_ar: "طلب مساعدة مدرسية",
    description_ar: "نموذج طلب مساعدة مدرسية من تعاونية موظفي الدولة — يُقدم سنوياً مع إفادات الدراسة.",
    category: "schooling_aid",
    related_tx: [53],
    authority: "تعاونية موظفي الدولة",
    version: "2024-01",
    updatedAt: "2024-01-15",
    instructions_ar: "يُقدم الطلب لدى شؤون المناطق مع إفادة متابعة دراسة مصدقة وإخراج قيد عائلي حديث (3 أشهر).",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">تعاونية موظفي الدولة</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">شؤون المناطق</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب مساعدة مدرسية — ت22</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم شؤون المناطق</div></div>
    </div>`,
    fields: [
      { id: "full_name", label: "اسم العسكري المتقاعد", type: "text", required: true, width: "half" },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "half" },
      { id: "rank", label: "الرتبة", type: "text", required: true, width: "third" },
      { id: "pension_number", label: "رقم المعاش", type: "text", width: "third" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "third" },
      { id: "academic_year", label: "العام الدراسي", type: "text", required: true, width: "half", placeholder: "مثال: 2025-2026" },
      { id: "student_name", label: "اسم الطالب/ة", type: "text", required: true, width: "half" },
      { id: "student_relation", label: "صلة القرابة", type: "select", required: true, width: "third", options: ["ابن", "ابنة"] },
      { id: "student_dob", label: "تاريخ ولادة الطالب/ة", type: "date", required: true, width: "third" },
      { id: "student_age", label: "العمر", type: "number", width: "third" },
      { id: "school_name", label: "اسم المدرسة / الجامعة", type: "text", required: true, width: "half" },
      { id: "school_type", label: "نوع المؤسسة", type: "select", required: true, width: "half", options: ["رسمية", "خاصة", "جامعة رسمية", "جامعة خاصة"] },
      { id: "class_level", label: "الصف / السنة الدراسية", type: "text", required: true, width: "half" },
      { id: "tuition_amount", label: "قيمة القسط السنوي (ل.ل.)", type: "number", width: "half" },
      { id: "other_children", label: "أسماء أبناء آخرين مستفيدين", type: "textarea", width: "full", placeholder: "اذكر أسماء الأبناء الآخرين المسجلين وصفوفهم" },
      { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_pension_attestation",
    code: "معاش-1",
    title_ar: "طلب إفادة معاش تقاعدي",
    description_ar: "نموذج طلب إفادة معاش تقاعدي للاستعمال لدى المصارف أو السفارات أو الإدارات العامة.",
    category: "pension_attestation",
    related_tx: [8],
    authority: "وزارة المالية - خدمة المتقاعدين العسكريين",
    version: "2024-01",
    updatedAt: "2024-01-15",
    instructions_ar: "يُحدد سبب طلب الإفادة والجهة المستفيدة منها، ويُذكر رقم المعاش أو الرقم العسكري عند الاقتضاء.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة المالية</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">خدمة المتقاعدين العسكريين</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب إفادة معاش تقاعدي</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم المرجع المختص</div></div>
    </div>`,
    fields: [
      { id: "full_name", label: "الاسم الكامل", type: "text", required: true, width: "half" },
      { id: "mother_name", label: "اسم الأم", type: "text", width: "half" },
      { id: "pension_number", label: "رقم المعاش", type: "text", width: "third" },
      { id: "military_number", label: "الرقم العسكري", type: "text", width: "third" },
      { id: "rank", label: "الرتبة", type: "text", width: "third" },
      { id: "certificate_use", label: "سبب الطلب", type: "select", required: true, width: "half", options: ["إفادة معاش للمصرف", "إفادة معاش للسفارة", "إفادة معاش للإدارة العامة", "إفادة معاش للاستخدام الشخصي"] },
      { id: "certificate_period", label: "الفترة المطلوبة", type: "select", width: "half", options: ["آخر شهر", "آخر 3 أشهر", "السنة الجارية", "فترة مخصصة"] },
      { id: "requester_phone", label: "رقم الهاتف", type: "text", width: "half" },
      { id: "requester_email", label: "البريد الإلكتروني", type: "text", width: "half" },
      { id: "delivery_method", label: "طريقة الاستلام", type: "select", width: "half", options: ["استلام شخصي", "بواسطة مفوض", "إرسال إلكتروني"] },
      { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_medical_hospitalization",
    code: "طب-1",
    title_ar: "طلب موافقة استشفاء",
    description_ar: "نموذج طلب موافقة استشفاء أو فتح ملف علاجي للمستفيدين من الطبابة العسكرية.",
    category: "medical_hospitalization",
    related_tx: [],
    authority: "الطبابة العسكرية - قيادة الجيش",
    version: "2024-01",
    updatedAt: "2024-01-15",
    instructions_ar: "يُعبأ الطلب ويرفق بتقرير الطبيب المعالج وصور الفحوص الأساسية قبل مراجعته في الطبابة العسكرية.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني — قيادة الجيش</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">الطبابة العسكرية</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب موافقة استشفاء</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم الطبابة العسكرية</div></div>
    </div>`,
    fields: [
      { id: "retiree_name", label: "اسم المتقاعد", type: "text", required: true, width: "half" },
      { id: "beneficiary_name", label: "اسم المستفيد", type: "text", required: true, width: "half" },
      { id: "beneficiary_relation", label: "صلة القرابة", type: "select", required: true, width: "third", options: ["المتقاعد نفسه", "زوجة", "ابن", "ابنة", "والد", "والدة", "أخرى"] },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "third" },
      { id: "pension_number", label: "رقم المعاش", type: "text", width: "third" },
      { id: "diagnosis", label: "التشخيص الأولي", type: "textarea", required: true, width: "full", placeholder: "اذكر سبب الدخول أو العلاج المطلوب" },
      { id: "treating_doctor", label: "اسم الطبيب المعالج", type: "text", width: "half" },
      { id: "hospital_name", label: "اسم المستشفى / المركز", type: "text", required: true, width: "half" },
      { id: "admission_date", label: "تاريخ الدخول المتوقع", type: "date", width: "half" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "half" },
      { id: "notes", label: "ملاحظات إضافية", type: "textarea", width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_medical_reimbursement",
    code: "طب-2",
    title_ar: "طلب تعويض نفقات طبية",
    description_ar: "نموذج طلب تعويض عن فاتورة استشفاء أو دواء للمستفيدين من الطبابة العسكرية.",
    category: "medical_reimbursement",
    related_tx: [],
    authority: "الطبابة العسكرية - قيادة الجيش",
    version: "2024-01",
    updatedAt: "2024-01-15",
    instructions_ar: "يُرفق الطلب بالفواتير الأصلية والوصفات والتقارير الطبية ويُسلّم ضمن المهلة المعتمدة لدى الطبابة العسكرية.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني — قيادة الجيش</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">الطبابة العسكرية</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب تعويض نفقات طبية</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم الطبابة العسكرية</div></div>
    </div>`,
    fields: [
      { id: "retiree_name", label: "اسم المتقاعد", type: "text", required: true, width: "half" },
      { id: "beneficiary_name", label: "اسم المستفيد", type: "text", required: true, width: "half" },
      { id: "beneficiary_relation", label: "صلة القرابة", type: "select", required: true, width: "third", options: ["المتقاعد نفسه", "زوجة", "ابن", "ابنة", "والد", "والدة", "أخرى"] },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "third" },
      { id: "invoice_number", label: "رقم الفاتورة", type: "text", width: "third" },
      { id: "invoice_date", label: "تاريخ الفاتورة", type: "date", required: true, width: "half" },
      { id: "medical_provider", label: "اسم الجهة الطبية", type: "text", required: true, width: "half" },
      { id: "expense_type", label: "نوع النفقة", type: "select", required: true, width: "half", options: ["استشفاء", "دواء", "فحوصات", "مختبر", "علاج فيزيائي", "أخرى"] },
      { id: "amount", label: "القيمة الإجمالية", type: "number", required: true, width: "half" },
      { id: "payment_destination", label: "وسيلة القبض أو الجهة الدافعة", type: "text", width: "full", placeholder: "حساب مصرفي أو مركز دفع عند الاقتضاء" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "half" },
      { id: "notes", label: "ملاحظات إضافية", type: "textarea", width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_birth_grant",
    code: "ص-1",
    title_ar: "طلب مساعدة اجتماعية عن الولادة أو الزواج",
    description_ar: "نموذج طلب مساعدة اجتماعية أو تعويض مرتبط بولادة أو زواج أحد أفراد عائلة المتقاعد.",
    category: "social_compensation",
    related_tx: [53],
    authority: "الشؤون",
    version: "2024-01",
    updatedAt: "2024-01-15",
    instructions_ar: "يُحدد نوع المساعدة المطلوبة ويُرفق البيان العائلي أو المستند المدني الداعم قبل تسليم الطلب.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني — قيادة الجيش</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">الشؤون</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب مساعدة اجتماعية عن الولادة أو الزواج</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم الشؤون</div></div>
    </div>`,
    fields: [
      { id: "applicant_name", label: "اسم مقدم الطلب", type: "text", required: true, width: "half" },
      { id: "pension_number", label: "رقم المعاش", type: "text", width: "half" },
      { id: "beneficiary_name", label: "اسم المستفيد / المستفيدة", type: "text", required: true, width: "half" },
      { id: "event_type", label: "نوع المساعدة", type: "select", required: true, width: "half", options: ["ولادة", "زواج"] },
      { id: "event_date", label: "تاريخ الواقعة", type: "date", required: true, width: "half" },
      { id: "civil_registry", label: "مرجع السجل المدني", type: "text", width: "half" },
      { id: "payment_destination", label: "طريقة أو جهة القبض", type: "text", width: "full", placeholder: "حساب مصرفي أو مركز دفع معتمد" },
      { id: "supporting_docs", label: "المستندات المرفقة", type: "textarea", width: "full", placeholder: "بيان عائلي، إخراج قيد، عقد زواج، أو مستندات داعمة أخرى" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "half" },
      { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_service_card",
    code: "بطاقة-خ",
    title_ar: "طلب تجديد بطاقة الخدمات الاجتماعية",
    description_ar: "نموذج طلب تجديد أو استبدال بطاقة الخدمات الاجتماعية لمتقاعدي الجيش.",
    category: "service_card",
    related_tx: [64],
    authority: "دائرة التقاعد - قيادة الجيش",
    version: "2024-01",
    updatedAt: "2024-01-15",
    instructions_ar: "يُقدم الطلب لدى قسم الشؤون في القطعة الإدارية مع المستندات المطلوبة. تُستلم البطاقة الجديدة بعد شهر تقريباً.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني — قيادة الجيش</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">دائرة التقاعد</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب تجديد بطاقة الخدمات الاجتماعية</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم قسم الشؤون</div></div>
    </div>`,
    fields: [
      { id: "full_name", label: "الاسم الكامل", type: "text", required: true, width: "half" },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "half" },
      { id: "rank", label: "الرتبة", type: "text", required: true, width: "third" },
      { id: "pension_number", label: "رقم المعاش", type: "text", width: "third" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "third" },
      { id: "card_reason", label: "سبب الطلب", type: "select", required: true, width: "half", options: ["تجديد - انتهاء الصلاحية", "بدل فاقد", "بدل تالف", "تنظيم بطاقة جديدة"] },
      { id: "old_card_number", label: "رقم البطاقة القديمة", type: "text", width: "half" },
      { id: "card_expiry", label: "تاريخ انتهاء البطاقة القديمة", type: "date", width: "half" },
      { id: "dependents_on_card", label: "المعالون المسجلون على البطاقة", type: "textarea", width: "full", placeholder: "اذكر أسماء المعالين وصلات القرابة" },
      { id: "weapon_info", label: "نوع ورقم السلاح الأميري (إن وجد)", type: "text", width: "full", placeholder: "يدون على البطاقة لمن أحيلوا على التقاعد بعد 2018/3/1" },
      { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_service_attestation",
    code: "إدار-1",
    title_ar: "طلب إفادة خدمة أو وضع إداري",
    description_ar: "نموذج طلب إفادة خدمة أو وضع إداري لمتقاعدي الجيش للاستعمال الرسمي لدى الإدارات والسفارات والجهات العامة.",
    category: "administrative_certificate",
    related_tx: [],
    authority: "قيادة الجيش - مديرية الشؤون الإدارية",
    version: "2024-01",
    updatedAt: "2024-01-15",
    instructions_ar: "يُحدد نوع الإفادة والجهة المطلوب تقديمها إليها، ويُذكر سبب الطلب بصورة مختصرة وواضحة.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني — قيادة الجيش</div>
      <div style="font-size:14px;font-weight:bold;margin-bottom:8px">مديرية الشؤون الإدارية</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب إفادة خدمة أو وضع إداري</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم المرجع الإداري</div></div>
    </div>`,
    fields: [
      { id: "full_name", label: "الاسم الكامل", type: "text", required: true, width: "half" },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "half" },
      { id: "rank", label: "الرتبة", type: "text", width: "third" },
      { id: "pension_number", label: "رقم المعاش", type: "text", width: "third" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "third" },
      { id: "certificate_type", label: "نوع الإفادة", type: "select", required: true, width: "half", options: ["إفادة خدمة", "إفادة وضع إداري", "إفادة انتساب سابق", "إفادة للاستعمال الرسمي"] },
      { id: "submission_target", label: "الجهة المطلوب تقديم الإفادة إليها", type: "text", required: true, width: "half" },
      { id: "purpose", label: "سبب الطلب", type: "textarea", width: "full", placeholder: "مثال: مصرف، سفارة، إدارة عامة، ملف إداري" },
      { id: "notes", label: "ملاحظات", type: "textarea", width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_weapon_license",
    code: "رخصة-س",
    title_ar: "طلب تجديد رخصة مسدس أميري",
    description_ar: "نموذج طلب تجديد رخصة حمل مسدس أميري لمتقاعدي الجيش.",
    category: "weapon_license",
    related_tx: [64],
    authority: "قيادة الجيش",
    version: "2024-01",
    updatedAt: "2024-01-15",
    instructions_ar: "يُقدم الطلب لدى سرية الشرطة العسكرية التابعة لمنطقة سكن المتقاعد.",
    header_html: `<div style="text-align:center;margin-bottom:24px">
      <div style="font-size:14px;margin-bottom:4px">الجمهورية اللبنانية</div>
      <div style="font-size:14px;margin-bottom:4px">وزارة الدفاع الوطني — قيادة الجيش</div>
      <div style="font-size:18px;font-weight:bold;border:2px solid #000;display:inline-block;padding:8px 32px">طلب تجديد رخصة مسدس أميري</div>
    </div>`,
    footer_html: `<div style="margin-top:32px;border-top:1px solid #ccc;padding-top:16px;display:flex;justify-content:space-between">
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">توقيع مقدم الطلب</div></div>
      <div style="text-align:center"><div style="border-top:1px solid #000;width:200px;margin-top:60px;padding-top:4px">ختم الشرطة العسكرية</div></div>
    </div>`,
    fields: [
      { id: "full_name", label: "الاسم الكامل", type: "text", required: true, width: "half" },
      { id: "military_number", label: "الرقم العسكري", type: "text", required: true, width: "half" },
      { id: "rank", label: "الرتبة", type: "text", required: true, width: "third" },
      { id: "retirement_date", label: "تاريخ الإحالة على التقاعد", type: "date", width: "third" },
      { id: "phone", label: "رقم الهاتف", type: "text", width: "third" },
      { id: "weapon_type", label: "نوع المسدس", type: "text", required: true, width: "half" },
      { id: "weapon_serial", label: "الرقم التسلسلي", type: "text", required: true, width: "half" },
      { id: "weapon_caliber", label: "العيار", type: "text", width: "third" },
      { id: "purchase_date", label: "تاريخ الشراء", type: "date", width: "third" },
      { id: "current_license_expiry", label: "تاريخ انتهاء الرخصة الحالية", type: "date", width: "third" },
      { id: "address", label: "العنوان", type: "text", required: true, width: "full" },
      { id: "date", label: "التاريخ", type: "date", required: true, width: "half" },
      { id: "signature", label: "التوقيع", type: "signature", required: true, width: "half" },
    ],
  },
  {
    id: "form_t7",
    code: "ت7",
    title_ar: "طلب إعادة تخصيص معاش تقاعدي",
    description_ar: "نموذج طلب إعادة تخصيص المعاش التقاعدي لدى دائرة التقاعد، يُستخدم عند تغيير الوضع العائلي.",
    category: "pension_reallocation",
    related_tx: [8, 64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/طلب اعادة تخصيص معاش تقاعدي - ت7.jpg",
    downloadUrl: "/mof/طلب اعادة تخصيص معاش تقاعدي - ت7.jpg",
    fields: [],
  },
  {
    id: "form_t8",
    code: "ت8",
    title_ar: "إقرار من مستفيد",
    description_ar: "نموذج إقرار يوقع من المستفيد (الزوجة أو الأرملة) بتأكيد البيانات الشخصية والمعاشية.",
    category: "beneficiary_declaration",
    related_tx: [64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/اقرار من مستفيد - ت8.jpg",
    downloadUrl: "/mof/اقرار من مستفيد - ت8.jpg",
    fields: [],
  },
  {
    id: "form_t9",
    code: "ت9",
    title_ar: "شهادة أيتام وأرامل",
    description_ar: "نموذج شهادة للأيتام والأرامل المستفيدة من معاش المتقاعد المتوفى، للاستعمال الرسمي.",
    category: "orphans_widows_certificate",
    related_tx: [64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/شهادة ايتام وارامل - ت9.jpg",
    downloadUrl: "/mof/شهادة ايتام وارامل - ت9.jpg",
    fields: [],
  },
  {
    id: "form_t1",
    code: "ت1",
    title_ar: "طلب دفتر تقاعد - بدل عن ضائع",
    description_ar: "نموذج طلب استخراج دفتر تقاعد بدل عن الضائع من دائرة التقاعد.",
    category: "pension_book_replacement",
    related_tx: [],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/طلب دفتر تقاعد - بدل عن ضائع.pdf",
    downloadUrl: "/mof/طلب دفتر تقاعد - بدل عن ضائع.pdf",
    fields: [],
  },
  {
    id: "form_t3",
    code: "ت3",
    title_ar: "طلب صرف تعويض أو معاش لابن المتقاعد الذي يتابع الدراسة",
    description_ar: "نموذج طلب صرف تعويض عائلي أو معاش تقاعدي لابن المتقاعد الذي يتابع الدراسة.",
    category: "student_compensation",
    related_tx: [64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/طلب صرف تعويض عائلي أو معاش تقاعدي لإبن المتقاعد الذي يتابع الدراسة - ت3.jpg",
    downloadUrl: "/mof/طلب صرف تعويض عائلي أو معاش تقاعدي لإبن المتقاعد الذي يتابع الدراسة - ت3.jpg",
    fields: [],
  },
  {
    id: "form_t4",
    code: "ت4",
    title_ar: "طلب صرف تعويض أو معاش لابنة المتقاعد الأرملة",
    description_ar: "نموذج طلب صرف تعويض عائلي أو معاش تقاعدي لابنة المتقاعد الأرملة أو المطلقة في حال مثابرة ابنها للدراسة.",
    category: "widow_daughter_compensation",
    related_tx: [64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/طلب صرف تعويض عائلي او معاش تقاعدي لإبنة المتقاعد الأرملة او المطلقة في حال مثابرة ابنها للدراسة - ت4 .jpg",
    downloadUrl: "/mof/طلب صرف تعويض عائلي او معاش تقاعدي لإبنة المتقاعد الأرملة او المطلقة في حال مثابرة ابنها للدراسة - ت4 .jpg",
    fields: [],
  },
  {
    id: "form_t5",
    code: "ت5",
    title_ar: "طلب معاينة من اللجنة الطبية",
    description_ar: "نموذج طلب معاينة من اللجنة الطبية الدائمة في وزارة الصحة العامة.",
    category: "medical_examination",
    related_tx: [64],
    authority: "وزارة الصحة العامة / دائرة التقاعد",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/طلب معاينة من اللجنة الطبية الدائمة في وزارة الصحة العامة - ت5.jpg",
    downloadUrl: "/mof/طلب معاينة من اللجنة الطبية الدائمة في وزارة الصحة العامة - ت5.jpg",
    fields: [],
  },
  {
    id: "form_t6",
    code: "ت6",
    title_ar: "طلب إيقاف معاش تقاعدي",
    description_ar: "نموذج طلب إيقاف المعاش التقاعدي من دائرة التقاعد.",
    category: "pension_suspension",
    related_tx: [64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/طلب ايقاف معاش تقاعدي - ت6.jpg",
    downloadUrl: "/mof/طلب ايقاف معاش تقاعدي - ت6.jpg",
    fields: [],
  },
  {
    id: "form_t10",
    code: "ت10",
    title_ar: "طلب تعديل رقم حساب مصرفي",
    description_ar: "نموذج طلب تعديل رقم الحساب المصرفي للمتقاعد لدى دائرة التقاعد.",
    category: "bank_account_modification",
    related_tx: [64],
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    version: "2024-01",
    updatedAt: "2024-01-15",
    previewUrl: "/mof/طلب تعديل رقم حساب مصرفي - ت10.jpg",
    downloadUrl: "/mof/طلب تعديل رقم حساب مصرفي - ت10.jpg",
    fields: [],
  },
];

const CATALOG_GOVERNANCE_VERIFIED_AT = "2026-05-20";

type GovernanceBuildOptions = {
  officialSourceUrl?: string;
  governanceState?: FormGovernanceState;
  reviewStatus?: FormReviewStatus;
  lastReviewedAt?: string;
  confidence?: FormGovernanceConfidence;
  notes?: string;
};

function buildGovernance(
  sourceId: string,
  officialSourceLabel: string,
  officialReference: string,
  options?: GovernanceBuildOptions
): FormGovernance {
  const registryEntry = FORM_SOURCE_REGISTRY[sourceId];
  return {
    officialSourceLabel,
    officialSourceUrl: options?.officialSourceUrl || registryEntry?.officialSourceUrl,
    officialReference,
    verifiedAt: CATALOG_GOVERNANCE_VERIFIED_AT,
    governanceState: options?.governanceState || registryEntry?.governanceState || "official_verified",
    reviewStatus: options?.reviewStatus || registryEntry?.reviewStatus || "approved",
    lastReviewedAt: options?.lastReviewedAt || registryEntry?.lastReviewedAt || CATALOG_GOVERNANCE_REVIEWED_AT,
    authorityLabel: officialSourceLabel,
    reviewOwner: registryEntry?.reviewOwner || "فريق حوكمة النماذج",
    confidence: options?.confidence || registryEntry?.confidence || "high",
    notes: options?.notes || registryEntry?.notes,
  };
}

const GOVERNED_FORM_METADATA: Record<string, { sourceId: string; governance: FormGovernance }> = {
  form_t2: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت2 لتعديل الوضع العائلي للمتقاعدين العسكريين"),
  },
  form_t11: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت11 الخاص بتعهد الطلاق للمتقاعد العسكري"),
  },
  form_t12: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت12 الخاص بإقرار المتقاعد العسكري"),
  },
  form_t7: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت7 لإعادة تخصيص المعاش التقاعدي"),
  },
  form_t8: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت8 الخاص بإقرار المستفيد من المعاش"),
  },
  form_t9: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت9 لشهادة أيتام وأرامل المتقاعد"),
  },
  form_t1: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت1 لطلب دفتر تقاعد بدل عن الضائع"),
  },
  form_t3: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت3 لطلب صرف تعويض أو معاش لابن المتقاعد"),
  },
  form_t4: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت4 لطلب صرف تعويض أو معاش لابنة المتقاعد الأرملة"),
  },
  form_t5: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "وزارة الصحة العامة / دائرة التقاعد", "نموذج ت5 لطلب معاينة من اللجنة الطبية"),
  },
  form_t6: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت6 لطلب إيقاف معاش تقاعدي"),
  },
  form_t10: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - وزارة الدفاع الوطني", "نموذج ت10 لطلب تعديل رقم حساب مصرفي"),
  },
  form_t22: {
    sourceId: "grant",
    governance: buildGovernance("grant", "الشؤون", "نموذج ت22 للمساعدات المدرسية والتعليمية للمستفيدين"),
  },
  form_pension_attestation: {
    sourceId: "retirement",
    governance: buildGovernance(
      "retirement",
      "وزارة المالية - خدمة المتقاعدين العسكريين",
      "إفادة معاش تقاعدي للمتقاعدين العسكريين",
      { officialSourceUrl: "https://eservices.finance.gov.lb/retiredInfo.aspx" }
    ),
  },
  form_medical_hospitalization: {
    sourceId: "medical",
    governance: buildGovernance("medical", "الطبابة العسكرية - قيادة الجيش", "طلب موافقة استشفاء للمستفيدين من الطبابة العسكرية"),
  },
  form_medical_reimbursement: {
    sourceId: "medical",
    governance: buildGovernance("medical", "الطبابة العسكرية - قيادة الجيش", "طلب تعويض نفقات طبية للمستفيدين من الطبابة العسكرية"),
  },
  form_birth_grant: {
    sourceId: "grant",
    governance: buildGovernance("grant", "الشؤون", "طلب مساعدة اجتماعية عن الولادة أو الزواج للمستفيدين"),
  },
  form_service_card: {
    sourceId: "retirement",
    governance: buildGovernance("retirement", "دائرة التقاعد - قيادة الجيش", "طلب تجديد بطاقة الخدمات الاجتماعية لمتقاعدي الجيش"),
  },
  form_service_attestation: {
    sourceId: "admin",
    governance: buildGovernance(
      "admin",
      "قيادة الجيش - مديرية الشؤون الإدارية",
      "طلب إفادة خدمة أو وضع إداري للمتقاعد للاستعمال الرسمي"
    ),
  },
  form_weapon_license: {
    sourceId: "laf",
    governance: buildGovernance("laf", "قيادة الجيش", "طلب تجديد رخصة مسدس أميري لمتقاعدي الجيش"),
  },
};

function getGovernedCatalog(): FormTemplate[] {
  return FORMS_CATALOG.map((form) => {
    const metadata = GOVERNED_FORM_METADATA[form.id];
    return {
      ...form,
      sourceId: metadata?.sourceId || form.sourceId,
      governance: metadata?.governance || form.governance,
      origin: "forms_catalog",
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Keyword matching for form detection in chat                        */
/* ------------------------------------------------------------------ */

const FORM_KEYWORDS: Array<{ patterns: RegExp[]; formIds: string[] }> = [
  {
    patterns: [
      /نموذج\s*ت\s*2\b/i, /طلب\s*(تعديل|تغيير)\s*وضع\s*عائلي/i,
      /\bت2\b/, /تسجيل\s*(زواج|ولادة|وفاة|طلاق)/i,
      /نموذج\s*تعديل\s*عائلي/i,
    ],
    formIds: ["form_t2"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*11\b/i, /تعهد\s*طلاق/i, /\bت11\b/,
      /نموذج\s*(تعهد|اقرار)\s*طلاق/i,
    ],
    formIds: ["form_t11"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*12\b/i, /إقرار\s*(من\s*)?متقاعد/i, /\bت12\b/,
      /نموذج\s*إقرار/i,
    ],
    formIds: ["form_t12"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*22\b/i, /مساعد[ةه]\s*مدرسي[ةه]/i, /\bت22\b/,
      /طلب\s*مساعد[ةه]\s*(مدرس|تعليم|دراس)/i,
    ],
    formIds: ["form_t22"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*7\b/i, /إعادة\s*تخصيص\s*معاش/i, /\bت7\b/,
      /تخصيص\s*المعاش/i,
    ],
    formIds: ["form_t7"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*8\b/i, /إقرار\s*من\s*مستفيد/i, /\bت8\b/,
      /تصريح\s*مستفيد/i,
    ],
    formIds: ["form_t8"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*9\b/i, /شهادة?\s*(أيتام|أرامل|ايتام|ارامل)/i, /\bت9\b/,
      /شهادة?\s*يتيم/i, /شهادة?\s*أرملة/i,
    ],
    formIds: ["form_t9"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*1\b/i, /دفتر\s*تقاعد/i, /\bت1\b/,
      /طلب\s*دفتر\s*تقاعد/i,
    ],
    formIds: ["form_t1"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*3\b/i, /صرف\s*(تعويض|معاش).*ابن\s*يتابع\s*درا/i, /\bت3\b/,
      /معاش\s*ابن.*دراس/i,
    ],
    formIds: ["form_t3"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*4\b/i, /صرف\s*(تعويض|معاش).*ابنة\s*ارملة/i, /\bت4\b/,
      /معاش\s*ابنة\s*ارملة/i,
    ],
    formIds: ["form_t4"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*5\b/i, /معاينة.*لجنة\s*طبية/i, /\bت5\b/,
      /طلب\s*معاينة\s*طبية/i,
    ],
    formIds: ["form_t5"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*6\b/i, /إيقاف\s*معاش|وقف\s*معاش/i, /\bت6\b/,
      /طلب\s*ايقاف\s*معاش/i,
    ],
    formIds: ["form_t6"],
  },
  {
    patterns: [
      /نموذج\s*ت\s*10\b/i, /تعديل\s*حساب\s*مصرفي|تعديل\s*رقم\s*حساب/i, /\bت10\b/,
      /طلب\s*تعديل\s*(حساب|رقم)/i,
    ],
    formIds: ["form_t10"],
  },
  {
    patterns: [
      /افاد[ةه]\s*معاش/i,
      /معاش\s*تقاعد[يى]/i,
      /شهاد[ةه]\s*معاش/i,
    ],
    formIds: ["form_pension_attestation"],
  },
  {
    patterns: [
      /طباب[ةه]/i,
      /استشفا[ءى]/i,
      /تعويض\s*طبي/i,
      /فاتور[ةه]\s*(طب|استشفا)/i,
      /موافق[ةه]\s*استشفا/i,
    ],
    formIds: ["form_medical_hospitalization", "form_medical_reimbursement"],
  },
  {
    patterns: [
      /منح[ةه]\s*(ولاد[ةه]|زواج)/i,
      /مساعد[ةه]\s*(اجتماعي[ةه])?\s*(ولاد[ةه]|زواج)/i,
      /تعويض\s*(ولاد[ةه]|زواج)/i,
    ],
    formIds: ["form_birth_grant"],
  },
  {
    patterns: [
      /بطاقة\s*(خدمات|الخدمات)\s*(الاجتماعية)?/i,
      /تجديد\s*بطاقة/i, /بطاقة\s*بدل\s*(فاقد|تالف)/i,
    ],
    formIds: ["form_service_card"],
  },
  {
    patterns: [
      /افاد[ةه]\s*(خدم[ةه]|وضع\s*ادار[يى])/i,
      /وضع\s*ادار[يى]/i,
      /شهاد[ةه]\s*خدم[ةه]/i,
    ],
    formIds: ["form_service_attestation"],
  },
  {
    patterns: [
      /رخصة\s*(مسدس|سلاح)/i, /تجديد\s*رخصة/i,
      /مسدس\s*أميري/i,
    ],
    formIds: ["form_weapon_license"],
  },
];

/**
 * Generic form-request detection — user asking about ANY form
 */
const GENERIC_FORM_PATTERNS = [
  /أريد\s*(النموذج|الطلب|الاستمارة|الفورم)/i,
  /بدي\s*(النموذج|الطلب|نموذج|طلب)/i,
  /أحتاج\s*(نموذج|طلب|استمارة)/i,
  /شو\s*(ال)?نموذج/i,
  /وين\s*(ب)?لاقي\s*(النموذج|الطلب)/i,
  /عطيني\s*(النموذج|الطلب|النمودج)/i,
  /حمّل.*نموذج/i,
  /نموذج.*تحميل/i,
  /print.*form/i,
  /طباعة.*نموذج/i,
  /نموذج.*طباعة/i,
];

/**
 * Detect form-related intents from a user message.
 * Returns matched form IDs or empty array.
 */
export function detectFormIntent(text: string): string[] {
  const matched = new Set<string>();

  // Specific form detection
  for (const { patterns, formIds } of FORM_KEYWORDS) {
    for (const pat of patterns) {
      if (pat.test(text)) {
        for (const id of formIds) matched.add(id);
      }
    }
  }

  return [...matched];
}

/**
 * Check if message is a generic form request
 */
export function isGenericFormRequest(text: string): boolean {
  return GENERIC_FORM_PATTERNS.some((p) => p.test(text));
}

/**
 * Get all forms catalog
 */
export function getFormsCatalog(): FormTemplate[] {
  return getGovernedCatalog();
}

/**
 * Get a single form by ID
 */
export function getFormById(id: string): FormTemplate | undefined {
  return getGovernedCatalog().find((f) => f.id === id);
}

/**
 * Search forms by keyword
 */
export function searchForms(query: string): FormTemplate[] {
  const q = query.toLowerCase();
  return getGovernedCatalog().filter(
    (f) =>
      f.code.includes(q) ||
      f.title_ar.includes(q) ||
      f.description_ar.includes(q) ||
      f.category.includes(q) ||
      f.authority.includes(q) ||
      (f.governance?.officialSourceLabel || "").includes(q) ||
      (f.governance?.officialReference || "").includes(q)
  );
}
