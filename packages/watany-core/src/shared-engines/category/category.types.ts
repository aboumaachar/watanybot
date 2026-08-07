export type WatanyCategoryDomain =
  | "services"
  | "marketplace"
  | "opportunities"
  | "network"
  | "community"
  | "documents"
  | "updates"
  | "other";

export interface WatanyCategory {
  id: string;
  domain: WatanyCategoryDomain;
  parentId?: string;
  nameAr: string;
  nameEn?: string;
  sortOrder: number;
  enabled: boolean;
}
