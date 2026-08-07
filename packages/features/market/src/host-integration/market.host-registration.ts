import { marketPluginManifest } from "../manifest/market-plugin.manifest";
import { defaultMarketPluginAdapter } from "../adapter/market-default.adapter";

export const marketHostRegistration = {
  manifest: marketPluginManifest,
  adapter: defaultMarketPluginAdapter,
  status: "safe-modular-boundary-ready"
} as const;