import type { Lang } from "../types/domain";
import { normalizeArabic as normalizeSharedArabic } from "@watany/shared/arabic";

export function isProbablyArabizi(value: string): boolean {
  const hasLatin = /[a-z]/i.test(value);
  const hasArabiziNums = /[2356789]/.test(value);
  const hasArabic = /[\u0600-\u06FF]/.test(value);
  return hasLatin && hasArabiziNums && !hasArabic;
}

export function arabiziToArabicForSearch(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  return normalizeSharedArabic(trimmed) || trimmed;
}

export function normalizeSearchableArabicInput(value: string): string {
  const trimmed = (value || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const looksLikeArabizi = !/[\u0600-\u06FF]/.test(trimmed)
    && /[a-z]/i.test(trimmed)
    && /(?:[2356789]|kh|gh|sh|ch|th|dh)/i.test(trimmed);

  if (isProbablyArabizi(trimmed) || looksLikeArabizi) {
    return arabiziToArabicForSearch(trimmed);
  }

  return trimmed;
}

export function dirForLang(_lang?: Lang): "rtl" | "ltr" {
  return "rtl";
}
