import { AL_WAFIYAT_SOURCES } from "./alWafiyat.sources";
import type { AlWafiyatSourceProvider, AlWafiyatSourceRecord, AlWafiyatStatus } from "./alWafiyat.types";

export function getAlWafiyatSourceById(sourceId?: string | null): AlWafiyatSourceRecord | null {
  return AL_WAFIYAT_SOURCES.find((source) => source.id === sourceId) ?? null;
}

export function getAlWafiyatSourceByProvider(provider?: string | null): AlWafiyatSourceRecord | null {
  return AL_WAFIYAT_SOURCES.find((source) => source.providerCode === provider) ?? null;
}

export function getAlWafiyatProviderLabel(provider?: AlWafiyatSourceProvider | string | null): string {
  return getAlWafiyatSourceByProvider(provider)?.providerAr || "مصدر رسمي";
}

export function getAlWafiyatStatusLabel(status: AlWafiyatStatus): string {
  switch (status) {
    case "APPROVED":
      return "معتمد";
    case "PENDING_APPROVAL":
      return "بانتظار الاعتماد";
    case "REJECTED":
      return "مرفوض";
    case "IMPORTED":
    default:
      return "معاينة مستوردة";
  }
}

export function getAlWafiyatStatusTone(status: AlWafiyatStatus): string {
  if (status === "APPROVED") return "wt-pill wt-pill--ok";
  if (status === "PENDING_APPROVAL") return "wt-pill wt-pill--wait";
  return "wt-pill";
}