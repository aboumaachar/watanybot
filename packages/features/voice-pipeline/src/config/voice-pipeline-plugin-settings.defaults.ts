import type { VoicePipelineSettings } from "../contracts/voice-pipeline-plugin-contract";

export const defaultVoicePipelineSettings: VoicePipelineSettings = {
  pluginKey: "voice-pipeline",
  enabled: true,
  childFeatures: {
    speechToText: true,
    textToSpeech: true,
    kbGrounding: true,
    manualFallback: true,
    providerDiagnostics: true
  },
  display: {
    showVoiceButton: true,
    showTranscript: true,
    showProviderStatus: true
  },
  providers: {
    sttProvider: "configurable",
    ttsProvider: "configurable",
    llmProvider: "configurable",
    kbSearchProvider: "watany-kb"
  },
  permissions: {
    rolesAllowed: ["USER", "ADMIN", "SUPERADMIN"],
    requireLogin: false
  }
};
