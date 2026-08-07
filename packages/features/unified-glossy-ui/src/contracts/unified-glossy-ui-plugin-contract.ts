export interface UnifiedGlossyUiPluginSettings {
  pluginKey: string;
  enabled: boolean;
  adminConfigurable: boolean;
  exportable: boolean;
  replaceable: boolean;
}

export interface UnifiedGlossyUiPluginManifest {
  pluginKey: string;
  displayName: string;
  version: string;
  settings: UnifiedGlossyUiPluginSettings;
}

export interface UnifiedGlossyUiPluginAdapter {
  getSettings(): UnifiedGlossyUiPluginSettings;
  getManifest(): UnifiedGlossyUiPluginManifest;
}
