export type VotingPluginMode = "poll" | "vote" | "survey" | "consultation";

export interface VotingPluginSettings {
  pluginKey: "voting";
  enabled: boolean;
  adminManaged: boolean;
  modes: VotingPluginMode[];
  allowAnonymous: boolean;
  requireAuth: boolean;
  resultsVisibility: "admin-only" | "after-vote" | "public";
  labels: {
    ar: string;
    en: string;
  };
}

export interface VotingPluginManifest {
  pluginKey: "voting";
  displayName: string;
  version: string;
  exportReady: boolean;
  replaceReady: boolean;
  adminConfigurable: boolean;
}

export interface VotingPluginAdapter {
  getSettings(): VotingPluginSettings;
  getManifest(): VotingPluginManifest;
}
