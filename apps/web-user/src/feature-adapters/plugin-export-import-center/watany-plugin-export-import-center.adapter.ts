export interface WatanyPluginExportImportCenterWebAdapter {
  readonly route: string;
  readonly enabled: boolean;
}

export const watanyPluginExportImportCenterWebAdapter: WatanyPluginExportImportCenterWebAdapter = {
  route: '/__apex/plugin-export-import-center',
  enabled: false
};
