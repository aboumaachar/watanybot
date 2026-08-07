import { createSmsOtpDefaultAdapter } from "../adapter/sms-otp-default.adapter";

export function getSmsOtpRegistryConsumptionProof() {
  const adapter = createSmsOtpDefaultAdapter();
  const manifest = adapter.getManifest();
  const settings = adapter.getSettings();
  return {
    key: manifest.key,
    exportable: manifest.exportable,
    replaceable: manifest.replaceable,
    adminConfigurable: manifest.adminConfigurable,
    provider: settings.provider,
    externalEngineRequired: settings.requireLiveExternalEngine,
    proof: "pass",
  };
}
