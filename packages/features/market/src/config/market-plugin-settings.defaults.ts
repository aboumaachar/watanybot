import type { MarketPluginSettings } from "../contracts/market-plugin-contract";

export const defaultMarketPluginSettings: MarketPluginSettings = {
  pluginKey: "market",
  enabled: true,
  childFeatures: {
    sell: true,
    buy: true,
    services: true,
    taxi: true,
    tourism: true,
    moderation: true,
    addressRequired: true
  },
  display: {
    showBadges: true,
    showAddress: true,
    showContactActions: true
  },
  permissions: {
    canCreate: ["USER", "ADMIN", "SUPERADMIN"],
    canModerate: ["ADMIN", "SUPERADMIN"],
    canAdminConfigure: ["SUPERADMIN"]
  }
};