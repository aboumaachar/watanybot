import { marketHostRegistration } from "../host-integration/market.host-registration";

export function proveMarketRegistryConsumption(): { ok: boolean; pluginKey: string; adminConfigurable: boolean } {
  return {
    ok: marketHostRegistration.manifest.pluginKey === "market",
    pluginKey: marketHostRegistration.manifest.pluginKey,
    adminConfigurable: marketHostRegistration.manifest.adminConfigurable
  };
}