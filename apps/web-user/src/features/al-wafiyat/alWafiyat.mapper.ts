import { getAlWafiyatSourceById, getAlWafiyatSourceByProvider } from "./alWafiyat.classifier";
import type { AlWafiyatNoticeLike } from "./alWafiyat.types";

export function formatAlWafiyatDate(value?: string | null): string {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-LB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function getAlWafiyatMetaLine(notice: AlWafiyatNoticeLike): string {
  const source = getAlWafiyatSourceById(notice.sourceId) || getAlWafiyatSourceByProvider(notice.sourceProvider);
  return [formatAlWafiyatDate(notice.noticeDate), source?.providerAr || notice.sourceProviderAr, "منشور بعد الاعتماد الإداري"]
    .filter(Boolean)
    .join(" - ");
}

export function getAlWafiyatExcerpt(notice: AlWafiyatNoticeLike, maxLength = 220): string {
  const text = String(notice.rawText || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export function getAlWafiyatExternalLinks(notice: AlWafiyatNoticeLike) {
  const source = getAlWafiyatSourceById(notice.sourceId) || getAlWafiyatSourceByProvider(notice.sourceProvider);

  return {
    sourceLabel: source?.titleAr || notice.sourceProviderAr,
    sourceUrl: notice.sourceUrl,
    originalUrl: notice.originalUrl && notice.originalUrl !== notice.sourceUrl ? notice.originalUrl : "",
  };
}