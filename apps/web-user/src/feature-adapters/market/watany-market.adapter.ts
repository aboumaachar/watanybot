import { marketHostRegistration, proveMarketRegistryConsumption } from "../../../../../packages/features/market/src/index";

export function getWatanyMarketPluginStatus() {
  return {
    hostRegistration: marketHostRegistration,
    proof: proveMarketRegistryConsumption(),
    productionUiReplaced: false,
    note: "Existing Watany Market UI remains preserved until visual/browser proof is approved."
  };
}