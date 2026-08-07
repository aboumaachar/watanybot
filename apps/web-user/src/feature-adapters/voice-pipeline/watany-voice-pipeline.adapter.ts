import { createVoicePipelineHostRegistration } from "../../../../../packages/features/voice-pipeline/src/index";

export function createWatanyVoicePipelineAdapter() {
  const registration = createVoicePipelineHostRegistration();
  return {
    pluginKey: registration.manifest.pluginKey,
    settings: registration.adapter.getSettings(),
    manifest: registration.manifest
  };
}
