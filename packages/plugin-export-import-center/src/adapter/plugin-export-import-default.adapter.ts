import type { PluginExportImportCenterAdapter, PluginExportImportRequest, PluginExportImportResult } from '../contracts/plugin-export-import-center-contract';
import { WATANY_V2_EXPORT_IMPORT_PLUGINS } from '../plugin-export-import-defaults';

export function createPluginExportImportCenterAdapter(): PluginExportImportCenterAdapter {
  return {
    listPlugins() {
      return WATANY_V2_EXPORT_IMPORT_PLUGINS;
    },
    validateRequest(request: PluginExportImportRequest): PluginExportImportResult {
      const match = WATANY_V2_EXPORT_IMPORT_PLUGINS.find((plugin) => plugin.key === request.pluginKey);
      if (!match) {
        return { ok: false, operation: request.operation, pluginKey: request.pluginKey, message: 'Plugin is not registered in export/import center.' };
      }
      return { ok: true, operation: request.operation, pluginKey: request.pluginKey, message: 'Request is valid for dry-run contract boundary.' };
    }
  };
}
