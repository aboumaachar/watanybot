import { marketHostRegistration } from "../../../../../packages/features/market/src";

export function getWatanyMarketApiPluginStatus() {
  return {
    pluginKey: marketHostRegistration.manifest.pluginKey,
    apiPrefix: marketHostRegistration.manifest.routes.apiPrefix,
    productionApiReplaced: false
  };
}