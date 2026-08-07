export type WatanyFeatureStatus = 'enabled' | 'disabled' | 'review-required';

export type WatanyFeatureManifest = {
  key: string;
  name: string;
  version: string;
  owner?: string;
  status: WatanyFeatureStatus;
  routes?: string[];
  apiPrefixes?: string[];
  permissions?: string[];
  configSchemaKey?: string;
  exportReady?: boolean;
  replaceReady?: boolean;
};

export type WatanyFeatureAdapter = {
  manifest: WatanyFeatureManifest;
  isEnabled: () => boolean;
  getUiEntry?: () => unknown;
  getApiRouter?: () => unknown;
  smoke?: () => Promise<boolean> | boolean;
};