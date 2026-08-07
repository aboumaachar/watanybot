export type VoicePipelineProviderKind = "stt" | "tts" | "llm" | "kb" | "manual";

export interface VoicePipelineSettings {
  pluginKey: "voice-pipeline";
  enabled: boolean;
  childFeatures: {
    speechToText: boolean;
    textToSpeech: boolean;
    kbGrounding: boolean;
    manualFallback: boolean;
    providerDiagnostics: boolean;
  };
  display: {
    showVoiceButton: boolean;
    showTranscript: boolean;
    showProviderStatus: boolean;
  };
  providers: {
    sttProvider: string;
    ttsProvider: string;
    llmProvider: string;
    kbSearchProvider: string;
  };
  permissions: {
    rolesAllowed: string[];
    requireLogin: boolean;
  };
}

export interface VoicePipelineManifest {
  pluginKey: "voice-pipeline";
  displayName: string;
  version: string;
  exportReady: boolean;
  replaceReady: boolean;
  adminConfigurable: boolean;
}

export interface VoicePipelineAdapter {
  getSettings(): VoicePipelineSettings;
  getManifest(): VoicePipelineManifest;
}
