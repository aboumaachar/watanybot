import { createSmsOtpDefaultAdapter } from "../adapter/sms-otp-default.adapter";

export const smsOtpHostRegistration = {
  key: "sms-otp",
  category: "auth",
  adapter: createSmsOtpDefaultAdapter,
  safety: "external-engine-optional",
  productionReplacement: false,
};
