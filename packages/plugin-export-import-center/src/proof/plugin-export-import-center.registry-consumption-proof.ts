import { createPluginExportImportCenterAdapter } from '../adapter/plugin-export-import-default.adapter';

export function provePluginExportImportCenterRegistryConsumption(): boolean {
  const adapter = createPluginExportImportCenterAdapter();
  return adapter.listPlugins().length >= 15;
}
