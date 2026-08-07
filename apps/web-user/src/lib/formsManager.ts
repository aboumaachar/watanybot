/**
 * Forms Management System
 * Manages all MOF and LAF forms with download, preview, and sharing capabilities
 */

export interface FormMetadata {
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: "mof" | "laf";
  type: "pdf" | "html" | "interactive";
  url: string;
  printable: boolean;
  downloadable: boolean;
  shareable: boolean;
  fileSize?: string;
  createdDate: string;
  lastUpdated: string;
  lang: "ar" | "mixed";
}

/**
 * Complete Forms Catalog
 */
export const formsCatalog: Record<string, FormMetadata> = {
  // ============================================================================
  // MOF Forms (Ministry of Finance - Pension Reallocation)
  // ============================================================================

  "t7": {
    code: "ت7",
    nameAr: "طلب إعادة تخصيص معاش تقاعدي",
    nameEn: "Pension Reallocation Request",
    descriptionAr: "النموذج الأساسي لطلب إعادة تخصيص المعاش بعد وفاة المتقاعد",
    descriptionEn: "Primary form for pension reallocation request after retiree's death",
    category: "mof",
    type: "html",
    url: "/forms/mof/t7-pension-reallocation.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "45 KB",
    createdDate: "2026-03-01",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "t8": {
    code: "ت8",
    nameAr: "إقرار من مستفيد",
    nameEn: "Beneficiary Declaration",
    descriptionAr: "إقرار وتعهد من المستفيد بصحة البيانات المقدمة",
    descriptionEn: "Declaration and commitment from beneficiary regarding data accuracy",
    category: "mof",
    type: "html",
    url: "/forms/mof/t8-beneficiary-declaration.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "35 KB",
    createdDate: "2026-03-01",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "t9": {
    code: "ت9",
    nameAr: "شهادة أيتام وأرامل",
    nameEn: "Orphans & Widows Certificate",
    descriptionAr: "إثبات صفة الأيتام والأرامل من جهات رسمية",
    descriptionEn: "Official certificate proving orphan/widow status",
    category: "mof",
    type: "html",
    url: "/forms/mof/t9-orphans-widows-certificate.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "40 KB",
    createdDate: "2026-03-01",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  // ============================================================================
  // LAF Forms (Lebanese Armed Forces - Military Services)
  // ============================================================================

  "a1": {
    code: "ع-1",
    nameAr: "طلب معاشات الإعاقة",
    nameEn: "Disability Benefits Request",
    descriptionAr: "طلب الحصول على مزايا الإعاقة للعسكري المصاب",
    descriptionEn: "Request for disability benefits for injured military personnel",
    category: "laf",
    type: "html",
    url: "/forms/laf/a1-disability-request.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "48 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "a2": {
    code: "ع-2",
    nameAr: "تقرير التقييم الطبي",
    nameEn: "Medical Evaluation Report",
    descriptionAr: "تقرير درجة الإعاقة من اللجنة الطبية العسكرية",
    descriptionEn: "Disability rating report from military medical commission",
    category: "laf",
    type: "html",
    url: "/forms/laf/a2-medical-evaluation.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "55 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "a3": {
    code: "ع-3",
    nameAr: "شهادة الخدمة العسكرية",
    nameEn: "Military Service Certificate",
    descriptionAr: "إثبات مدة الخدمة العسكرية",
    descriptionEn: "Certificate proving military service duration",
    category: "laf",
    type: "html",
    url: "/forms/laf/a3-service-certificate.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "38 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "s5": {
    code: "ص-5",
    nameAr: "طلب إجازة طبية",
    nameEn: "Medical Leave Request",
    descriptionAr: "طلب الحصول على إجازة طبية والعلاج",
    descriptionEn: "Request for medical leave and treatment",
    category: "laf",
    type: "html",
    url: "/forms/laf/s5-medical-leave.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "42 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "s6": {
    code: "ص-6",
    nameAr: "تقرير المتابعة الطبية",
    nameEn: "Medical Follow-up Report",
    descriptionAr: "تقارير المتابعة الطبية والعلاج",
    descriptionEn: "Medical follow-up and treatment reports",
    category: "laf",
    type: "html",
    url: "/forms/laf/s6-medical-followup.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "50 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "s7": {
    code: "ص-7",
    nameAr: "شهادة القدرة على العمل",
    nameEn: "Work Capability Certificate",
    descriptionAr: "شهادة من اللجنة الطبية بالقدرة على العودة للعمل",
    descriptionEn: "Medical clearance to return to duty",
    category: "laf",
    type: "html",
    url: "/forms/laf/s7-work-capability.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "35 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "b10": {
    code: "ب-10",
    nameAr: "طلب بدل العائلة",
    nameEn: "Family Allowance Request",
    descriptionAr: "طلب الحصول على بدل العائلة والإعالة",
    descriptionEn: "Request for family allowance and dependent benefits",
    category: "laf",
    type: "html",
    url: "/forms/laf/b10-family-allowance.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "44 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "b11": {
    code: "ب-11",
    nameAr: "إقرار الحالة الاجتماعية",
    nameEn: "Marital Status Declaration",
    descriptionAr: "إقرار بالحالة الاجتماعية والأطفال",
    descriptionEn: "Declaration of marital status and dependents",
    category: "laf",
    type: "html",
    url: "/forms/laf/b11-marital-status.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "40 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "b12": {
    code: "ب-12",
    nameAr: "شهادة عدم الكسب",
    nameEn: "Non-Income Certificate",
    descriptionAr: "شهادة من جهات حكومية بعدم الحصول على راتب",
    descriptionEn: "Government certificate confirming no other income",
    category: "laf",
    type: "html",
    url: "/forms/laf/b12-non-income.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "38 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "w1": {
    code: "و-1",
    nameAr: "طلب معاش الورثة",
    nameEn: "Survivor Pension Request",
    descriptionAr: "طلب الحصول على معاش الورثة بعد وفاة العسكري",
    descriptionEn: "Request for survivor pension after military personnel death",
    category: "laf",
    type: "html",
    url: "/forms/laf/w1-survivor-pension.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "46 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "w2": {
    code: "و-2",
    nameAr: "شهادة الزواج والأطفال",
    nameEn: "Marriage & Children Certificate",
    descriptionAr: "إثبات الزواج والأطفال للحصول على المعاش",
    descriptionEn: "Proof of marriage and children for pension eligibility",
    category: "laf",
    type: "html",
    url: "/forms/laf/w2-family-certificate.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "42 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "w3": {
    code: "و-3",
    nameAr: "إقرار من الورثة",
    nameEn: "Heir Declaration",
    descriptionAr: "إقرار من الورثة بقبول المعاش والتعهد به",
    descriptionEn: "Declaration from heirs accepting survivor pension",
    category: "laf",
    type: "html",
    url: "/forms/laf/w3-heir-declaration.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "39 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "t15": {
    code: "ت-15",
    nameAr: "طلب التسريح أو التقاعد",
    nameEn: "Discharge or Retirement Request",
    descriptionAr: "طلب التسريح أو التقاعد الاختياري من الخدمة",
    descriptionEn: "Request for discharge or voluntary retirement",
    category: "laf",
    type: "html",
    url: "/forms/laf/t15-discharge-request.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "50 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "t16": {
    code: "ت-16",
    nameAr: "شهادة السنوات الخدمة",
    nameEn: "Years of Service Certificate",
    descriptionAr: "إثبات موثق لسنوات الخدمة العسكرية",
    descriptionEn: "Official certificate of military service duration",
    category: "laf",
    type: "html",
    url: "/forms/laf/t16-service-years.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "37 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "t17": {
    code: "ت-17",
    nameAr: "قرار الموافقة على التسريح",
    nameEn: "Discharge Approval Decision",
    descriptionAr: "قرار رسمي من القيادة بالموافقة على التسريح",
    descriptionEn: "Official command approval for discharge",
    category: "laf",
    type: "html",
    url: "/forms/laf/t17-discharge-approval.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "35 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "s3": {
    code: "س-3",
    nameAr: "طلب السكن العسكري",
    nameEn: "Military Housing Request",
    descriptionAr: "طلب الحصول على سكن عسكري أو مساعدة إسكان",
    descriptionEn: "Request for military housing or housing assistance",
    category: "laf",
    type: "html",
    url: "/forms/laf/s3-housing-request.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "43 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "s4": {
    code: "س-4",
    nameAr: "تقرير ",
    nameEn: "Eligibility Report",
    descriptionAr: "تقرير التحقق من استيفاء شروط السكن",
    descriptionEn: "Report verifying housing eligibility criteria",
    category: "laf",
    type: "html",
    url: "/forms/laf/s4-eligibility-report.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "41 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "s5_housing": {
    code: "س-5",
    nameAr: "شهادة قائد الوحدة",
    nameEn: "Unit Commander Certificate",
    descriptionAr: "شهادة توصية من قائد الوحدة",
    descriptionEn: "Recommendation certificate from unit commander",
    category: "laf",
    type: "html",
    url: "/forms/laf/s5-commander-certificate.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "36 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "k1": {
    code: "ك-1",
    nameAr: "طلب الالتحاق كضابط",
    nameEn: "Officer Recruitment Request",
    descriptionAr: "طلب التقديم للالتحاق برتبة ضابط أو كادت",
    descriptionEn: "Application for officer or cadet program",
    category: "laf",
    type: "html",
    url: "/forms/laf/k1-officer-application.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "52 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "k2": {
    code: "ك-2",
    nameAr: "المستندات التعليمية",
    nameEn: "Educational Documents",
    descriptionAr: "الشهادات والمستندات التعليمية المطلوبة",
    descriptionEn: "Required educational certificates and documents",
    category: "laf",
    type: "html",
    url: "/forms/laf/k2-educational-docs.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "39 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },

  "k3": {
    code: "ك-3",
    nameAr: "شهادة الكفاءة الطبية",
    nameEn: "Medical Fitness Certificate",
    descriptionAr: "شهادة اللياقة الطبية للالتحاق ببرنامج الضباط",
    descriptionEn: "Medical fitness certificate for officer program",
    category: "laf",
    type: "html",
    url: "/forms/laf/k3-medical-fitness.html",
    printable: true,
    downloadable: true,
    shareable: true,
    fileSize: "44 KB",
    createdDate: "2026-03-02",
    lastUpdated: "2026-03-04",
    lang: "ar",
  },
};

/**
 * Forms Manager Utilities
 */

export class FormsManager {
  /**
   * Get all forms
   */
  static getAllForms(): FormMetadata[] {
    return Object.values(formsCatalog);
  }

  /**
   * Get forms by category
   */
  static getFormsByCategory(category: "mof" | "laf"): FormMetadata[] {
    return Object.values(formsCatalog).filter((f) => f.category === category);
  }

  /**
   * Get form by code
   */
  static getFormByCode(code: string): FormMetadata | undefined {
    return Object.values(formsCatalog).find(
      (f) => f.code.toLowerCase() === code.toLowerCase()
    );
  }

  /**
   * Get form by ID
   */
  static getFormById(id: string): FormMetadata | undefined {
    return formsCatalog[id];
  }

  /**
   * Search forms
   */
  static searchForms(query: string): FormMetadata[] {
    const lower = query.toLowerCase();
    return Object.values(formsCatalog).filter(
      (f) =>
        f.code.toLowerCase().includes(lower) ||
        f.nameAr.includes(query) ||
        f.nameEn.toLowerCase().includes(lower) ||
        f.descriptionAr.includes(query) ||
        f.descriptionEn.toLowerCase().includes(lower)
    );
  }

  /**
   * Get MOF forms
   */
  static getMofForms(): FormMetadata[] {
    return this.getFormsByCategory("mof");
  }

  /**
   * Get LAF forms
   */
  static getLafForms(): FormMetadata[] {
    return this.getFormsByCategory("laf");
  }

  /**
   * Get downloadable forms
   */
  static getDownloadableForms(): FormMetadata[] {
    return Object.values(formsCatalog).filter((f) => f.downloadable);
  }

  /**
   * Get printable forms
   */
  static getPrintableForms(): FormMetadata[] {
    return Object.values(formsCatalog).filter((f) => f.printable);
  }

  /**
   * Get shareable forms
   */
  static getShareableForms(): FormMetadata[] {
    return Object.values(formsCatalog).filter((f) => f.shareable);
  }

  /**
   * Get forms count
   */
  static getFormsCount(): {
    total: number;
    mof: number;
    laf: number;
  } {
    const all = Object.values(formsCatalog);
    const mof = all.filter((f) => f.category === "mof").length;
    const laf = all.filter((f) => f.category === "laf").length;
    return { total: all.length, mof, laf };
  }

  /**
   * Generate form URL
   */
  static getFormUrl(formId: string): string | undefined {
    const form = this.getFormById(formId);
    return form?.url;
  }

  /**
   * Get form download link
   */
  static getDownloadLink(formId: string, format: "pdf" | "html" = "pdf"): string {
    const form = this.getFormById(formId);
    if (!form) return "";
    return `/api/forms/${formId}/download?format=${format}`;
  }

  /**
   * Get form share link
   */
  static getShareLink(formId: string): string {
    const form = this.getFormById(formId);
    if (!form) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}${form.url}`;
  }
}

/**
 * Export types and functions for use in components
 */
export default FormsManager;
