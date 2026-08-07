import type { WatanyCategory, WatanyCategoryDomain } from "./category.types";

export const WATANY_CATEGORY_SEED: WatanyCategory[] = [
  { id: "services-official", domain: "services", nameAr: "خدمات رسمية", nameEn: "Official Services", sortOrder: 10, enabled: true },
  { id: "market-cars", domain: "marketplace", nameAr: "سيارات", nameEn: "Cars", sortOrder: 10, enabled: true },
  { id: "market-real-estate", domain: "marketplace", nameAr: "عقارات", nameEn: "Real Estate", sortOrder: 20, enabled: true },
  { id: "opportunities-jobs", domain: "opportunities", nameAr: "وظائف مدنية", nameEn: "Civilian Jobs", sortOrder: 10, enabled: true },
  { id: "network-providers", domain: "network", nameAr: "مزودو خدمات", nameEn: "Service Providers", sortOrder: 10, enabled: true },
  { id: "updates-circulars", domain: "updates", nameAr: "تعاميم", nameEn: "Circulars", sortOrder: 10, enabled: true }
];

export class WatanyCategoryEngine {
  list(domain?: WatanyCategoryDomain): WatanyCategory[] {
    const items = domain ? WATANY_CATEGORY_SEED.filter((item) => item.domain === domain) : WATANY_CATEGORY_SEED;
    return [...items].filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, "ar"));
  }

  children(parentId: string): WatanyCategory[] {
    return this.list().filter((item) => item.parentId === parentId);
  }
}

export const watanyCategoryEngine = new WatanyCategoryEngine();
