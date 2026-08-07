import type { VotingPluginAdapter, VotingPluginManifest, VotingPluginSettings } from "../contracts/voting-plugin-contract";
import { defaultVotingPluginSettings } from "../config/voting-plugin-settings.defaults";
import { votingPluginManifest } from "../manifest/voting-plugin.manifest";

export function createVotingDefaultAdapter(): VotingPluginAdapter {
  return {
    getSettings(): VotingPluginSettings {
      return defaultVotingPluginSettings;
    },
    getManifest(): VotingPluginManifest {
      return votingPluginManifest;
    }
  };
}
