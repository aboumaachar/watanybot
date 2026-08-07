export type WatanyPropertyType = "apartment" | "house" | "land" | "shop" | "office" | "warehouse" | "other";
export type WatanyRealEstateDealType = "rent" | "sale" | "request";
export type WatanyFurnishedState = "furnished" | "unfurnished" | "semi_furnished" | "not_applicable";

export interface WatanyRealEstateSelection {
  propertyType?: WatanyPropertyType;
  dealType?: WatanyRealEstateDealType;
  addressId?: string;
  sizeSqm?: number;
  rooms?: number;
  condition?: string;
  furnished?: WatanyFurnishedState;
}
