import type { VoicePipelineManifest } from "../contracts/voice-pipeline-plugin-contract";

export const voicePipelinePluginManifest: VoicePipelineManifest = {
  pluginKey: "voice-pipeline",
  displayName: "Voice Pipeline Plugin",
  version: "0.1.0",
  exportReady: true,
  replaceReady: true,
  adminConfigurable: true
};
