import type { PluginAdminSettings } from './plugin-settings-contract';

export function createDefaultPluginAdminSettings(pluginKey: string): PluginAdminSettings {
  return {
    pluginKey,
    enabled: true,
    display: { visible: true },
    permissions: { roles: ['SUPER_ADMIN'] },
    dataSource: { sourceType: 'static' },
    childFeatures: [],
    config: {},
  };
}
