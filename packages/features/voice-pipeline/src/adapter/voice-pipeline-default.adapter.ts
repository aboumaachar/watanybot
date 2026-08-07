import type { VoicePipelineAdapter } from "../contracts/voice-pipeline-plugin-contract";
import { defaultVoicePipelineSettings } from "../config/voice-pipeline-plugin-settings.defaults";
import { voicePipelinePluginManifest } from "../manifest/voice-pipeline-plugin.manifest";

export function createVoicePipelineDefaultAdapter(): VoicePipelineAdapter {
  return {
    getSettings: () => defaultVoicePipelineSettings,
    getManifest: () => voicePipelinePluginManifest
  };
}
