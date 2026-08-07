export type MobilePackagingTarget = "pwa" | "twa" | "android" | "apk" | "aab" | "hybrid";

export interface ApkMobilePackagingSettings {
  pluginKey: "apk-mobile-packaging";
  enabled: boolean;
  childFeatures: {
    pwa: boolean;
    twa: boolean;
    androidShell: boolean;
    offlineManifest: boolean;
    storeHandoff: boolean;
  };
  targets: MobilePackagingTarget[];
  display: {
    label: string;
    adminLabel: string;
  };
  safety: {
    requireBuildProof: boolean;
    requireBrowserProof: boolean;
    requireManualReleaseApproval: boolean;
  };
}

export interface ApkMobilePackagingManifest {
  key: "apk-mobile-packaging";
  name: string;
  version: string;
  exportable: boolean;
  replaceable: boolean;
  adminConfigurable: boolean;
}

export interface ApkMobilePackagingAdapter {
  getSettings(): ApkMobilePackagingSettings;
  getManifest(): ApkMobilePackagingManifest;
}
