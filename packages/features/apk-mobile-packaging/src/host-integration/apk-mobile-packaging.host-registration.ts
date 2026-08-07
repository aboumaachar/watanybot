import { createApkMobilePackagingDefaultAdapter } from "../adapter/apk-mobile-packaging-default.adapter";

export const apkMobilePackagingHostRegistration = {
  key: "apk-mobile-packaging",
  createAdapter: createApkMobilePackagingDefaultAdapter
};
