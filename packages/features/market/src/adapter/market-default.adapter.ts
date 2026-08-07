import type { MarketPluginAdapter, MarketPluginSettings, MarketListingSummary } from "../contracts/market-plugin-contract";
import { defaultMarketPluginSettings } from "../config/market-plugin-settings.defaults";

export const defaultMarketPluginAdapter: MarketPluginAdapter = {
  pluginKey: "market",
  getDefaultSettings(): MarketPluginSettings {
    return defaultMarketPluginSettings;
  },
  listFeaturedListings(): MarketListingSummary[] {
    return [];
  },
  validateSettings(settings: MarketPluginSettings): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (settings.pluginKey !== "market") errors.push("pluginKey must be market");
    return { ok: errors.length === 0, errors };
  }
};