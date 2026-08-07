import type { VotingPluginSettings } from "../contracts/voting-plugin-contract";

export const defaultVotingPluginSettings: VotingPluginSettings = {
  pluginKey: "voting",
  enabled: false,
  adminManaged: true,
  modes: ["poll", "vote", "survey"],
  allowAnonymous: false,
  requireAuth: true,
  resultsVisibility: "admin-only",
  labels: {
    ar: "التصويت",
    en: "Voting"
  }
};
