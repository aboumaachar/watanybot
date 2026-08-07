export interface WatanyPluginExportImportCenterApiAdapter {
  readonly basePath: string;
  readonly dryRunOnly: boolean;
}

export const watanyPluginExportImportCenterApiAdapter: WatanyPluginExportImportCenterApiAdapter = {
  basePath: '/api/__apex/plugin-export-import-center',
  dryRunOnly: true
};
