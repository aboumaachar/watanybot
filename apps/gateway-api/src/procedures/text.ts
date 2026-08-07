const AR_DIACRITICS = /[\u064B-\u0652\u0670]/g;
const AR_PUNCT =
  /[\u060C\u061B\u061F\u066A-\u066D\u06D4.,;:!?()[\]{}"'\-_/\\]/g;

function normalizeArabicLetters(value: string): string {
  return value
    .replace(/[إأآٱ]/g, "ا")
    .replace(/[ؤئ]/g, "ء")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

/** Strip diacritics, punctuation, normalise whitespace, lowercase. */
export function normalizeArabic(s: string): string {
  return (s || "")
    .replace(/\u0640/g, "")
    .replace(/[\u200f\u200e]/g, "")
    .replace(AR_DIACRITICS, "")
    .replace(/[\u0653-\u0655]/g, "")
    .replace(/./gu, (ch) => normalizeArabicLetters(ch))
    .replace(AR_PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Tokenise Arabic text into >=2-char tokens. */
export function tokenize(s: string): string[] {
  const n = normalizeArabic(s);
  if (!n) return [];
  const tokens = n.split(" ").filter((t) => t.length >= 2);
  const expanded: string[] = [];
  for (const token of tokens) {
    expanded.push(token);
    if (token.startsWith("ال") && token.length > 4) {
      expanded.push(token.slice(2));
    }
  }
  return uniq(expanded);
}

/** Deduplicate an array, preserving order. */
export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
