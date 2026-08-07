export type PluginExportImportOperation = 'export' | 'import' | 'replace' | 'rollback' | 'validate';

export interface PluginExportImportPluginRecord {
  readonly key: string;
  readonly name: string;
  readonly version: string;
  readonly exportReady: boolean;
  readonly replaceReady: boolean;
  readonly dependencySafe: boolean;
}

export interface PluginExportImportRequest {
  readonly operation: PluginExportImportOperation;
  readonly pluginKey: string;
  readonly requestedBy?: string;
  readonly dryRun: boolean;
}

export interface PluginExportImportResult {
  readonly ok: boolean;
  readonly operation: PluginExportImportOperation;
  readonly pluginKey: string;
  readonly message: string;
  readonly evidencePath?: string;
}

export interface PluginExportImportCenterAdapter {
  listPlugins(): readonly PluginExportImportPluginRecord[];
  validateRequest(request: PluginExportImportRequest): PluginExportImportResult;
}
