import type { VotingPluginManifest } from "../contracts/voting-plugin-contract";

export const votingPluginManifest: VotingPluginManifest = {
  pluginKey: "voting",
  displayName: "Voting Plugin",
  version: "0.1.0",
  exportReady: true,
  replaceReady: true,
  adminConfigurable: true
};
