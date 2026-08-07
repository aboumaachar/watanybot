import { defaultMarketPluginSettings } from "../config/market-plugin-settings.defaults";

export const marketPluginManifest = {
  pluginKey: "market",
  version: "0.1.0",
  exportable: true,
  replaceable: true,
  adminConfigurable: true,
  settings: defaultMarketPluginSettings,
  routes: {
    webProof: "/__apex/market",
    apiPrefix: "/api/market"
  },
  doctrine: "near-zero-recode-v1-preserve-existing-market-behavior"
} as const;