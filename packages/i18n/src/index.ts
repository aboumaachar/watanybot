/**
 * @watany/i18n — Internationalization stub.
 */
export const defaultLang = "ar";

export function t(key: string, lang = "ar"): string {
  return key;
}

export const defaultLocale = defaultLang;

export function dirForLocale(_locale?: string): "ltr" | "rtl" {
  return "rtl";
}
