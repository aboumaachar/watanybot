import type { FormListItem, FormSourceCard } from "./api";

function normalizeArabicSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .trim();
}

const FORM_SOURCE_RELEVANCE: Record<string, number> = {
  retirement: 220,
  laf: 170,
  medical: 130,
  compensation: 120,
  financial: 95,
  grant: 80,
  education: 65,
  admin: 10,
  mof: 30,
  other: 0,
};

const FORM_VETERAN_STRONG_SIGNALS = [
  "متقاعد",
  "متقاعدين",
  "تقاعد",
  "معاش",
  "معاشات",
  "عسكري",
  "عسكريين",
  "محارب",
  "الجيش",
  "خدمات المتقاعدين",
  "طبابة",
  "تعويض",
  "ارث",
  "إرث",
  "ورثة",
];

const FORM_VETERAN_FAMILY_SIGNALS = ["ارملة", "أرملة", "عائلة", "ابنة", "ابن", "وفاة", "استشهاد"];
const FORM_GENERIC_ADMIN_SIGNALS = ["اداري", "إداري", "عام", "معاملة عامة", "طلب عام"];

export function getFormVeteranRelevance(form: FormListItem): number {
  const sourceWeight = FORM_SOURCE_RELEVANCE[form.sourceId] || 0;
  const searchable = normalizeArabicSearch([
    form.title_ar,
    form.description_ar,
    form.category || "",
    form.authority || "",
    form.sourceName || "",
    ...(form.tags || []),
    form.governance?.officialSourceLabel || "",
  ].join(" "));

  const strongHits = FORM_VETERAN_STRONG_SIGNALS.filter((term) => searchable.includes(normalizeArabicSearch(term))).length;
  const familyHits = FORM_VETERAN_FAMILY_SIGNALS.filter((term) => searchable.includes(normalizeArabicSearch(term))).length;
  const genericAdminHits = FORM_GENERIC_ADMIN_SIGNALS.filter((term) => searchable.includes(normalizeArabicSearch(term))).length;

  let score = sourceWeight;
  score += strongHits * 20;
  score += familyHits * 12;
  score += (form.related_tx?.length || 0) > 0 ? 12 : 0;
  score += form.governance?.governanceState === "official_reference" ? 6 : 0;

  if (strongHits === 0 && familyHits === 0) {
    score -= genericAdminHits * 10;
  }

  return score;
}

export function sortFormsByVeteranRelevance(items: FormListItem[]): FormListItem[] {
  return [...items].sort((left, right) => {
    const relevanceDelta = getFormVeteranRelevance(right) - getFormVeteranRelevance(left);
    if (relevanceDelta !== 0) return relevanceDelta;

    return normalizeArabicSearch(left.title_ar).localeCompare(normalizeArabicSearch(right.title_ar), "ar");
  });
}

export function getSourceVeteranRelevance(source: FormSourceCard): number {
  const sourceWeight = FORM_SOURCE_RELEVANCE[source.sourceId] || 0;
  const searchable = normalizeArabicSearch([source.sourceName, source.description || ""].join(" "));
  const strongHits = FORM_VETERAN_STRONG_SIGNALS.filter((term) => searchable.includes(normalizeArabicSearch(term))).length;
  return sourceWeight + strongHits * 10;
}