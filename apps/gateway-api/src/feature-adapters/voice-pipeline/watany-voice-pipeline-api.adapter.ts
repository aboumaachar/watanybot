import { createVoicePipelineHostRegistration } from "../../../../../packages/features/voice-pipeline/src";

export function createWatanyVoicePipelineApiAdapter() {
  const registration = createVoicePipelineHostRegistration();
  return {
    pluginKey: registration.manifest.pluginKey,
    settings: registration.adapter.getSettings(),
    manifest: registration.manifest
  };
}
