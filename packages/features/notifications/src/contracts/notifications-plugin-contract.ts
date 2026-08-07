export interface NotificationsPluginSettings {
  pluginKey: string;
  enabled: boolean;
  adminConfigurable: boolean;
  exportable: boolean;
  replaceable: boolean;
}

export interface NotificationsPluginManifest {
  pluginKey: string;
  displayName: string;
  version: string;
  settings: NotificationsPluginSettings;
}

export interface NotificationsPluginAdapter {
  getSettings(): NotificationsPluginSettings;
  getManifest(): NotificationsPluginManifest;
}
