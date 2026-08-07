import type { ApkMobilePackagingAdapter } from "../contracts/apk-mobile-packaging-plugin-contract";
import { defaultApkMobilePackagingSettings } from "../config/apk-mobile-packaging-plugin-settings.defaults";
import { apkMobilePackagingPluginManifest } from "../manifest/apk-mobile-packaging-plugin.manifest";

export function createApkMobilePackagingDefaultAdapter(): ApkMobilePackagingAdapter {
  return {
    getSettings: () => defaultApkMobilePackagingSettings,
    getManifest: () => apkMobilePackagingPluginManifest
  };
}
