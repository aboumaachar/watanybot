const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function normalizeArabicText(input?: string | null): string {
  if (!input) {
    return "";
  }

  return String(input)
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeSearchText(input?: string | null): string {
  return normalizeArabicText(input)
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchTokens(input?: string | null): string[] {
  const normalized = normalizeSearchText(input);
  if (!normalized) {
    return [];
  }

  return Array.from(new Set(normalized.split(" ").filter((token) => token.length > 1)));
}

export function includesNormalized(candidate: string, query: string): boolean {
  const normalizedCandidate = normalizeSearchText(candidate);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedCandidate || !normalizedQuery) {
    return false;
  }

  return normalizedCandidate.includes(normalizedQuery);
}