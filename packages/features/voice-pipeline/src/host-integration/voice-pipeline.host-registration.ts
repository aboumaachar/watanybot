import { createVoicePipelineDefaultAdapter } from "../adapter/voice-pipeline-default.adapter";
import { voicePipelinePluginManifest } from "../manifest/voice-pipeline-plugin.manifest";

export function createVoicePipelineHostRegistration() {
  return {
    manifest: voicePipelinePluginManifest,
    adapter: createVoicePipelineDefaultAdapter(),
    settingsKey: "voice-pipeline"
  };
}
