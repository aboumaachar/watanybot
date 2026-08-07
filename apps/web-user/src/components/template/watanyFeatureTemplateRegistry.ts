import type { WatanyFeatureCategory } from "./watanyFeatureTemplateTypes";

export type WatanyFeatureCategoryStyle = Readonly<{
  label: string;
  tone: string;
  iconLabel: string;
}>;

export const WATANY_FEATURE_CATEGORY_STYLES: Record<WatanyFeatureCategory, WatanyFeatureCategoryStyle> = {
  general: { label: "موطني", tone: "general", iconLabel: "موطني" },
  service: { label: "الخدمات", tone: "service", iconLabel: "خ" },
  procedure: { label: "المعاملات", tone: "procedure", iconLabel: "م" },
  benefits: { label: "الحقوق والتعويضات", tone: "benefits", iconLabel: "ح" },
  jobs: { label: "الوظائف والتعاميم", tone: "jobs", iconLabel: "و" },
  market: { label: "الفرص والسوق", tone: "market", iconLabel: "ف" },
  legal: { label: "القوانين", tone: "legal", iconLabel: "ق" },
  document: { label: "المستندات", tone: "document", iconLabel: "د" },
  community: { label: "مجتمعي", tone: "community", iconLabel: "ج" },
  chat: { label: "المساعد", tone: "chat", iconLabel: "ش" },
  updates: { label: "التعاميم", tone: "updates", iconLabel: "ت" },
  profile: { label: "الحساب", tone: "profile", iconLabel: "ح" },
  admin: { label: "الإدارة", tone: "admin", iconLabel: "إ" },
  form: { label: "النماذج", tone: "form", iconLabel: "ن" }
};

export function getWatanyFeatureCategoryStyle(category: WatanyFeatureCategory | undefined): WatanyFeatureCategoryStyle {
  return WATANY_FEATURE_CATEGORY_STYLES[category ?? "general"] ?? WATANY_FEATURE_CATEGORY_STYLES.general;
}