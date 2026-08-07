import { createVoicePipelineHostRegistration } from "../host-integration/voice-pipeline.host-registration";

export function proveVoicePipelineRegistryConsumption() {
  const registration = createVoicePipelineHostRegistration();
  const settings = registration.adapter.getSettings();
  return {
    pluginKey: registration.manifest.pluginKey,
    exportReady: registration.manifest.exportReady,
    replaceReady: registration.manifest.replaceReady,
    adminConfigurable: registration.manifest.adminConfigurable,
    enabled: settings.enabled,
    kbGrounding: settings.childFeatures.kbGrounding
  };
}
