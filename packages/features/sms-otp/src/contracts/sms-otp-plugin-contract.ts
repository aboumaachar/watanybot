export type SmsOtpProviderKey = "local-dev" | "smsapi" | "whatsapp-local" | "external";

export interface SmsOtpSettings {
  pluginKey: "sms-otp";
  enabled: boolean;
  provider: SmsOtpProviderKey;
  requireLiveExternalEngine: boolean;
  localDevModeEnabled: boolean;
  otpLength: number;
  otpExpirySeconds: number;
  maxAttempts: number;
  childFeatures: {
    sendOtp: boolean;
    verifyOtp: boolean;
    healthCheck: boolean;
    adminOverrides: boolean;
    auditLog: boolean;
  };
}

export interface SmsOtpManifest {
  key: "sms-otp";
  label: string;
  version: string;
  exportable: boolean;
  replaceable: boolean;
  adminConfigurable: boolean;
}

export interface SmsOtpAdapter {
  getSettings(): SmsOtpSettings;
  getManifest(): SmsOtpManifest;
  getHealthStatus(): { status: "configured" | "disabled" | "external-optional"; detail: string };
}
