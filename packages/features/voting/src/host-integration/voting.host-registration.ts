import { createVotingDefaultAdapter } from "../adapter/voting-default.adapter";
import { votingPluginManifest } from "../manifest/voting-plugin.manifest";

export const votingHostRegistration = {
  pluginKey: "voting" as const,
  manifest: votingPluginManifest,
  adapter: createVotingDefaultAdapter(),
  routes: [],
  apiRoutes: [],
  uiSlots: [],
  settingsRequired: true,
  productionReplacement: false
};
