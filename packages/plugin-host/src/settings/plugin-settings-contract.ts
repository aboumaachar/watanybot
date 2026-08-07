export type PluginChildFeatureSetting = {
  key: string;
  label: string;
  enabled: boolean;
  description?: string;
};

export type PluginDisplaySettings = {
  visible: boolean;
  order?: number;
  iconKey?: string;
  themeKey?: string;
  labelOverrides?: Record<string, string>;
};

export type PluginPermissionSettings = {
  roles: string[];
  apparatus?: string[];
  relations?: string[];
};

export type PluginDataSourceSettings = {
  sourceType: 'static' | 'api' | 'import' | 'external';
  sourceKey?: string;
  endpoint?: string;
};

export type PluginAdminSettings = {
  pluginKey: string;
  enabled: boolean;
  display: PluginDisplaySettings;
  permissions: PluginPermissionSettings;
  dataSource: PluginDataSourceSettings;
  childFeatures: PluginChildFeatureSetting[];
  config: Record<string, unknown;>;
};

export type PluginSettingsValidationResult = {
  valid: boolean;
  errors: string[];
};

export type PluginSettingsPersistenceAdapter = {
  getSettings(pluginKey: string): Promise<PluginAdminSettings | null>;
  saveSettings(settings: PluginAdminSettings): Promise<PluginAdminSettings>;
};

export function validatePluginAdminSettings(settings: PluginAdminSettings): PluginSettingsValidationResult {
  const errors: string[] = [];
  if (!settings.pluginKey) {
    errors.push('pluginKey is required');
  }
  if (!settings.display) {
    errors.push('display settings are required');
  }
  if (!Array.isArray(settings.childFeatures)) {
    errors.push('childFeatures must be an array');
  }
  return { valid: errors.length === 0, errors };
}
