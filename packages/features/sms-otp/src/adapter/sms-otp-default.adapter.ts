import type { SmsOtpAdapter } from "../contracts/sms-otp-plugin-contract";
import { smsOtpDefaultSettings } from "../config/sms-otp-plugin-settings.defaults";
import { smsOtpPluginManifest } from "../manifest/sms-otp-plugin.manifest";

export function createSmsOtpDefaultAdapter(): SmsOtpAdapter {
  return {
    getSettings: () => smsOtpDefaultSettings,
    getManifest: () => smsOtpPluginManifest,
    getHealthStatus: () => ({
      status: "external-optional",
      detail: "SMS/OTP plugin is configured as local-first. External SMSAPI engine must remain optional until admin enables it.",
    }),
  };
}
