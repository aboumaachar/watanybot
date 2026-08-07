import type { Procedure, ProcedureAudienceScope, ProcedureContentTier, SourceRef } from "./types.js";

export type ProcedureRecordKind = "procedure" | "reference" | "notice" | "fragment";
export type ProcedureQualityFlag = "clean" | "noisy_title";
export type ProcedureAudienceMeta = {
  audience_scope: ProcedureAudienceScope;
  applies_to: string[];
  content_tier: ProcedureContentTier;
  domain: string;
  relevance_weight: number;
};

const SOURCE_LABELS: Record<string, string> = {
  mof: "وزارة المالية",
  laf: "الجيش اللبناني",
  awsema: "تعليمات الاوسمة",
  procedures: "دليل المعاملات والإجراءات",
  retirement: "نظام التقاعد والصرف والخدمة",
  defense: "قانون الدفاع الوطني",
  labor: "قانون العمل",
  employees: "قانون الموظفين",
  compensations: "نظام التعويضات والمساعدات",
  other: "مرجع رسمي",
};

const SECTION_LABELS: Record<string, string> = {
  mof: "المعاملات الخاصة بوزارة المالية",
  laf: "المعاملات الخاصة بالجيش اللبناني",
  awsema: "الأوسمة والتكريمات الرسمية",
  procedures: "دليل المعاملات والإجراءات",
  retirement: "نظام التقاعد والصرف والخدمة",
  defense: "قانون الدفاع الوطني",
  labor: "قانون العمل",
  employees: "قانون الموظفين",
  compensations: "نظام التعويضات والمساعدات",
  other: "مرجع رسمي",
};

const SECTION_FIXUPS: Record<string, string> = {
  "القسم السابع: بعض معاملات قوى الامن الداخلي": "القسم السابع: بعض معاملات قوى الأمن الداخلي",
  "القسم العاشر: خدمات خاصة في الجيش": "القسم العاشر: خدمات خاصة في الجيش",
  "القسم الحادي عشر: خدمات عامة": "القسم الحادي عشر: خدمات عامة",
  "القسم التاسع: معاملات مختلفة عامة": "القسم التاسع: معاملات مختلفة عامة",
  "القسم الثامن: معاملات مختلفة خاصة في الجيش": "القسم الثامن: معاملات مختلفة خاصة في الجيش",
  "القسم السادس: معاملات عسكريي الخدمة الفعلية في الجيش": "القسم السادس: معاملات عسكريي الخدمة الفعلية في الجيش",
  "القسم الخامس: معاملات المالية": "القسم الخامس: معاملات المالية",
  "القسم الرابع: معاملات شؤون المناطق والمالية": "القسم الرابع: معاملات شؤون المناطق والمالية",
  "القسم الثالث: معاملات شؤون المناطق في الجيش": "القسم الثالث: معاملات شؤون المناطق في الجيش",
};

type PresentableSource = {
  source?: string;
  source_refs?: SourceRef[];
};

type RelevanceInput = {
  title_ar?: string;
  summary_lb?: string;
  tags?: string[];
  source?: string;
  source_refs?: SourceRef[];
  section_path?: string[];
  section_label?: string;
  audience_scope?: ProcedureAudienceScope;
  applies_to?: string[];
  content_tier?: ProcedureContentTier;
  domain?: string;
};

const DIRECT_VETERAN_SIGNALS = [
  "متقاعد",
  "متقاعدين",
  "التقاعد",
  "معاش",
  "الحقوق التقاعدية",
  "دفتر التقاعد",
  "إحالة على التقاعد",
  "عسكري متقاعد",
  "صاحب العلاقة",
  "بطاقة الخدمات",
  "البطاقة الصحية",
  "الخدمات الصحية",
  "طبابة",
  "استشفاء",
  "السجل الصحي",
  "وضع صحي",
  "تجديد بطاقة الخدمات",
  "محروقات للضباط المتقاعدين",
];

const DIRECT_FAMILY_SIGNALS = [
  "أرملة",
  "ارملة",
  "أيتام",
  "ايتام",
  "ورثة",
  "الورثة",
  "مستفيد",
  "مستفيدين",
  "زوجة",
  "الزوجة",
  "زوج",
  "ابن",
  "إبن",
  "ابنة",
  "إبنة",
  "البنت",
  "الوالدين",
  "والد",
  "والدة",
  "على العاتق",
  "عائلي",
  "وضع عائلي",
  "ولادة",
  "طلاق",
  "زواج",
  "وفاة",
  "حصر الإرث",
  "حصر ارث",
  "إعادة الابنة على العاتق",
  "مساعدة مدرسية",
  "منحة مدرسية",
  "متابعة دراسة",
];

const ACTIVE_SERVICE_SIGNALS = [
  "الخدمة الفعلية",
  "مجند",
  "تطويع",
  "كلية حربية",
  "مدرسة الرتباء",
  "استئناف الخدمة",
  "تمديد خدمات",
  "خدمة العلم",
  "الاحتياط",
  "للعسكريين العاملين",
];

const INSTITUTIONAL_ADMIN_SIGNALS = [
  "الارتفاق الجوي",
  "القواعد الجوية",
  "التصميم التوجيهي",
  "رخصة بناء",
  "عقار",
  "الثكنات",
  "الالغام",
  "مطار بيروت",
  "طيران شراعي",
  "طوافة",
  "زورق",
  "ابراج",
  "محطات ارسال",
  "vsat",
  "نشاط",
  "مهرجانات",
  "موسيقيه",
  "رياضيه",
  "محاضرات",
  "بحث اكاديمي",
  "مقابله صحفيه",
  "إعلامي",
  "اعلامي",
  "مدنيين",
  "مدني",
  "مرافق عامة",
  "مشروع انمائي",
  "جمعيات",
  "تسهيلات لطالب",
];

const PUBLIC_GENERAL_SIGNALS = [
  "مدنيين",
  "مدني",
  "جمعيات",
  "بلدية",
  "بلديات",
  "مؤسسة عامة",
  "مرافق عامة",
  "طالب جامعي",
  "صحفي",
  "باحث",
  "مشروع إنمائي",
  "مشروع انمائي",
];

function includesAny(haystack: string, signals: string[]): boolean {
  return signals.some((signal) => haystack.includes(signal));
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => cleanPresentationText(value)).filter(Boolean)));
}

function buildRelevanceText(input: RelevanceInput): string {
  return cleanPresentationText([
    input.title_ar,
    input.summary_lb,
    input.source,
    input.section_label,
    ...(input.section_path || []),
    ...(input.tags || []),
  ].filter(Boolean).join(" "));
}

function inferProcedureDomain(input: RelevanceInput, combined: string): string {
  if (input.domain) return input.domain;
  if (includesAny(combined, ["وفاة", "ورثة", "أرملة", "ارملة", "أيتام", "ايتام", "حصر الإرث", "حصر ارث"])) return "death_inheritance";
  if (includesAny(combined, ["زوجة", "ابن", "إبن", "ابنة", "إبنة", "على العاتق", "وضع عائلي", "زواج", "طلاق", "ولادة", "شطب", "إضافة معال"])) return "family_status";
  if (includesAny(combined, ["بطاقة الخدمات", "الخدمات الصحية", "البطاقة الصحية", "بطاقة صحية"])) return "service_card";
  if (includesAny(combined, ["طبابة", "استشفاء", "دواء", "السجل الصحي", "وضع صحي", "معالجه", "معالجة"])) return "medical";
  if (includesAny(combined, ["مدرسية", "مدرسيه", "منحة", "منحه", "دراسة", "دراسه", "جامعة", "جامعه", "مدرسة", "مدرسه"])) return "schooling";
  if (includesAny(combined, ["معاش", "تقاعد", "الحقوق التقاعدية", "دفتر التقاعد", "إحالة على التقاعد", "تصفية حقوق", "تصفيه حقوق"])) return "pension";
  if (includesAny(combined, ACTIVE_SERVICE_SIGNALS)) return "active_service";
  if (includesAny(combined, INSTITUTIONAL_ADMIN_SIGNALS)) return "institutional_admin";
  return "general_admin";
}

function inferAppliesTo(input: RelevanceInput, combined: string): string[] {
  if (input.applies_to?.length) return uniqueStrings(input.applies_to);

  const appliesTo: string[] = [];
  if (includesAny(combined, DIRECT_VETERAN_SIGNALS)) appliesTo.push("veteran");
  if (includesAny(combined, ["زوجة", "الزوجة", "زوج", "أرملة", "ارملة"])) appliesTo.push("spouse");
  if (includesAny(combined, ["ابن", "إبن", "الابن", "ولد", "ذكور"])) appliesTo.push("child_son");
  if (includesAny(combined, ["ابنة", "إبنة", "البنت", "الابنة", "الابنه"])) appliesTo.push("child_daughter");
  if (includesAny(combined, ["أيتام", "ايتام", "يتيم", "يتيمة", "يتيمه"])) appliesTo.push("orphan");
  if (includesAny(combined, ["ورثة", "الورثة", "وارث", "إرث", "ارث"])) appliesTo.push("heirs");
  if (includesAny(combined, ["والد", "والدة", "الوالدين", "والديه"])) appliesTo.push("parents");
  if (includesAny(combined, DIRECT_FAMILY_SIGNALS)) appliesTo.push("family_members");
  if (!appliesTo.length && includesAny(combined, ACTIVE_SERVICE_SIGNALS)) appliesTo.push("active_service");
  if (!appliesTo.length && includesAny(combined, PUBLIC_GENERAL_SIGNALS)) appliesTo.push("public_general");
  return uniqueStrings(appliesTo);
}

export function inferAudienceMeta(input: RelevanceInput): ProcedureAudienceMeta {
  const combined = buildRelevanceText(input);
  const sourceKey = getSourceKey(input.source, input.source_refs);
  const domain = inferProcedureDomain(input, combined);
  const applies_to = inferAppliesTo(input, combined);

  if (input.audience_scope && input.content_tier) {
    return {
      audience_scope: input.audience_scope,
      applies_to,
      content_tier: input.content_tier,
      domain,
      relevance_weight: input.content_tier === "frontline" ? 28 : input.content_tier === "supporting" ? 16 : -8,
    };
  }

  const hasVeteranSignals = applies_to.includes("veteran") || includesAny(combined, DIRECT_VETERAN_SIGNALS);
  const hasFamilySignals = applies_to.includes("family_members") || includesAny(combined, DIRECT_FAMILY_SIGNALS);
  const isActiveOnly = includesAny(combined, ACTIVE_SERVICE_SIGNALS);
  const isInstitutional = domain === "institutional_admin" || includesAny(combined, INSTITUTIONAL_ADMIN_SIGNALS);
  const isPublicGeneral = includesAny(combined, PUBLIC_GENERAL_SIGNALS);

  let audience_scope: ProcedureAudienceScope;
  let content_tier: ProcedureContentTier;

  if (isActiveOnly) {
    audience_scope = "active_service_only";
    content_tier = "archive";
  } else if (isInstitutional) {
    audience_scope = "institutional_admin";
    content_tier = "archive";
  } else if (isPublicGeneral) {
    audience_scope = "public_general";
    content_tier = "archive";
  } else if (hasVeteranSignals && hasFamilySignals) {
    audience_scope = "veteran_or_family";
    content_tier = "frontline";
  } else if (hasFamilySignals) {
    audience_scope = "family_direct";
    content_tier = "frontline";
  } else if (hasVeteranSignals) {
    audience_scope = "veteran_direct";
    content_tier = domain === "pension" || domain === "service_card" || domain === "medical" ? "frontline" : "supporting";
  } else if (sourceKey === "mof" || sourceKey === "retirement" || includesAny(combined, ["وزارة المالية", "دائرة التقاعد"])) {
    audience_scope = "retired_all_forces";
    content_tier = domain === "pension" || domain === "death_inheritance" ? "frontline" : "supporting";
  } else {
    audience_scope = "retired_army_only";
    content_tier = domain === "service_card" || domain === "medical" || domain === "schooling" ? "frontline" : "supporting";
  }

  const audienceWeight: Record<ProcedureAudienceScope, number> = {
    veteran_direct: 12,
    family_direct: 12,
    veteran_or_family: 10,
    retired_army_only: 8,
    retired_all_forces: 7,
    active_service_only: -8,
    institutional_admin: -12,
    public_general: -10,
  };
  const tierWeight: Record<ProcedureContentTier, number> = {
    frontline: 18,
    supporting: 8,
    archive: -12,
  };
  const domainWeight: Record<string, number> = {
    pension: 8,
    family_status: 8,
    death_inheritance: 8,
    service_card: 7,
    medical: 7,
    schooling: 5,
    general_admin: 0,
    institutional_admin: -4,
    active_service: -4,
  };

  return {
    audience_scope,
    applies_to,
    content_tier,
    domain,
    relevance_weight: audienceWeight[audience_scope] + tierWeight[content_tier] + (domainWeight[domain] || 0),
  };
}

function stripInvisible(value: string): string {
  return value.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu, "");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizedTitleSegment(value: string): string {
  return collapseWhitespace(stripInvisible(value))
    .replace(/[.،:;\-–—_]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function areSimilarTitleSegments(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = left.split(/\s+/u).filter(Boolean);
  const rightTokens = right.split(/\s+/u).filter(Boolean);
  if (leftTokens.length < 5 || rightTokens.length < 5) return false;

  const rightTokenSet = new Set(rightTokens);
  const sharedTokens = leftTokens.filter((token) => rightTokenSet.has(token)).length;
  const shorterLength = Math.min(leftTokens.length, rightTokens.length);

  return shorterLength >= 5 && sharedTokens / shorterLength >= 0.8;
}

function collapseRepeatedSegmentCycles(segments: string[]): string[] {
  if (segments.length < 2) return segments;

  const normalizedSegments = segments.map((segment) => normalizedTitleSegment(segment));

  for (let cycleLength = 1; cycleLength <= Math.floor(segments.length / 2); cycleLength += 1) {
    if (segments.length % cycleLength !== 0) continue;

    let matchesCycle = true;
    for (let index = cycleLength; index < normalizedSegments.length; index += 1) {
      if (!areSimilarTitleSegments(normalizedSegments[index], normalizedSegments[index % cycleLength])) {
        matchesCycle = false;
        break;
      }
    }

    if (matchesCycle) {
      return segments.slice(0, cycleLength);
    }
  }

  return segments;
}

function collapseRepeatedTitleSegments(value: string): string {
  const segments = value
    .split(/\s+[\-–—]\s+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) return value;

  const collapsedSegments = collapseRepeatedSegmentCycles(segments);

  const deduped: string[] = [];
  for (const segment of collapsedSegments) {
    const normalized = normalizedTitleSegment(segment);
    const previous = deduped[deduped.length - 1];
    const normalizedPrevious = previous ? normalizedTitleSegment(previous) : "";

    if (normalized && normalizedPrevious && areSimilarTitleSegments(normalized, normalizedPrevious)) {
      if (segment.length > (previous?.length || 0)) {
        deduped[deduped.length - 1] = segment;
      }
      continue;
    }

    deduped.push(segment);
  }

  return deduped.join(" - ");
}

export function cleanPresentationText(value?: string | null): string {
  if (!value) return "";
  return collapseWhitespace(stripInvisible(value));
}

function stripTrailingOcrNoise(value: string): string {
  return value
    .replace(/[.،:;\-–—\s]+[A-Z]{2,6}$/u, "")
    .replace(/[.،:;\-–—\s]+[A-Z]{2,6}\d{1,4}$/u, "")
    .replace(/[.،:;\-–—\s]+\d{1,4}[A-Z]{2,6}$/u, "")
    .replace(/[.،:;\-–—\s]+[A-Z]\d{1,4}$/u, "")
    .replace(/([\p{Script=Arabic})])\d{1,4}$/u, "$1")
    .trim();
}

function hasTrailingOcrNoise(value: string): boolean {
  return /(?:[.،:;\-–—\s]+(?:[A-Z]{2,6}|[A-Z]{2,6}\d{1,4}|\d{1,4}[A-Z]{2,6}|[A-Z]\d{1,4})|[\p{Script=Arabic})]\d{1,4})$/u.test(value);
}

export function cleanProcedureTitle(value?: string | null): string {
  const cleaned = cleanPresentationText(value)
    .replace(/^اجراءات\s+الانتساب\s+الى\s+رابطة\s+قدماء\s+القوى\s+المسلحة$/u, "الانتساب إلى رابطة قدماء القوى المسلحة")
    .replace(/^إجراءات\s+الانتساب\s+إلى\s+رابطة\s+قدماء\s+القوى\s+المسلحة$/u, "الانتساب إلى رابطة قدماء القوى المسلحة")
    .replace(/^procedures:/iu, "")
    .replace(/^رابط\s*\(\s*لينك\s*\)/u, "رابط")
    .replace(/[.\s]+\d{1,4}$/u, "")
    .trim();

  return collapseRepeatedTitleSegments(stripTrailingOcrNoise(cleaned));
}

function isPlaceholderProcedureField(value?: string | null): boolean {
  const cleaned = cleanPresentationText(value);
  if (!cleaned) return false;
  return /^(عنوان السكن ورقم الهاتف|الرقم العسكري)$/u.test(cleaned);
}

function hasRepeatedFaqVariants(procedure: Pick<Procedure, "title_ar" | "faq_variants">): boolean {
  const title = cleanProcedureTitle(procedure.title_ar);
  const variants = (procedure.faq_variants || []).map((entry) => cleanPresentationText(entry)).filter(Boolean);
  if (!title || variants.length < 3) return false;
  return variants.filter((entry) => entry.includes(title)).length >= 3;
}

function isLowValueMembershipStub(
  procedure: Pick<Procedure, "title_ar" | "summary_lb" | "requirements" | "where_to_apply" | "faq_variants">,
): boolean {
  const rawTitle = cleanPresentationText(procedure.title_ar);
  const summary = cleanPresentationText(procedure.summary_lb);
  const requirements = (procedure.requirements || []).map((entry) => cleanPresentationText(entry)).filter(Boolean);
  const whereToApply = (procedure.where_to_apply || []).map((entry) => cleanPresentationText(entry)).filter(Boolean);

  if (!/^(اجراءات|إجراءات)\s+الانتساب\s+(الى|إلى)\s+رابطة\s+قدماء\s+القوى\s+المسلحة$/u.test(rawTitle)) {
    return false;
  }

  if (!/^ملاحظة[:：]?/u.test(summary)) {
    return false;
  }

  const hasOnlyPlaceholderRequirements = requirements.length <= 1 && requirements.every((entry) => isPlaceholderProcedureField(entry));
  const hasOnlyPlaceholderApplyTargets = whereToApply.length > 0 && whereToApply.length <= 2 && whereToApply.every((entry) => isPlaceholderProcedureField(entry));

  return hasOnlyPlaceholderRequirements && hasOnlyPlaceholderApplyTargets && hasRepeatedFaqVariants(procedure);
}

export function getProcedureQualityFlag(procedure: Pick<Procedure, "title_ar" | "summary_lb">): ProcedureQualityFlag {
  const rawTitle = cleanPresentationText(procedure.title_ar);
  const titleClean = cleanProcedureTitle(procedure.title_ar);

  if (!rawTitle) return "clean";
  if (hasTrailingOcrNoise(rawTitle)) return "noisy_title";
  if (titleClean.length >= 8 && rawTitle.length - titleClean.length >= 4) return "noisy_title";
  if (!cleanPresentationText(procedure.summary_lb) && /[A-Z]{2,6}\d{1,4}$/u.test(rawTitle)) return "noisy_title";
  return "clean";
}

function normalizedTagSet(tags?: string[] | null): Set<string> {
  return new Set((tags || []).map((tag) => cleanPresentationText(tag)));
}

export function countStructuredFields(procedure: Pick<Procedure, "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions">): number {
  return [
    procedure.eligibility,
    procedure.requirements,
    procedure.steps,
    procedure.where_to_apply,
    procedure.fees,
    procedure.timelines,
    procedure.contacts,
    procedure.exceptions,
  ].reduce((total, items) => total + (items?.length || 0), 0);
}

export function countRenderableStructuredFields(
  procedure: Pick<Procedure, "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions">,
): number {
  return getRenderableStructuredFieldEntries(procedure).length;
}

const LEGAL_FRAGMENT_TITLE_PATTERNS = [
  /^[0-9٠-٩]+\s*\(\s*أضيفت\s+بموجب/u,
  /^مكرر\s*\(\s*أضيفت\s+بموجب/u,
  /^مادة\s*[0-9٠-٩]+/u,
];

const GENERIC_LEGAL_FRAGMENT_TITLES = new Set([
  "الوضع القانوني",
  "الوظائف",
  "المسؤولية المدنية",
  "الغاء الوظيفة",
  "طلب الاعتمادات",
  "تعريف الانتداب",
  "تأليف مجلس التأديب",
  "حقوق الوكيل وواجباته",
  "حالات عدم استحقاق تعويض الصرف",
  "مراعاة احكام الدستور",
  "تسريح الاجير",
  "الاحكام القانونية",
  "استخدام الاجراء",
]);

const GUIDE_SECTION_SHELL_TITLES = new Set([
  "خدمات خاصة في الجيش",
  "رابطة قدماء القوى المسلحة",
  "جهاز الرعاية والشؤون",
  "معاملات شؤون المناطق",
  "معاملات الشؤون والمالية",
  "معاملات المالية",
  "معاملات في الجيش",
  "بعض معاملات قوى الامن",
  "معاملات مختلفة جيش",
  "معاملات مختلفة عامة",
  "خدمات عامة",
]);

const GUIDE_SECTION_SHELL_PATTERNS = [
  /^خدمات(?:\s+(?:خاصة|عامة))?(?:\s+في\s+الجيش)?$/u,
  /^معاملات(?:\s+(?:شؤون\s+المناطق|الشؤون\s+والمالية|المالية|في\s+الجيش|مختلفة\s+(?:جيش|عامة)))$/u,
  /^بعض\s+معاملات\s+قوى\s+الامن$/u,
  /^رابطة\s+قدماء\s+القوى\s+المسلحة$/u,
  /^جهاز\s+الرعاية\s+والشؤون$/u,
];

const GUIDE_NAVIGATION_PATTERNS = [
  /^أقسام\s+الكتاب$/u,
  /^اضغط\s+على\s+القسم\s+أدناه$/u,
  /^قبل\s+البدء/u,
  /تطبق\s+على\s+العسكريين\s+المتقاعدين/u,
  /هذا\s+الإصدار/u,
];

function getStructuredFieldEntries(
  procedure: Pick<Procedure, "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions">,
): string[] {
  return [
    ...(procedure.eligibility || []),
    ...(procedure.requirements || []),
    ...(procedure.steps || []),
    ...(procedure.where_to_apply || []),
    ...(procedure.fees || []),
    ...(procedure.timelines || []),
    ...(procedure.contacts || []),
    ...(procedure.exceptions || []),
  ].map((entry) => cleanPresentationText(entry)).filter(Boolean);
}

function getRenderableStructuredFieldEntries(
  procedure: Pick<Procedure, "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions">,
): string[] {
  return getStructuredFieldEntries(procedure).filter((entry) => !isGuideNavigationField(entry) && !isPlaceholderProcedureField(entry));
}

function isGuideNavigationField(value?: string | null): boolean {
  const cleaned = cleanPresentationText(value);
  if (!cleaned) return false;
  return GUIDE_NAVIGATION_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function isNonActionableGuideShell(
  procedure: Pick<Procedure, "title_ar" | "summary_lb" | "source" | "source_refs" | "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions">,
): boolean {
  const sourceKey = getSourceKey(procedure.source, procedure.source_refs);
  if (sourceKey !== "procedures") {
    return false;
  }

  const title = cleanProcedureTitle(procedure.title_ar).replace(/\*+$/u, "").trim();
  const summary = cleanPresentationText(procedure.summary_lb);
  const structuredEntries = getStructuredFieldEntries(procedure);
  const hasOnlyNavigationEntries = structuredEntries.length > 0 && structuredEntries.every((entry) => isGuideNavigationField(entry));

  if (!summary && structuredEntries.length === 0) {
    return true;
  }

  if (structuredEntries.length === 0 && /^[A-Za-z]{2,6}$/u.test(summary)) {
    return true;
  }

  if ((summary || structuredEntries.length > 0) && !hasOnlyNavigationEntries) {
    return false;
  }

  if (GUIDE_SECTION_SHELL_TITLES.has(title)) {
    return true;
  }

  return GUIDE_SECTION_SHELL_PATTERNS.some((pattern) => pattern.test(title));
}

export function shouldSuppressProcedureFromCatalog(
  procedure: Pick<Procedure, "title_ar" | "summary_lb" | "source" | "source_refs" | "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions" | "faq_variants">,
): boolean {
  return isHardExcludedLegalFragment(procedure) || isNonActionableGuideShell(procedure) || isLowValueMembershipStub(procedure);
}

function isHardExcludedLegalFragment(
  procedure: Pick<Procedure, "title_ar" | "summary_lb" | "source" | "source_refs" | "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions">,
): boolean {
  const sourceKey = getSourceKey(procedure.source, procedure.source_refs);
  if (!new Set(["retirement", "defense", "labor", "employees", "compensations"]).has(sourceKey)) {
    return false;
  }

  const title = cleanProcedureTitle(procedure.title_ar).replace(/\*+$/u, "").trim();
  const summary = cleanPresentationText(procedure.summary_lb);
  const structuredFieldCount = countStructuredFields(procedure);

  if (LEGAL_FRAGMENT_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return true;
  }

  if (GENERIC_LEGAL_FRAGMENT_TITLES.has(title)) {
    return true;
  }

  if (structuredFieldCount === 0 && /(?:^|[\s:()\-–—])المادة\s*[0-9٠-٩]+/u.test(title)) {
    return true;
  }

  if (structuredFieldCount === 0 && /^المادة\s*[0-9٠-٩]+/u.test(summary)) {
    return true;
  }

  return false;
}

export function isListableProcedure(
  procedure: Pick<Procedure, "title_ar" | "summary_lb" | "tags" | "source" | "source_refs" | "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions" | "faq_variants">,
): boolean {
  if (shouldSuppressProcedureFromCatalog(procedure)) {
    return false;
  }

  const kind = getProcedureRecordKind(procedure);
  return kind === "procedure" && countRenderableStructuredFields(procedure) > 0;
}

function hasDenseNumericSummary(summary: string): boolean {
  const numberMatches = summary.match(/\d+/gu) || [];
  return numberMatches.length >= 4;
}

function isNumericOrCodeLikeTitle(title: string): boolean {
  const compactTitle = title.replace(/[.،:;\-–—\s]+/gu, "");
  if (!compactTitle) return false;

  if (/^[\d\u0660-\u0669]+$/u.test(compactTitle)) {
    return true;
  }

  if (!/[\p{Script=Arabic}]/u.test(compactTitle) && /^[\d\u0660-\u0669A-Za-z]+$/u.test(compactTitle)) {
    return true;
  }

  if (/^[\d\u0660-\u0669]+[A-Za-z]{1,4}$/u.test(compactTitle) || /^[A-Za-z]{1,4}[\d\u0660-\u0669]+$/u.test(compactTitle)) {
    return true;
  }

  return false;
}

function isFragmentEntry(procedure: Pick<Procedure, "title_ar" | "summary_lb" | "source" | "source_refs" | "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions" | "faq_variants">): boolean {
  const title = cleanProcedureTitle(procedure.title_ar);
  const summary = cleanPresentationText(procedure.summary_lb);
  const tokenCount = title.split(/\s+/u).filter(Boolean).length;
  const structuredFieldCount = countStructuredFields(procedure);
  const summaryHasScheduleSignals = /(الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد|الساعة|دوام|اوقات|أوقات)/u.test(summary);

  if (shouldSuppressProcedureFromCatalog(procedure)) {
    return true;
  }

  if (isNumericOrCodeLikeTitle(title)) {
    return true;
  }

  if (/^(دوام|اوقات|أوقات|ساعات)(?:\s|$)/u.test(title) && structuredFieldCount === 0 && !summaryHasScheduleSignals) {
    return true;
  }

  if (/^(الفصل|الباب|القسم|المادة)(?:\s|$)/u.test(title)) {
    return true;
  }

  if (/^(نماذج|جدول|نظام)(?:\s|$)/u.test(title)) {
    return true;
  }

  if (tokenCount <= 2 && hasDenseNumericSummary(summary)) {
    return true;
  }

  if (/^(مليون|الف|ألف|ليرة|دولار)(?:\s|$)/u.test(title)) {
    return true;
  }

  // KB Studio auto-generated placeholder summary — indicates a legal article or non-actionable entry
  // that was extracted without a real procedure description, e.g.:
  // "إجراء لتقديم الترقية لدى المرجع الإداري المختص ومتابعة النتيجة مع المرجع المختص."
  if (/^إجراء لتقديم .{1,40} لدى المرجع الإداري المختص/u.test(summary)) {
    return true;
  }

  // Summary is a verbatim legal article citation (المادة N - ...) — not an actionable procedure
  if (/^المادة\s*[0-9٠-٩]+\s*[-–—]/u.test(summary)) {
    return true;
  }

  return false;
}

function isNoticeEntry(procedure: Pick<Procedure, "title_ar" | "summary_lb" | "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions">): boolean {
  const title = cleanProcedureTitle(procedure.title_ar);
  const summary = cleanPresentationText(procedure.summary_lb);
  const structuredFieldCount = countStructuredFields(procedure);
  const hasContacts = (procedure.contacts?.length || 0) > 0;
  const hasFees = (procedure.fees?.length || 0) > 0;
  const hasTimelines = (procedure.timelines?.length || 0) > 0;
  const summaryHasContactSignals = /(هاتف|هواتف|اتصال|تحويل|استعلامات)/u.test(summary);
  const summaryHasFeeSignals = /(بدل|رسوم|طابع|طوابع|كلفة|تكلفة)/u.test(summary);
  const summaryHasScheduleSignals = /(الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد|الساعة|دوام|اوقات|أوقات)/u.test(summary);

  if (/^(أرقام هواتف|ارقام هواتف|هواتف|إيجاز|ايجاز)(?:\s|$)/u.test(title)) {
    return true;
  }

  if (/^(بدل|رسوم|طابع|طوابع)(?:\s|$)/u.test(title)) {
    return true;
  }

  if (/^ايجاز\s+عن\s+/u.test(title) || /^إيجاز\s+عن\s+/u.test(title)) {
    return true;
  }

  if (/^(دوام|اوقات|أوقات|ساعات)(?:\s|$)/u.test(title) && (summaryHasScheduleSignals || hasTimelines)) {
    return true;
  }

  if (structuredFieldCount <= 2 && summary && (summaryHasContactSignals || summaryHasFeeSignals) && (hasContacts || hasFees || hasTimelines)) {
    return true;
  }

  return false;
}

export function getProcedureRecordKind(procedure: Pick<Procedure, "title_ar" | "summary_lb" | "tags" | "source" | "source_refs" | "eligibility" | "requirements" | "steps" | "where_to_apply" | "fees" | "timelines" | "contacts" | "exceptions" | "faq_variants">): ProcedureRecordKind {
  const title = cleanProcedureTitle(procedure.title_ar);
  const summary = cleanPresentationText(procedure.summary_lb);
  const tags = normalizedTagSet(procedure.tags);

  if (isFragmentEntry(procedure)) {
    return "fragment";
  }

  if (isNoticeEntry(procedure)) {
    return "notice";
  }

  if (
    /^رابط(?:\s|$)/u.test(title) ||
    /(?:^|\s)لينك(?:\s|$)/u.test(title) ||
    tags.has("رابط") ||
    tags.has("لينك")
  ) {
    return "reference";
  }

  if (!summary && /^لائحة(?:\s|$)/u.test(title)) {
    return "reference";
  }

  return "procedure";
}

export function getProcedureSummary(procedure: Pick<Procedure, "title_ar" | "summary_lb" | "tags" | "requirements" | "where_to_apply" | "faq_variants">): string {
  const kind = getProcedureRecordKind(procedure);
  const summary = cleanPresentationText(procedure.summary_lb);
  if (isLowValueMembershipStub(procedure)) {
    return "المصدر لا يقدّم تفاصيل تنفيذية كافية لهذه المعاملة، ويذكر فقط مراجعة الرقم العسكري مع بيانات الخدمة الأساسية، لذلك لا تُعرض كإجراء مستقل مكتمل.";
  }
  if (summary) {
    // Strip redundant title prefix when the summary starts with the procedure title
    // (KB Studio sometimes generates summaries that begin with the title verbatim)
    const cleanTitle = cleanProcedureTitle(procedure.title_ar).replace(/[*،:.\-–—]+$/u, "").trim();
    if (cleanTitle.length > 5 && summary.startsWith(cleanTitle)) {
      const remainder = summary.slice(cleanTitle.length).replace(/^[\s،:.\-–—]+/u, "").trim();
      if (remainder.length > 20) return remainder;
    }
    return summary;
  }
  if (kind === "reference") return "مرجع مباشر من المصدر الرسمي أو رابط مرتبط بالمعاملة.";
  if (kind === "notice") return "هذا السجل يحتوي معلومات مرجعية أو تشغيلية مساندة، وليس مسار معاملة كاملاً.";
  if (kind === "fragment") return "هذا السجل عبارة عن مقتطف مرجعي أو عنوان تنظيمي، وليس إجراءً مستقلاً قابلاً للتنفيذ.";
  return "افتح البطاقة لعرض  والمستندات والمراجع المرتبطة.";
}

export function normalizeSectionLabel(value?: string | null): string {
  const cleaned = cleanPresentationText(value);
  if (!cleaned) return "";

  const direct = SECTION_FIXUPS[cleaned];
  if (direct) return direct;

  const strippedNumericSuffix = cleaned.replace(/\d+$/u, "").trim();
  return SECTION_FIXUPS[strippedNumericSuffix] || strippedNumericSuffix;
}

export function inferSourceKey(value?: string | null): string | undefined {
  const cleaned = cleanPresentationText(value).toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned === "mof" || cleaned.includes("mof") || cleaned.includes("وزارة المالية")) return "mof";
  if (cleaned === "laf" || cleaned.includes("laf") || cleaned.includes("الجيش")) return "laf";
  if (cleaned.includes("awsema") || cleaned.includes("وسمة") || cleaned.includes("اوسمة") || cleaned.includes("رئاسة الجمهورية")) return "awsema";
  if (cleaned.includes("procedures") || cleaned.includes("إجراءات") || cleaned.includes("اجراءات") || cleaned.includes("معاملات")) return "procedures";
  if (cleaned.includes("التقاعد") || cleaned.includes("الصرف") || cleaned.includes("الخدمة")) return "retirement";
  if (cleaned.includes("الدفاع الوطني")) return "defense";
  if (cleaned.includes("قانون العمل")) return "labor";
  if (cleaned.includes("قانون الموظفين")) return "employees";
  if (cleaned.includes("التعويضات") || cleaned.includes("المساعدات")) return "compensations";
  return undefined;
}

export function getSourceKey(source?: string, sourceRefs?: SourceRef[]): string {
  const direct = inferSourceKey(source);
  if (direct) return direct;

  for (const ref of sourceRefs || []) {
    const inferred = inferSourceKey(ref.source_id) || inferSourceKey(ref.source_path);
    if (inferred) return inferred;
  }

  return source ? cleanPresentationText(source).toLowerCase() || "other" : "other";
}

export function getSourceLabel(source?: string, sourceRefs?: SourceRef[]): string {
  const key = getSourceKey(source, sourceRefs);
  return SOURCE_LABELS[key] || cleanPresentationText(source) || SOURCE_LABELS.other;
}

export function getSectionLabelFromSource(source?: string, sourceRefs?: SourceRef[]): string {
  const key = getSourceKey(source, sourceRefs);
  return SECTION_LABELS[key] || getSourceLabel(source, sourceRefs);
}

export function normalizeSectionPath(sectionPath?: string[] | null): string[] {
  return (sectionPath || []).map((entry) => normalizeSectionLabel(entry)).filter(Boolean);
}

export function presentProcedure<T extends Procedure & PresentableSource>(procedure: T): T & {
  source: string;
  source_label: string;
  section_path: string[];
  section_label: string;
  record_kind: ProcedureRecordKind;
  quality_flag: ProcedureQualityFlag;
  title_clean: string;
  summary_clean: string;
  audience_scope: ProcedureAudienceScope;
  applies_to: string[];
  content_tier: ProcedureContentTier;
  domain: string;
  relevance_weight: number;
} {
  const lowValueMembershipStub = isLowValueMembershipStub(procedure);
  const source = getSourceKey(procedure.source, procedure.source_refs);
  const section_path = normalizeSectionPath(procedure.section_path);
  const section_label = section_path[0] || getSectionLabelFromSource(source, procedure.source_refs);
  const title_clean = cleanProcedureTitle(procedure.title_ar);
  const record_kind = getProcedureRecordKind(procedure);
  const quality_flag = getProcedureQualityFlag(procedure);
  const summary_clean = getProcedureSummary(procedure);
  const audienceMeta = inferAudienceMeta({
    ...procedure,
    source,
    section_path,
    section_label,
    title_ar: title_clean || procedure.title_ar,
    summary_lb: summary_clean || procedure.summary_lb,
  });

  return {
    ...procedure,
    source,
    source_label: getSourceLabel(source, procedure.source_refs),
    section_path,
    section_label,
    record_kind,
    quality_flag,
    title_clean,
    summary_clean,
    audience_scope: audienceMeta.audience_scope,
    applies_to: audienceMeta.applies_to,
    content_tier: lowValueMembershipStub ? "archive" : audienceMeta.content_tier,
    domain: audienceMeta.domain,
    relevance_weight: lowValueMembershipStub ? Math.min(audienceMeta.relevance_weight, -8) : audienceMeta.relevance_weight,
  };
}