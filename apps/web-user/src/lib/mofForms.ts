/**
 * MOF Forms Database
 * Contains all forms related to pension reallocation procedures
 * Each form is linked to specific cases and includes metadata for preview/download/share
 */

export interface FormAction {
  type: 'preview' | 'download' | 'share' | 'chat';
  label: string;
  enabled: boolean;
}

export interface MOFForm {
  code: string;                    // ت7, ت8, ت9
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  category: string;                // "application" | "declaration" | "certificate"
  
  // Form content
  url?: string;                    // URL to form file
  preview_url?: string;            // URL for preview (PDF/image)
  format: 'pdf' | 'doc' | 'docx' | 'image' | 'webpage';
  file_size?: string;              // e.g., "250 KB"
  
  // Related cases (which cases use this form)
  related_cases: string[];         // e.g., ["spouse", "single-daughter", ...]
  
  // Form content summary
  fields?: Array<{
    name: string;
    type: 'text' | 'date' | 'signature' | 'checkbox' | 'select';
    required: boolean;
  }>;
  
  // Instructions
  instructions_ar?: string;
  instructions_en?: string;
  
  // Actions available for this form
  actions: FormAction[];
  
  // Language versions
  languages: ('ar' | 'en')[];
  
  // Version info
  version: string;
  last_updated: string;
  issuer: string;                  // Ministry/Organization
  
  // Additional metadata
  official_link?: string;
  download_link?: string;
  is_official: boolean;
}

/**
 * MOF Standard Forms
 * These are the three main forms used across all MOF cases
 */
export const MOF_FORMS: Record<string, MOFForm> = {
  // Form ت7 - Main Application
  "t7": {
    code: "ت7",
    name_ar: "طلب إعادة تخصيص معاش تقاعدي",
    name_en: "Pension Reallocation Request Form",
    description_ar: "النموذج الأساسي لتقديم طلب إعادة تخصيص المعاش بعد وفاة متقاعد",
    description_en: "Main application form for requesting pension reallocation after retiree's death",
    category: "application",
    url: "/mof/t7-original.jpg",
    preview_url: "/mof/t7-original.jpg",
    format: "image",
    file_size: "2.9 MB",
    related_cases: ["spouse", "single-daughter", "widow-daughter", "minor-son", "student-son", "disabled-son", "parent"],
    fields: [
      { name: "Full Name (Arabic)", type: "text", required: true },
      { name: "National ID", type: "text", required: true },
      { name: "Date of Birth", type: "date", required: true },
      { name: "Beneficiary Category", type: "select", required: true },
      { name: "Deceased Retiree Name", type: "text", required: true },
      { name: "Deceased ID Number", type: "text", required: true },
      { name: "Date of Death", type: "date", required: true },
      { name: "Request Details", type: "text", required: true },
      { name: "Current Address", type: "text", required: true },
      { name: "Contact Number", type: "text", required: true },
      { name: "Email", type: "text", required: false },
      { name: "Applicant Signature", type: "signature", required: true },
      { name: "Date", type: "date", required: true },
    ],
    instructions_ar: `
تعليمات ملء النموذج ت7:
1. اكتب بيانات طالب إعادة التخصيص بوضوح
2. اختر فئة المستفيد من القائمة المرفقة (زوجة، ابنة، ابن، إلخ)
3. أدرج معلومات المتقاعد المتوفي كاملة
4. اكتب تاريخ الوفاة بالتنسيق يوم/شهر/سنة
5. اشرح سبب الطلب بإيجاز
6. تأكد من صحة رقم الهاتف والعنوان
7. وقّع النموذج وضع التاريخ
8. احتفظ بنسخة لأغراض التوثيق
    `,
    instructions_en: `
Instructions for completing Form T7:
1. Write applicant's information clearly
2. Select beneficiary category from dropdown
3. Include deceased retiree's complete information
4. Write date of death in DD/MM/YYYY format
5. Briefly explain the reason for the request
6. Verify phone number and address accuracy
7. Sign form and date it
8. Keep a copy for your records
    `,
    actions: [
      { type: "preview", label: "عرض النموذج", enabled: true },
      { type: "download", label: "تحميل نسخة", enabled: true },
      { type: "share", label: "مشاركة", enabled: true },
      { type: "chat", label: "استفسر عن النموذج", enabled: true },
    ],
    languages: ["ar", "en"],
    version: "3.0",
    last_updated: "2026-03-01",
    issuer: "Ministry of Finance - Pension Department",
    official_link: "https://mof.gov.lb/forms/t7-pension-reallocation",
    download_link: "/mof/t7-original.jpg",
    is_official: true,
  },

  // Form ت8 - Beneficiary Declaration
  "t8": {
    code: "ت8",
    name_ar: "إقرار من مستفيد",
    name_en: "Beneficiary Declaration Form",
    description_ar: "نموذج الإقرار والتعهد من المستفيد بالالتزام بشروط الصرف",
    description_en: "Declaration form for beneficiary commitment to payment conditions",
    category: "declaration",
    url: "/mof/t8-original.jpg",
    preview_url: "/mof/t8-original.jpg",
    format: "image",
    file_size: "3.5 MB",
    related_cases: ["spouse", "single-daughter", "widow-daughter", "minor-son", "student-son", "disabled-son", "parent"],
    fields: [
      { name: "Full Name", type: "text", required: true },
      { name: "National ID", type: "text", required: true },
      { name: "Beneficiary Category", type: "select", required: true },
      { name: "Pension Account Number", type: "text", required: false },
      { name: "Declaration Statement", type: "text", required: true },
      { name: "Commitment Checkbox", type: "checkbox", required: true },
      { name: "Signature", type: "signature", required: true },
      { name: "Date", type: "date", required: true },
      { name: "Witness Name (Optional)", type: "text", required: false },
      { name: "Witness Signature (Optional)", type: "signature", required: false },
    ],
    instructions_ar: `
تعليمات ملء النموذج ت8:
1. أقرّ بأنك قرأت وفهمت شروط الصرف
2. افهم أن جميع المعلومات المقدمة يجب أن تكون صحيحة
3. تعهد بعدم إخفاء أي معلومات مهمة
4. اعترف بأنك ستبلغ عن أي تغيير في وضعك الشخصي
5. امضِ في المكان المحدد بتوقيعك الشخصي
6. ضع التاريخ الحالي
7. يمكنك إحضار شاهد لتوقيع الإقرار (غير إلزامي)
8. احتفظ بنسخة معك
    `,
    instructions_en: `
Instructions for completing Form T8:
1. Affirm you've read and understood payment conditions
2. Understand all information must be truthful
3. Commit not to conceal important information
4. Acknowledge you'll report any personal status changes
5. Sign in the designated space with your signature
6. Add today's date
7. You may bring a witness to sign (optional)
8. Keep a copy for your records
    `,
    actions: [
      { type: "preview", label: "عرض الإقرار", enabled: true },
      { type: "download", label: "تحميل نسخة", enabled: true },
      { type: "share", label: "مشاركة", enabled: true },
      { type: "chat", label: "أسئلة عن الإقرار", enabled: true },
    ],
    languages: ["ar", "en"],
    version: "3.0",
    last_updated: "2026-03-01",
    issuer: "Ministry of Finance - Pension Department",
    official_link: "https://mof.gov.lb/forms/t8-beneficiary-declaration",
    download_link: "/mof/t8-original.jpg",
    is_official: true,
  },

  // Form ت9 - Widow/Orphans Certificate
  "t9": {
    code: "ت9",
    name_ar: "شهادة أيتام وأرامل",
    name_en: "Widow and Orphans Certificate",
    description_ar: "شهادة تثبت صفة الأرملة أو اليتيم أو المستفيد الآخر",
    description_en: "Certificate confirming widow, orphan, or other beneficiary status",
    category: "certificate",
    url: "/mof/t9-original.jpg",
    preview_url: "/mof/t9-original.jpg",
    format: "image",
    file_size: "2.7 MB",
    related_cases: ["spouse", "single-daughter", "widow-daughter", "minor-son", "student-son", "disabled-son"],
    fields: [
      { name: "Certificate Number", type: "text", required: false },
      { name: "Beneficiary Name", type: "text", required: true },
      { name: "Beneficiary ID", type: "text", required: true },
      { name: "Deceased Name", type: "text", required: true },
      { name: "Relationship", type: "select", required: true },
      { name: "Date of Death", type: "date", required: true },
      { name: "Issuing Authority", type: "text", required: true },
      { name: "Issuance Date", type: "date", required: true },
      { name: "Certificate Expiry", type: "date", required: false },
      { name: "Authority Signature", type: "signature", required: true },
    ],
    instructions_ar: `
تعليمات الحصول على شهادة ت9:
1. توجه إلى مكتب البلدية أو مركز الخدمات الاجتماعية
2. احضر معك بطاقة الهوية الشخصية
3. احضر شهادة وفاة الشخص المتوفي
4. اطلب شهادة أيتام وأرامل
5. ادفع الرسم الإداري الموضوع (إن وجد)
6. احصل على الشهادة موثقة من الجهة المختصة
7. تأكد من صحة جميع البيانات في الشهادة
8. احتفظ بنسخ من الشهادة
9. الشهادة تكون سارية لمدة محددة (تحقق من تاريخ الانتهاء)
    `,
    instructions_en: `
How to obtain Certificate T9:
1. Visit municipal office or social services center
2. Bring your national ID card
3. Bring deceased person's death certificate
4. Request widow/orphans certificate
5. Pay applicable administrative fee (if any)
6. Obtain notarized certificate from authority
7. Verify all certificate data is correct
8. Keep multiple copies
9. Certificate is valid for specified period (check expiry date)
    `,
    actions: [
      { type: "preview", label: "عرض الشهادة", enabled: true },
      { type: "download", label: "تحميل الشهادة", enabled: true },
      { type: "share", label: "مشاركة المعلومات", enabled: true },
      { type: "chat", label: "كيف أحصل على الشهادة", enabled: true },
    ],
    languages: ["ar"],
    version: "2.0",
    last_updated: "2026-02-15",
    issuer: "Municipal / Social Services Authority",
    official_link: "https://mof.gov.lb/info/t9-widow-certificate",
    download_link: "/mof/t9-original.jpg",
    is_official: true,
  },
};

/**
 * Case-specific required forms
 */
export const CASE_REQUIRED_FORMS: Record<string, string[]> = {
  spouse: ["t7", "t8"], // Optional: t9
  "single-daughter": ["t7", "t8", "t9"],
  "widow-daughter": ["t7", "t8", "t9"],
  "minor-son": ["t7", "t8", "t9"],
  "student-son": ["t7", "t8", "t9"],
  "disabled-son": ["t7", "t8", "t9"],
  parent: ["t7", "t8"], // Optional: t9
};

function normalizeMofFormCode(code: string): string {
  return code
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/^ت/iu, "t")
    .toLowerCase();
}

/**
 * Get all forms
 */
export function getAllMOFForms(): MOFForm[] {
  return Object.values(MOF_FORMS);
}

/**
 * Get form by code
 */
export function getFormByCode(code: string): MOFForm | undefined {
  return MOF_FORMS[normalizeMofFormCode(code)];
}

/**
 * Get required forms for a case
 */
export function getFormsForCase(caseId: string): MOFForm[] {
  const requiredCodes = CASE_REQUIRED_FORMS[caseId] || [];
  return requiredCodes
    .map((code) => MOF_FORMS[code])
    .filter(Boolean) as MOFForm[];
}

/**
 * Get optional forms for a case
 */
export function getOptionalFormsForCase(caseId: string): MOFForm[] {
  const allForms = getAllMOFForms();
  const requiredCodes = CASE_REQUIRED_FORMS[caseId] || [];
  return allForms.filter(
    (form) =>
      form.related_cases.includes(caseId) &&
      !requiredCodes.includes(form.code)
  );
}

/**
 * Get form preview URL
 */
export function getFormPreviewURL(formCode: string): string | null {
  const form = getFormByCode(formCode);
  return form?.preview_url || form?.download_link || null;
}

/**
 * Get form download URL
 */
export function getFormDownloadURL(formCode: string): string | null {
  const form = getFormByCode(formCode);
  return form?.download_link || form?.preview_url || null;
}

/**
 * Get form for chat discussion
 */
export function getFormForChat(formCode: string): MOFForm | undefined {
  const form = getFormByCode(formCode);
  if (form && form.actions.find((a) => a.type === "chat" && a.enabled)) {
    return form;
  }
  return undefined;
}

/**
 * Generate form summary for chat
 */
export function generateFormChatSummary(
  formCode: string,
  lang: "ar" | "en" = "ar"
): string {
  const form = getFormByCode(formCode);
  if (!lang) return "";

  const name = lang === "ar" ? form?.name_ar : form?.name_en;
  const desc = lang === "ar" ? form?.description_ar : form?.description_en;
  const fields = form?.fields?.map((f) => `• ${f.name}`) || [];

  return `
**${name}**
${desc}

**الحقول المطلوبة:**
${fields.join("\n")}

هل تريد معرفة المزيد عن هذا النموذج؟
  `;
}
