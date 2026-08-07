import { apkMobilePackagingHostRegistration } from "../host-integration/apk-mobile-packaging.host-registration";

export function proveApkMobilePackagingRegistryConsumption() {
  const adapter = apkMobilePackagingHostRegistration.createAdapter();
  return {
    pluginKey: apkMobilePackagingHostRegistration.key,
    manifest: adapter.getManifest(),
    settings: adapter.getSettings()
  };
}
