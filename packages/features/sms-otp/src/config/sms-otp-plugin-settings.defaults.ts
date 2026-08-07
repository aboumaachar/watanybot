import type { SmsOtpSettings } from "../contracts/sms-otp-plugin-contract";

export const smsOtpDefaultSettings: SmsOtpSettings = {
  pluginKey: "sms-otp",
  enabled: true,
  provider: "local-dev",
  requireLiveExternalEngine: false,
  localDevModeEnabled: true,
  otpLength: 6,
  otpExpirySeconds: 300,
  maxAttempts: 5,
  childFeatures: {
    sendOtp: true,
    verifyOtp: true,
    healthCheck: true,
    adminOverrides: true,
    auditLog: true,
  },
};
