import type { ApkMobilePackagingSettings } from "../contracts/apk-mobile-packaging-plugin-contract";

export const defaultApkMobilePackagingSettings: ApkMobilePackagingSettings = {
  pluginKey: "apk-mobile-packaging",
  enabled: true,
  childFeatures: {
    pwa: true,
    twa: true,
    androidShell: false,
    offlineManifest: true,
    storeHandoff: false
  },
  targets: ["pwa", "twa"],
  display: {
    label: "Mobile Packaging",
    adminLabel: "APK / Mobile Packaging Settings"
  },
  safety: {
    requireBuildProof: true,
    requireBrowserProof: true,
    requireManualReleaseApproval: true
  }
};
