export interface PmaGovernancePluginSettings {
  pluginKey: string;
  enabled: boolean;
  adminConfigurable: boolean;
  exportable: boolean;
  replaceable: boolean;
}

export interface PmaGovernancePluginManifest {
  pluginKey: string;
  displayName: string;
  version: string;
  settings: PmaGovernancePluginSettings;
}

export interface PmaGovernancePluginAdapter {
  getSettings(): PmaGovernancePluginSettings;
  getManifest(): PmaGovernancePluginManifest;
}
