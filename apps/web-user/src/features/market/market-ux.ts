export type MarketStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "REMOVED";
export type MarketContactPreference = "WHATSAPP" | "PHONE" | "IN_APP" | "HIDDEN";
export type MarketTrustLevel = "NEW" | "TRUSTED" | "FEATURED";

export const marketStatusLabels: Record<MarketStatus, string> = {
  PENDING_REVIEW: "بانتظار مراجعة الإدارة",
  APPROVED: "منشور في السوق",
  REJECTED: "بحاجة لتعديل قبل النشر",
  REMOVED: "تمت إزالته",
};

export const marketStatusHints: Record<MarketStatus, string> = {
  PENDING_REVIEW: "إعلانك وصل. الإدارة تراجعه قبل ظهوره للناس.",
  APPROVED: "الإعلان ظاهر حالياً في السوق.",
  REJECTED: "راجع سبب الرفض وعدّل الإعلان قبل إعادة الإرسال.",
  REMOVED: "الإعلان غير ظاهر ولا يمكن تداوله.",
};

export const contactPreferenceOptions: Array<{ value: MarketContactPreference; label: string; hint: string }> = [
  { value: "WHATSAPP", label: "واتساب", hint: "الأفضل للتواصل السريع" },
  { value: "PHONE", label: "هاتف", hint: "اتصال مباشر عند الحاجة" },
  { value: "IN_APP", label: "داخل التطبيق", hint: "تواصل آمن بدون إظهار الرقم" },
  { value: "HIDDEN", label: "إخفاء التواصل", hint: "لا تعرض معلومات تواصل للعلن" },
];

export const phase3TrustLabels: Record<MarketTrustLevel, string> = {
  NEW: "بائع جديد",
  TRUSTED: "بائع موثوق",
  FEATURED: "بائع مميّز",
};

export function marketTrustBadge(input?: { verifiedByWatany?: boolean; featuredVeteranSeller?: boolean; sellerTrustLevel?: MarketTrustLevel }): string {
  if (input?.verifiedByWatany) return "موثّق من موطني";
  if (input?.featuredVeteranSeller) return "بائع عسكري مميّز";
  return phase3TrustLabels[input?.sellerTrustLevel || "NEW"];
}

export function isVisiblePublicStatus(status: string): boolean {
  return status === "APPROVED";
}

export function safeStatusLabel(status: string): string {
  return marketStatusLabels[(status as MarketStatus) || "PENDING_REVIEW"] || "حالة غير معروفة";
}