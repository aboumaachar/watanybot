import type { SmsOtpManifest } from "../contracts/sms-otp-plugin-contract";

export const smsOtpPluginManifest: SmsOtpManifest = {
  key: "sms-otp",
  label: "SMS / OTP",
  version: "0.1.0",
  exportable: true,
  replaceable: true,
  adminConfigurable: true,
};
