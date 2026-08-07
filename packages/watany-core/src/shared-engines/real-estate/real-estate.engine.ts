import type { WatanyPropertyType, WatanyRealEstateDealType, WatanyRealEstateSelection } from "./real-estate.types";

export const WATANY_PROPERTY_TYPES: Array<{ id: WatanyPropertyType; nameAr: string; nameEn: string; sortOrder: number }> = [
  { id: "apartment", nameAr: "شقة", nameEn: "Apartment", sortOrder: 10 },
  { id: "house", nameAr: "منزل", nameEn: "House", sortOrder: 20 },
  { id: "land", nameAr: "أرض", nameEn: "Land", sortOrder: 30 },
  { id: "shop", nameAr: "محل", nameEn: "Shop", sortOrder: 40 },
  { id: "office", nameAr: "مكتب", nameEn: "Office", sortOrder: 50 },
  { id: "warehouse", nameAr: "مستودع", nameEn: "Warehouse", sortOrder: 60 },
  { id: "other", nameAr: "غير ذلك", nameEn: "Other", sortOrder: 70 }
];

export const WATANY_REAL_ESTATE_DEAL_TYPES: Array<{ id: WatanyRealEstateDealType; nameAr: string; nameEn: string; sortOrder: number }> = [
  { id: "rent", nameAr: "إيجار", nameEn: "Rent", sortOrder: 10 },
  { id: "sale", nameAr: "بيع", nameEn: "Sale", sortOrder: 20 },
  { id: "request", nameAr: "طلب", nameEn: "Request", sortOrder: 30 }
];

export class WatanyRealEstateEngine {
  listPropertyTypes() {
    return [...WATANY_PROPERTY_TYPES].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  listDealTypes() {
    return [...WATANY_REAL_ESTATE_DEAL_TYPES].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  toDisplay(selection: WatanyRealEstateSelection): string {
    const property = WATANY_PROPERTY_TYPES.find((item) => item.id === selection.propertyType);
    const deal = WATANY_REAL_ESTATE_DEAL_TYPES.find((item) => item.id === selection.dealType);
    return [property?.nameAr, deal?.nameAr, selection.sizeSqm ? `${selection.sizeSqm} م²` : undefined].filter(Boolean).join(" / ") || "غير محدد";
  }
}

export const watanyRealEstateEngine = new WatanyRealEstateEngine();
