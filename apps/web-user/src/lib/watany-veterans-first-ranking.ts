export type WatanyListingItem = {
  id?: string;
  title?: string;
  titleAr?: string;
  question?: string;
  summary?: string;
  description?: string;
  answer?: string;
  authority?: string;
  sourceAuthority?: string;
  sourceId?: string;
  sourceName?: string;
  sourceType?: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  audience?: string[];
  relationTypes?: string[];
  documentType?: string;
  procedureType?: string;
  priority?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type WatanyVeteransRankingSignals = {
  veteranRelevanceScore: number;
  authorityPriorityScore: number;
  documentPriorityScore: number;
  explicitPriorityScore: number;
  recencyScore: number;
  finalRankingScore: number;
  rankingReasons: string[];
};

export type RankWatanyOptions = {
  query?: string;
};

const VETERAN_HIGH_SIGNALS = [
  "متقاعد", "متقاعدين", "العسكريين المتقاعدين", "العسكري المتقاعد", "قدامى", "محاربين",
  "معاش", "معاش تقاعدي", "راتب", "تعويض", "تعويض وفاة", "مساعدة اجتماعية", "مساعدة مدرسية",
  "دعم",
  "منح مدرسية", "طبابة", "استشفاء", "حقوق", "مخصصات", "بدلات", "وفاة", "أرملة", "زوجة",
  "اولاد", "أولاد", "ابناء", "أبناء", "ذوي", "عائلة العسكري", "veteran", "veterans",
  "retired military", "military retiree", "pension", "salary", "compensation", "allowance",
  "entitlement", "benefit", "benefits", "social assistance", "school aid", "education aid",
  "medical aid", "hospitalization", "healthcare", "spouse", "widow", "children", "dependents",
  "death benefit", "service certificate", "retirement certificate", "army retiree", "laf retiree",
  "isf retiree",
];

const VETERAN_MEDIUM_SIGNALS = [
  "عسكري", "عسكريين", "الجيش", "قوى الأمن", "الأمن العام", "أمن الدولة", "الجمارك", "شرطة مجلس النواب",
  "مديرية الشؤون الاجتماعية", "وزارة المالية", "الشؤون الاجتماعية", "service-member", "family-support",
  "retired soldier", "military family",
];

const GENERIC_LOW_PRIORITY_SIGNALS = [
  "صورة جوية", "طلب صورة جوية", "aerial photography", "map request", "public mapping services",
  "generic certificate", "general administrative permit", "civil registry", "unrelated technical forms",
  "non-veteran government procedure",
];

const AUTHORITY_PRIORITY: Array<{ score: number; terms: string[] }> = [
  { score: 9, terms: ["ministry of finance", "mof", "وزارة المالية", "مالية"] },
  { score: 8, terms: ["ministry of social affairs", "social affairs", "الشؤون الاجتماعية", "الشؤون"] },
  { score: 7, terms: ["lebanese armed forces", "laf", "الجيش اللبناني", "قيادة الجيش", "الجيش"] },
  { score: 6, terms: ["internal security forces", "isf", "قوى الأمن الداخلي"] },
  { score: 5, terms: ["general security", "الأمن العام"] },
  { score: 4, terms: ["state security", "امن الدولة", "أمن الدولة"] },
  { score: 3, terms: ["customs", "الجمارك"] },
  { score: 2, terms: ["parliament police", "شرطة مجلس النواب"] },
];

function toSafeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function normalizeArabicEnglish(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

function includesAny(haystack: string, terms: string[]): string[] {
  return terms.filter((term) => haystack.includes(normalizeArabicEnglish(term)));
}

function daysSince(timestamp?: string): number | null {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
}

function buildHaystack(item: WatanyListingItem, query = ""): string {
  return normalizeArabicEnglish([
    item.title,
    item.titleAr,
    item.question,
    item.summary,
    item.description,
    item.answer,
    item.authority,
    item.sourceAuthority,
    item.sourceId,
    item.sourceName,
    item.sourceType,
    item.category,
    item.documentType,
    item.procedureType,
    ...(item.tags || []),
    ...(item.keywords || []),
    ...(item.audience || []),
    ...(item.relationTypes || []),
    query,
  ].map(toSafeString).join(" "));
}

export function scoreWatanyVeteranRelevance(item: WatanyListingItem, options: RankWatanyOptions = {}): number {
  const haystack = buildHaystack(item, options.query || "");
  const highHits = includesAny(haystack, VETERAN_HIGH_SIGNALS).length;
  const mediumHits = includesAny(haystack, VETERAN_MEDIUM_SIGNALS).length;
  const genericHits = includesAny(haystack, GENERIC_LOW_PRIORITY_SIGNALS).length;

  if (highHits >= 3) return 5;
  if (highHits >= 1 || mediumHits >= 3) return 4;
  if (mediumHits >= 1) return 3;
  if (genericHits >= 1) return 1;
  return 2;
}

export function getWatanyAuthorityPriority(item: WatanyListingItem): number {
  const authorityHaystack = normalizeArabicEnglish([
    item.authority,
    item.sourceAuthority,
    item.sourceName,
    item.sourceId,
  ].map(toSafeString).join(" "));

  for (const row of AUTHORITY_PRIORITY) {
    if (row.terms.some((term) => authorityHaystack.includes(normalizeArabicEnglish(term)))) {
      return row.score;
    }
  }

  return 1;
}

function getDocumentPriorityScore(item: WatanyListingItem): number {
  const haystack = buildHaystack(item);
  if (includesAny(haystack, ["benefit", "rights", "entitlement", "pension", "معاش", "تعويض", "مساعدة", "دعم", "طبابة", "مدرسية"]).length > 0) {
    return 5;
  }
  if (includesAny(haystack, ["procedure", "form", "faq", "law", "directive", "memo", "memorandum", "اجراء", "نموذج", "سؤال", "قانون", "تعميم", "مذكرة"]).length > 0) {
    return 3;
  }
  return 1;
}

function getRecencyScore(item: WatanyListingItem): number {
  const days = daysSince(item.updatedAt || item.createdAt);
  if (days === null) return 0;
  if (days <= 30) return 5;
  if (days <= 90) return 3;
  if (days <= 180) return 2;
  return 1;
}

function getExplicitPriorityScore(item: WatanyListingItem): number {
  if (!Number.isFinite(item.priority)) return 0;
  return Math.max(0, Math.min(9, Number(item.priority)));
}

export function rankWatanyVeteransFirstItems<T extends WatanyListingItem>(
  items: readonly T[],
  options: RankWatanyOptions = {},
): Array<{ item: T; signals: WatanyVeteransRankingSignals }> {
  return items.map((item) => {
    const veteranRelevanceScore = scoreWatanyVeteranRelevance(item, options);
    const authorityPriorityScore = getWatanyAuthorityPriority(item);
    const documentPriorityScore = getDocumentPriorityScore(item);
    const explicitPriorityScore = getExplicitPriorityScore(item);
    const recencyScore = getRecencyScore(item);

    // build haystack for term checks
    const haystack = buildHaystack(item, options.query || '');

    // small semantic boost for explicit benefit-type items (social assistance, pension, compensation)
    const benefitTerms = ['مساعدة', 'معاش', 'تعويض', 'منحة', 'منح'];
    const benefitBoost = includesAny(haystack, benefitTerms).length > 0 ? 60 : 0;

    const finalRankingScore =
      // authority is the primary tiebreaker across sources
      authorityPriorityScore * 1000 +
      // veteran relevance is an important boost but below authority
      veteranRelevanceScore * 100 +
      documentPriorityScore * 20 +
      explicitPriorityScore * 10 +
      recencyScore +
      benefitBoost;

    const rankingReasons: string[] = [
      `veteranRelevance=${veteranRelevanceScore}`,
      `authorityPriority=${authorityPriorityScore}`,
      `documentPriority=${documentPriorityScore}`,
    ];

    if (explicitPriorityScore > 0) rankingReasons.push(`explicitPriority=${explicitPriorityScore}`);
    if (recencyScore > 0) rankingReasons.push(`recency=${recencyScore}`);

    return {
      item,
      signals: {
        veteranRelevanceScore,
        authorityPriorityScore,
        documentPriorityScore,
        explicitPriorityScore,
        recencyScore,
        finalRankingScore,
        rankingReasons,
      },
    };
  }).sort((left, right) => {
    if (right.signals.finalRankingScore !== left.signals.finalRankingScore) {
      return right.signals.finalRankingScore - left.signals.finalRankingScore;
    }
    return (left.item.title || left.item.titleAr || "").localeCompare((right.item.title || right.item.titleAr || ""), "ar");
  });
}

export function sortWatanyListingsVeteransFirst<T extends WatanyListingItem>(
  items: readonly T[],
  options: RankWatanyOptions = {},
): T[] {
  return rankWatanyVeteransFirstItems(items, options).map((entry) => entry.item);
}
