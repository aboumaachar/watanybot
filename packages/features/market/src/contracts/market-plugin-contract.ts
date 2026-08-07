export type MarketPluginKey = "market";

export type MarketListingType =
  | "sell"
  | "buy"
  | "service"
  | "taxi"
  | "tourism"
  | "help"
  | "info";

export interface MarketListingSummary {
  id: string;
  title: string;
  type: MarketListingType;
  status: "draft" | "pending_review" | "published" | "archived";
  ownerId?: string;
  addressVillageId?: string;
  createdAt?: string;
}

export interface MarketPluginSettings {
  pluginKey: MarketPluginKey;
  enabled: boolean;
  childFeatures: {
    sell: boolean;
    buy: boolean;
    services: boolean;
    taxi: boolean;
    tourism: boolean;
    moderation: boolean;
    addressRequired: boolean;
  };
  display: {
    showBadges: boolean;
    showAddress: boolean;
    showContactActions: boolean;
  };
  permissions: {
    canCreate: string[];
    canModerate: string[];
    canAdminConfigure: string[];
  };
}

export interface MarketPluginAdapter {
  pluginKey: MarketPluginKey;
  getDefaultSettings(): MarketPluginSettings;
  listFeaturedListings(): Promise<MarketListingSummary[]> | MarketListingSummary[];
  validateSettings(settings: MarketPluginSettings): { ok: boolean; errors: string[] };
}